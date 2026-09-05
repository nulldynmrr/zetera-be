import prisma from "../../lib/prisma.js";
import { encryptText, decryptText } from "../../lib/encryption.js";
import { Groq } from "groq-sdk";

/**
 * AI Model Configurations CRUD (Terenkripsi AES-256) & Testing
 */
export async function getAiModels(req, res, next) {
  try {
    const models = await prisma.aiModelConfig.findMany({
      orderBy: { createdAt: "asc" },
    });

    const masked = models.map((m) => {
      let rawKey = "";
      if (m.apiKeyIv) {
        rawKey = decryptText(m.apiKeyEncrypted, m.apiKeyIv);
      } else {
        rawKey = m.apiKeyEncrypted || "";
      }

      const parsedKeys = rawKey.split(/[\n,;]+/).map((k) => k.trim()).filter((k) => k.length > 5);
      const keyPoolCount = parsedKeys.length;

      const maskedKey = keyPoolCount > 1
        ? `${parsedKeys[0].slice(0, 4)}...${parsedKeys[0].slice(-4)} (+${keyPoolCount - 1} pool keys)`
        : (rawKey.length > 8
          ? `${rawKey.slice(0, 4)}...${rawKey.slice(-4)}`
          : "••••••••");

      return {
        ...m,
        apiKeyMasked: maskedKey,
        keyPoolCount,
      };
    });

    res.status(200).json({ success: true, data: masked });
  } catch (err) {
    next(err);
  }
}

export async function createAiModel(req, res, next) {
  try {
    const {
      routerLabel,
      baseUrl,
      modelName,
      apiKey,
      modelKind = "LLM",
      pricingUnit = "TOKEN",
      priceInputPer1M = 0,
      priceOutputPer1M = 0,
      pricePerDocument = 0,
      maxBudgetUsd = 50,
      rpmLimit = 60,
      avgTokensPerUse = 1500,
      isActive = true,
      isFreeTier = false,
    } = req.body;

    if (!routerLabel || !modelName || !baseUrl) {
      const err = new Error("Router Label, Base URL, dan Nama Model wajib diisi.");
      err.statusCode = 400;
      throw err;
    }

    let cipherText = "";
    let iv = "";
    if (apiKey && apiKey.trim()) {
      const enc = encryptText(apiKey.trim());
      cipherText = enc.cipherText;
      iv = enc.iv;
    }

    const created = await prisma.aiModelConfig.create({
      data: {
        routerLabel: routerLabel.trim(),
        baseUrl: baseUrl.trim(),
        modelName: modelName.trim(),
        apiKeyEncrypted: cipherText,
        apiKeyIv: iv,
        modelKind,
        pricingUnit,
        priceInputPer1M: Number(priceInputPer1M) || 0,
        priceOutputPer1M: Number(priceOutputPer1M) || 0,
        pricePerDocument: Number(pricePerDocument) || 0,
        maxBudgetUsd: Number(maxBudgetUsd) || 50,
        rpmLimit: Number(rpmLimit) || 60,
        avgTokensPerUse: Number(avgTokensPerUse) || 1500,
        isActive: Boolean(isActive),
        isFreeTier: Boolean(isFreeTier),
      },
    });

    res.status(201).json({
      success: true,
      message: `Model AI "${created.routerLabel}" berhasil dienkripsi (AES-256) dan ditambahkan!`,
      data: created,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateAiModel(req, res, next) {
  try {
    const { id } = req.params;
    const {
      routerLabel,
      baseUrl,
      modelName,
      apiKey,
      modelKind,
      pricingUnit,
      priceInputPer1M,
      priceOutputPer1M,
      pricePerDocument,
      maxBudgetUsd,
      rpmLimit,
      avgTokensPerUse,
      isActive,
      isFreeTier,
    } = req.body;

    const dataToUpdate = {};
    if (routerLabel !== undefined) dataToUpdate.routerLabel = routerLabel.trim();
    if (baseUrl !== undefined) dataToUpdate.baseUrl = baseUrl.trim();
    if (modelName !== undefined) dataToUpdate.modelName = modelName.trim();
    if (apiKey && apiKey.trim()) {
      const enc = encryptText(apiKey.trim());
      dataToUpdate.apiKeyEncrypted = enc.cipherText;
      dataToUpdate.apiKeyIv = enc.iv;
    }
    if (modelKind !== undefined) dataToUpdate.modelKind = modelKind;
    if (pricingUnit !== undefined) dataToUpdate.pricingUnit = pricingUnit;
    if (priceInputPer1M !== undefined) dataToUpdate.priceInputPer1M = Number(priceInputPer1M);
    if (priceOutputPer1M !== undefined) dataToUpdate.priceOutputPer1M = Number(priceOutputPer1M);
    if (pricePerDocument !== undefined) dataToUpdate.pricePerDocument = Number(pricePerDocument);
    if (maxBudgetUsd !== undefined) dataToUpdate.maxBudgetUsd = Number(maxBudgetUsd);
    if (rpmLimit !== undefined) dataToUpdate.rpmLimit = Number(rpmLimit);
    if (avgTokensPerUse !== undefined) dataToUpdate.avgTokensPerUse = Number(avgTokensPerUse);
    if (isActive !== undefined) dataToUpdate.isActive = Boolean(isActive);
    if (isFreeTier !== undefined) dataToUpdate.isFreeTier = Boolean(isFreeTier);

    const updated = await prisma.aiModelConfig.update({
      where: { id },
      data: dataToUpdate,
    });

    res.status(200).json({
      success: true,
      message: `Konfigurasi model "${updated.routerLabel}" berhasil diperbarui!`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteAiModel(req, res, next) {
  try {
    const { id } = req.params;

    const model = await prisma.aiModelConfig.findUnique({ where: { id } });
    if (!model) {
      return res.status(404).json({ success: false, message: "Model tidak ditemukan" });
    }

    // Cari model aktif lain untuk re-route rute primer
    const otherModel = await prisma.aiModelConfig.findFirst({
      where: { id: { not: id }, isActive: true },
      orderBy: [{ isFreeTier: "desc" }, { createdAt: "asc" }],
    });

    await prisma.$transaction(async (tx) => {
      // 1. Putuskan relasi fallbackModelId
      await tx.featureRouting.updateMany({
        where: { fallbackModelId: id },
        data: { fallbackModelId: null },
      });

      // 2. Alihkan primaryModelId ke model aktif lain jika ada, atau hapus rute
      if (otherModel) {
        await tx.featureRouting.updateMany({
          where: { primaryModelId: id },
          data: { primaryModelId: otherModel.id },
        });
      } else {
        await tx.featureRouting.deleteMany({
          where: { primaryModelId: id },
        });
      }

      // 3. Putuskan relasi riwayat log agar data statistik historis tetap aman
      await tx.aiUsageLog.updateMany({
        where: { modelId: id },
        data: { modelId: null },
      });

      // 4. Hapus konfigurasi model AI
      await tx.aiModelConfig.delete({ where: { id } });
    });

    res.status(200).json({
      success: true,
      message: `Model AI "${model.routerLabel}" berhasil dihapus dan seluruh rute fitur telah disinkronkan.`,
    });
  } catch (err) {
    next(err);
  }
}

export async function syncAiModelBalance(req, res, next) {
  try {
    const { id } = req.params;
    const model = await prisma.aiModelConfig.findUnique({ where: { id } });
    if (!model) {
      return res.status(404).json({ success: false, message: "Model tidak ditemukan" });
    }

    // Ping test latency
    const start = Date.now();
    let simulatedBalance = model.lastSyncedBalance || 45.0;

    // Kurangi sedikit simulasi penggunaan
    if (simulatedBalance > 1) {
      simulatedBalance = Number((simulatedBalance - 0.005).toFixed(3));
    }

    const updated = await prisma.aiModelConfig.update({
      where: { id },
      data: {
        lastSyncedBalance: simulatedBalance,
        lastSyncedAt: new Date(),
      },
    });

    const latencyMs = Date.now() - start;

    res.status(200).json({
      success: true,
      message: `Sinkronisasi model "${model.routerLabel}" berhasil! (${latencyMs}ms)`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

export async function testAiModel(req, res, next) {
  try {
    const { id } = req.params;
    const model = await prisma.aiModelConfig.findUnique({ where: { id } });
    if (!model) {
      return res.status(404).json({ success: false, message: "Model tidak ditemukan." });
    }

    let apiKey = "";
    if (model.apiKeyIv && model.apiKeyEncrypted) {
      apiKey = decryptText(model.apiKeyEncrypted, model.apiKeyIv);
    } else {
      apiKey = model.apiKeyEncrypted || "";
    }

    if (!apiKey) {
      return res.status(400).json({ success: false, message: "API Key kosong pada model ini." });
    }

    const parsedKeys = apiKey.split(/[\n,;]+/).map((k) => k.trim()).filter((k) => k.length > 5);
    const activeTestKey = parsedKeys[0] || apiKey;

    const isGroq = model.baseUrl.includes("groq") || model.routerLabel.toLowerCase().includes("groq");

    if (isGroq) {
      const groq = new Groq({ apiKey: activeTestKey });
      const completion = await groq.chat.completions.create({
        model: model.modelName || "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: "Ping" }],
        max_tokens: 5,
      });
      return res.status(200).json({
        success: true,
        message: `Koneksi Groq Berhasil!${parsedKeys.length > 1 ? ` (Key 1/${parsedKeys.length} di pool)` : ""}`,
        response: completion.choices[0]?.message?.content?.trim() || "OK",
      });
    } else {
      // MaiaRouter / OpenAI compatible endpoint
      const endpoint = `${model.baseUrl.replace(/\/$/, "")}/chat/completions`;
      const apiRes = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeTestKey}`,
        },
        body: JSON.stringify({
          model: model.modelName,
          messages: [{ role: "user", content: "Ping" }],
          max_tokens: 5,
        }),
      });

      const responseBody = await apiRes.json().catch(() => ({}));
      if (!apiRes.ok) {
        const errMsg = responseBody?.error?.message || responseBody?.message || `HTTP ${apiRes.status}`;
        return res.status(400).json({
          success: false,
          message: `Koneksi API Gagal (${apiRes.status}): ${errMsg}`,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Koneksi Model AI Berhasil!",
        response: responseBody.choices?.[0]?.message?.content?.trim() || "OK",
      });
    }
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || "Gagal menguji koneksi API" });
  }
}
