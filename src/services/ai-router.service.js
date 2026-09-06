import prisma from "../lib/prisma.js";
import { getSecret } from "./config.service.js";
import { decryptText } from "../lib/encryption.js";
import { getAiProviderAdapter } from "../modules/ai-adapters/ai-provider.factory.js";
import { GroqAdapter } from "../modules/ai-adapters/groq.adapter.js";
import { settleActualUsage, estimateCreditCost, verifyBalance } from "./billing.service.js";

const fallbackGroqAdapter = new GroqAdapter();

/**
 * ── Multi-Model AI Router & Dispatcher ───────────────────────────────────
 * Menangani routing fitur skripsi ke model AI yang dikonfigurasi di database.
 * Mendukung primary model, fallback model otomatis, dual-tier (free vs paid),
 * verifikasi saldo kredit pra-eksekusi (pre-flight balance check), serta telemetri.
 * ────────────────────────────────────────────────────────────────────────
 */

/**
 * Mendapatkan model aktif (Primary + Fallback) untuk fitur tertentu
 */
export async function resolveModelForFeature(featureCode) {
  const feature = await prisma.researchFeature.findUnique({
    where: { code: featureCode },
    include: {
      routing: {
        include: {
          primaryModel: true,
          fallbackModel: true,
        },
      },
    },
  });

  if (!feature) {
    // Dynamic auto-healing: Cari model paid aktif yang tersedia (xai-grok-reasoning / xai-grok-fast)
    const paidModel =
      (await prisma.aiModelConfig.findFirst({
        where: { isPaid: true, isActive: true },
        orderBy: { priceInputPerM: "desc" },
      })) ||
      (await prisma.aiModelConfig.findFirst({ where: { isActive: true } }));

    if (paidModel) {
      const newFeature = await prisma.researchFeature.upsert({
        where: { code: featureCode },
        update: {},
        create: {
          code: featureCode,
          label: featureCode.replace(/_/g, " "),
          description: `Rute fitur AI ${featureCode}`,
          baseCreditCost: 2,
          isActive: true,
        },
      });

      await prisma.featureRouting.upsert({
        where: { featureId: newFeature.id },
        update: { primaryModelId: paidModel.id },
        create: {
          featureId: newFeature.id,
          primaryModelId: paidModel.id,
        },
      });

      return {
        feature: newFeature,
        primaryModel: paidModel,
        fallbackModel: null,
      };
    }

    throw new Error(`Fitur riset "${featureCode}" tidak ditemukan.`);
  }

  const primaryModel = feature.routing?.primaryModel || null;
  const fallbackModel = feature.routing?.fallbackModel || null;

  return {
    feature,
    primaryModel,
    fallbackModel,
  };
}

/**
 * Menjalankan chat completion dengan auto-fallback dan auto-billing
 */
export async function executeAiCompletion({
  featureCode,
  messages,
  temperature = 0.2,
  maxTokens = 2500,
  jsonMode = false,
  userId = null,
  projectId = null,
  journalId = null,
}) {
  const startTime = Date.now();

  // Auto-resolve userId dari context projectId atau journalId jika userId belum diisi eksplisit
  if (!userId && projectId) {
    try {
      const proj = await prisma.researchProject.findUnique({
        where: { id: projectId },
        select: { userId: true },
      });
      if (proj?.userId) userId = proj.userId;
    } catch (_) {}
  }
  if (!userId && journalId) {
    try {
      const j = await prisma.journal.findUnique({
        where: { id: journalId },
        select: { project: { select: { userId: true } } },
      });
      if (j?.project?.userId) userId = j.project.userId;
    } catch (_) {}
  }

  const { feature, primaryModel, fallbackModel } = await resolveModelForFeature(featureCode);

  // 0. Pre-Flight Credit Verification (Anti-Cost Leak & Anti-Fraud)
  // Verifikasi saldo pengguna sebelum API provider dipanggil untuk mencegah kebocoran biaya token
  const costEstimate = await estimateCreditCost(featureCode, maxTokens, userId).catch((err) => {
    console.warn(`[AI-ROUTER] Gagal menghitung estimasi biaya kredit untuk fitur "${featureCode}":`, err.message);
    return null;
  });

  if (costEstimate && !costEstimate.isFreeTier && costEstimate.estimatedCredits > 0) {
    if (!userId) {
      const authErr = new Error("Autentikasi akun pengguna diperlukan untuk mengakses fitur riset berbayar ini.");
      authErr.statusCode = 401;
      throw authErr;
    }
    // Verifikasi saldo kredit - lempar 402 jika saldo tidak cukup
    await verifyBalance(userId, costEstimate.estimatedCredits);
  }

  let targetModel = primaryModel;
  let response = null;
  let usedFallback = false;
  let usageInfo = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

  // 1. Eksekusi Primary Model
  if (targetModel && targetModel.isActive) {
    try {
      response = await dispatchModelCall({
        model: targetModel,
        messages,
        temperature,
        maxTokens,
        jsonMode,
      });
      usageInfo = response.usage || usageInfo;
    } catch (err) {
      console.warn(`[AI-ROUTER] Primary model "${targetModel.modelName}" gagal: ${err.message}. Mencoba fallback...`);
      if (fallbackModel && fallbackModel.isActive) {
        targetModel = fallbackModel;
        usedFallback = true;
        response = await dispatchModelCall({
          model: fallbackModel,
          messages,
          temperature,
          maxTokens,
          jsonMode,
        });
        usageInfo = response.usage || usageInfo;
      } else {
        throw err;
      }
    }
  } else if (fallbackModel && fallbackModel.isActive) {
    targetModel = fallbackModel;
    usedFallback = true;
    response = await dispatchModelCall({
      model: fallbackModel,
      messages,
      temperature,
      maxTokens,
      jsonMode,
    });
    usageInfo = response.usage || usageInfo;
  } else {
    // Default fallback to Groq via Adapter
    const groqKey =
      (await getSecret("GROQ_API_KEY_FRAMEWORK_RELASI")) ||
      (await getSecret("GROQ_API_KEY")) ||
      process.env.GROQ_API_KEY;

    if (!groqKey) {
      throw new Error("Tidak ada model AI aktif atau API Key yang tersedia untuk fitur ini.");
    }

    response = await fallbackGroqAdapter.executeCompletion({
      model: { modelName: "qwen/qwen3.8-27b" },
      messages,
      temperature,
      maxTokens,
      jsonMode,
      apiKey: groqKey,
    });
    usageInfo = response.usage || usageInfo;
  }

  const responseTimeMs = Date.now() - startTime;

  // 2. Telemetry & Billing Settle (Hanya dieksekusi setelah pemanggilan AI sukses)
  const inputTokens = usageInfo.prompt_tokens || Math.round(JSON.stringify(messages).length / 4);
  const outputTokens = usageInfo.completion_tokens || Math.round((response.content || "").length / 4);

  let usageLog = null;
  try {
    usageLog = await settleActualUsage({
      userId,
      featureCode,
      modelId: targetModel?.id || null,
      inputTokens,
      outputTokens,
      responseTimeMs,
      statusCode: 200,
    });
  } catch (logErr) {
    console.error("[AI-ROUTER] Gagal mencatat telemetri billing:", logErr.message);
  }

  return {
    content: response.content,
    modelUsed: targetModel?.modelName || "Groq Default",
    usedFallback,
    tokens: {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    },
    responseTimeMs,
    usageLogId: usageLog?.id || null,
  };
}

/**
 * Dispatcher internal yang memanggil provider melalui AI Provider Adapter
 */
async function dispatchModelCall({ model, messages, temperature, maxTokens, jsonMode }) {
  let modelKey = "";
  if (model.apiKeyIv && model.apiKeyEncrypted) {
    modelKey = decryptText(model.apiKeyEncrypted, model.apiKeyIv);
  } else {
    modelKey = model.apiKeyEncrypted || "";
  }

  const adapter = getAiProviderAdapter(model);

  // Resolusi API key spesifik provider
  let finalApiKey = modelKey;
  if (!finalApiKey) {
    if (adapter.name === "OpenAI-Compatible") {
      finalApiKey =
        (await getSecret(model.routerLabel)) ||
        (await getSecret("MAIAROUTER_API_KEY")) ||
        process.env.MAIAROUTER_API_KEY;
    } else {
      finalApiKey =
        (await getSecret(model.routerLabel)) ||
        (await getSecret("GROQ_API_KEY_FRAMEWORK_RELASI")) ||
        (await getSecret("GROQ_API_KEY")) ||
        process.env.GROQ_API_KEY;
    }
  }

  return await adapter.executeCompletion({
    model,
    messages,
    temperature,
    maxTokens,
    jsonMode,
    apiKey: finalApiKey,
  });
}
