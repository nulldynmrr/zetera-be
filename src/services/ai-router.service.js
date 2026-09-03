import prisma from "../lib/prisma.js";
import { getSecret } from "./config.service.js";
import { decryptText } from "../lib/encryption.js";
import { getMaiarouterChatCompletion, getMaiarouterEmbeddings } from "./maiarouter.service.js";
import { Groq } from "groq-sdk";
import { settleActualUsage } from "./billing.service.js";

/**
 * ── Multi-Model AI Router & Dispatcher ───────────────────────────────────
 * Menangani routing fitur skripsi ke model AI yang dikonfigurasi di database.
 * Mendukung primary model, fallback model otomatis, dual-tier (free vs paid),
 * serta telemetri pencatatan pemakaian token secara real-time.
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
}) {
  const startTime = Date.now();
  const { feature, primaryModel, fallbackModel } = await resolveModelForFeature(featureCode);

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
      console.warn(`[AI-ROUTER] Primary model ${targetModel.modelName} gagal: ${err.message}. Mencoba fallback...`);
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
    // Default fallback to Groq
    const groqKey =
      (await getSecret("GROQ_API_KEY_FRAMEWORK_RELASI")) ||
      (await getSecret("GROQ_API_KEY")) ||
      process.env.GROQ_API_KEY;
    if (!groqKey) {
      throw new Error("Tidak ada model AI aktif yang tersedia untuk fitur ini.");
    }
    const groq = new Groq({ apiKey: groqKey });
    const comp = await groq.chat.completions.create({
      model: "qwen/qwen3.8-27b",
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: jsonMode ? { type: "json_object" } : undefined,
    });
    response = {
      content: comp.choices[0]?.message?.content || "",
      usage: comp.usage,
      raw: comp,
    };
    usageInfo = comp.usage || usageInfo;
  }

  const responseTimeMs = Date.now() - startTime;

  // 2. Telemetry & Billing Settle
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
 * Dispatcher internal yang memanggil provider spesifik (Groq, MaiaRouter, OpenAI)
 */
async function dispatchModelCall({ model, messages, temperature, maxTokens, jsonMode }) {
  let modelKey = "";
  if (model.apiKeyIv && model.apiKeyEncrypted) {
    modelKey = decryptText(model.apiKeyEncrypted, model.apiKeyIv);
  } else {
    modelKey = model.apiKeyEncrypted || "";
  }

  // A. Provider MaiaRouter / OpenAI compatible
  if (model.baseUrl.includes("maiarouter") || model.baseUrl.includes("openai") || model.baseUrl.includes("/v1")) {
    const rawApiKey =
      modelKey ||
      (await getSecret(model.routerLabel)) ||
      (await getSecret("MAIAROUTER_API_KEY")) ||
      process.env.MAIAROUTER_API_KEY;

    const targetUrl = model.baseUrl.endsWith("/chat/completions")
      ? model.baseUrl
      : `${model.baseUrl.replace(/\/$/, "")}/chat/completions`;

    const requestBody = {
      model: model.modelName,
      messages,
      temperature,
      max_tokens: maxTokens,
    };
    if (jsonMode) requestBody.response_format = { type: "json_object" };

    const resp = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${rawApiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`[${model.routerLabel} HTTP ${resp.status}]: ${errText}`);
    }

    const data = await resp.json();
    return {
      content: data.choices?.[0]?.message?.content || "",
      usage: data.usage || {},
      raw: data,
    };
  }

  // B. Groq Provider
  const groqApiKey =
    modelKey ||
    (await getSecret(model.routerLabel)) ||
    (await getSecret("GROQ_API_KEY_FRAMEWORK_RELASI")) ||
    (await getSecret("GROQ_API_KEY")) ||
    process.env.GROQ_API_KEY;

  const groq = new Groq({ apiKey: groqApiKey });
  const comp = await groq.chat.completions.create({
    model: model.modelName || "qwen/qwen3.8-27b",
    messages,
    temperature,
    max_tokens: maxTokens,
    response_format: jsonMode ? { type: "json_object" } : undefined,
  });

  return {
    content: comp.choices[0]?.message?.content || "",
    usage: comp.usage || {},
    raw: comp,
  };
}
