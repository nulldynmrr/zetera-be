import prisma from "../../lib/prisma.js";
import { setSecret, getSecret, getKeyPresets } from "../../services/config.service.js";
import { encryptText } from "../../lib/encryption.js";
import { Groq } from "groq-sdk";

/**
 * Legacy Database Secrets APIs & cURL Importer
 */
export async function getAdminConfigs(req, res, next) {
  try {
    const allConfigs = await prisma.systemConfig.findMany({
      orderBy: { key: "asc" },
    });
    const configs = allConfigs.filter((c) => !c.key.startsWith("_"));

    const maskedConfigs = [];
    for (const c of configs) {
      const decrypted = await getSecret(c.key);
      const isSecret = !c.key.includes("MODEL") && !c.key.includes("URL") && !c.key.includes("BASE");
      const masked = decrypted
        ? isSecret
          ? `${decrypted.slice(0, 8)}...${decrypted.slice(-4)}`
          : decrypted
        : "(Kosong)";

      maskedConfigs.push({
        id: c.id,
        key: c.key,
        description: c.description || "",
        maskedValue: masked,
        isEncrypted: c.isEncrypted,
        updatedAt: c.updatedAt,
      });
    }

    res.status(200).json({
      success: true,
      data: maskedConfigs,
    });
  } catch (err) {
    next(err);
  }
}

export async function importFromCurl(req, res, next) {
  try {
    const { curlText } = req.body;
    if (!curlText || typeof curlText !== "string") {
      const err = new Error("Teks cURL tidak boleh kosong.");
      err.statusCode = 400;
      throw err;
    }

    const urlMatch = curlText.match(/https?:\/\/[^\s"'\\]+/);
    const fullUrl = urlMatch ? urlMatch[0] : "";
    const authMatch =
      curlText.match(/Bearer\s+([^\s"'\\]+)/i) ||
      curlText.match(/"Authorization":\s*"Bearer\s+([^"\\]+)"/i);
    const apiKey = authMatch ? authMatch[1].trim() : "";

    let model = "";
    const modelMatch = curlText.match(/"model":\s*"([^"]+)"/);
    if (modelMatch) model = modelMatch[1].trim();

    if (!fullUrl && !apiKey && !model) {
      throw new Error("Gagal membaca struktur cURL. Pastikan format cURL valid.");
    }

    const isEmbedding = fullUrl.includes("embeddings") || (model && model.includes("embedding"));

    let baseUrl = "";
    if (fullUrl) {
      try {
        const parsedUrl = new URL(fullUrl);
        baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname.replace(/\/(chat\/completions|embeddings)$/, "")}`;
      } catch (e) {
        baseUrl = fullUrl.replace(/\/(chat\/completions|embeddings)$/, "");
      }
    }

    // 1. Simpan ke SystemConfig (Legacy Key-Value)
    if (isEmbedding) {
      if (apiKey) await setSecret("EMBEDDING_API_KEY", apiKey, "API Key Khusus untuk Model Embedding");
      if (model) await setSecret("MAIAROUTER_EMBEDDING_MODEL", model, "Nama Model Embedding");
      if (baseUrl) await setSecret("MAIAROUTER_BASE_URL", baseUrl, "Base URL Router Endpoint");
    } else {
      if (apiKey) await setSecret("MAIAROUTER_API_KEY", apiKey, "API Key Bearer untuk Chat LLM");
      if (model) await setSecret("MAIAROUTER_CHAT_MODEL", model, "Nama Model Chat Proposal");
      if (baseUrl) await setSecret("MAIAROUTER_BASE_URL", baseUrl, "Base URL Router Endpoint");
    }

    // 2. Buat atau update kartu AiModelConfig agar muncul di daftar "Konfigurasi Model Aktif"
    let modelConfigRecord = null;
    if (model) {
      let cipherText = "";
      let iv = "";
      if (apiKey) {
        const enc = encryptText(apiKey);
        cipherText = enc.cipherText;
        iv = enc.iv;
      }

      const routerLabel = model.includes("/")
        ? `${model.split("/")[0].toUpperCase()} (${model.split("/")[1]})`
        : `Model (${model})`;

      const existingModel = await prisma.aiModelConfig.findFirst({
        where: { modelName: model },
      });

      if (existingModel) {
        modelConfigRecord = await prisma.aiModelConfig.update({
          where: { id: existingModel.id },
          data: {
            baseUrl: baseUrl || existingModel.baseUrl,
            ...(apiKey && { apiKeyEncrypted: cipherText, apiKeyIv: iv }),
            isActive: true,
          },
        });
      } else {
        modelConfigRecord = await prisma.aiModelConfig.create({
          data: {
            routerLabel,
            baseUrl: baseUrl || "https://api.maiarouter.ai/v1",
            modelName: model,
            apiKeyEncrypted: cipherText,
            apiKeyIv: iv,
            modelKind: isEmbedding ? "EMBEDDING" : "LLM",
            pricingUnit: "TOKEN",
            priceInputPer1M: 0.25,
            priceOutputPer1M: 0.85,
            pricePerDocument: 0.0,
            maxBudgetUsd: 50.0,
            rpmLimit: 60,
            avgTokensPerUse: 1500,
            isActive: true,
            isFreeTier: false,
          },
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Berhasil mengimpor model "${model || "Baru"}" ke Konfigurasi Model Aktif!`,
      data: {
        isEmbedding,
        baseUrl,
        model,
        hasApiKey: Boolean(apiKey),
        modelConfig: modelConfigRecord,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getAdminPresets(req, res, next) {
  try {
    const presets = await getKeyPresets();
    res.status(200).json({ success: true, data: presets });
  } catch (err) {
    next(err);
  }
}

export async function updateAdminConfig(req, res, next) {
  try {
    const { key, value, description } = req.body;
    if (!key || !value) {
      const err = new Error("Key dan Value wajib diisi");
      err.statusCode = 400;
      throw err;
    }
    await setSecret(key.trim(), value.trim(), description || "");
    res.status(200).json({
      success: true,
      message: `API Key "${key}" berhasil dienkripsi (AES-256) dan disimpan ke database.`,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteAdminConfig(req, res, next) {
  try {
    const { key } = req.params;
    const deleted = await prisma.systemConfig.deleteMany({
      where: { key: decodeURIComponent(key) },
    });
    if (deleted.count === 0) {
      return res.status(404).json({ success: false, message: `Key "${key}" tidak ditemukan.` });
    }
    res.status(200).json({ success: true, message: `Key "${key}" berhasil dihapus.` });
  } catch (err) {
    next(err);
  }
}

export async function testGroqConnection(req, res, next) {
  try {
    const { keyName } = req.body;
    const apiKey = await getSecret(keyName || "GROQ_API_KEY_FRAMEWORK_RELASI");

    if (!apiKey) {
      return res.status(400).json({ success: false, message: `Key "${keyName}" tidak ditemukan.` });
    }

    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: "qwen/qwen3.8-27b",
      messages: [{ role: "user", content: "Ping: response with 'OK'" }],
      max_tokens: 10,
    });

    res.status(200).json({
      success: true,
      message: "Koneksi API Groq Berhasil & Valid!",
      response: completion.choices[0]?.message?.content?.trim(),
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: "Koneksi API Gagal: " + err.message,
    });
  }
}
