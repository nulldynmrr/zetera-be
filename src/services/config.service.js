import prisma from "../lib/prisma.js";
import { encryptText, decryptText } from "../lib/encryption.js";

// In-memory cache to prevent frequent database queries
const secretCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Mengambil nilai rahasia (API Key) dari Database Terenkripsi
 * Fallback otomatis ke process.env jika belum ada di database.
 */
export async function getSecret(keyName) {
  if (!keyName) return "";

  // 1. Cek memory cache
  const cached = secretCache.get(keyName);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.value;
  }

  try {
    // 2. Query dari tabel system_configs
    const config = await prisma.systemConfig.findUnique({
      where: { key: keyName },
    });

    if (config && config.value) {
      const decrypted = config.isEncrypted && config.iv
        ? decryptText(config.value, config.iv)
        : config.value;

      secretCache.set(keyName, { value: decrypted, timestamp: Date.now() });
      return decrypted;
    }
  } catch (err) {
    console.warn(`[ConfigService] Gagal membaca key "${keyName}" dari DB:`, err.message);
  }

  // 3. Fallback ke process.env
  const envVal = process.env[keyName] || "";
  if (envVal) {
    secretCache.set(keyName, { value: envVal, timestamp: Date.now() });
  }
  return envVal;
}

/**
 * Menyimpan atau memperbarui secret terenkripsi ke database
 */
export async function setSecret(keyName, plainValue, description = "") {
  if (!keyName || !plainValue) return null;

  const { cipherText, iv } = encryptText(plainValue);

  const result = await prisma.systemConfig.upsert({
    where: { key: keyName },
    create: {
      key: keyName,
      value: cipherText,
      iv: iv,
      isEncrypted: true,
      description: description || `Enkripsi key ${keyName}`,
    },
    update: {
      value: cipherText,
      iv: iv,
      isEncrypted: true,
      description: description || `Enkripsi key ${keyName}`,
    },
  });

  // Update in-memory cache
  secretCache.set(keyName, { value: plainValue, timestamp: Date.now() });
  return result;
}

export const DEFAULT_KEY_PRESETS = [
  {
    key: "MAIAROUTER_API_KEY",
    label: "MaiaRouter / Chat LLM (API Key Utama)",
    desc: "Kunci otentikasi Bearer API MaiaRouter / LLM untuk penyusunan proposal",
    defaultValue: "",
    isSecret: true,
  },
  {
    key: "EMBEDDING_API_KEY",
    label: "API Key Khusus Embedding / Vektor",
    desc: "Kunci API terpisah khusus untuk model Embedding (OpenAI / MaiaRouter / Provider lain)",
    defaultValue: "",
    isSecret: true,
  },
  {
    key: "MAIAROUTER_EMBEDDING_MODEL",
    label: "Nama Model Embedding / Vektor",
    desc: "Pilihan model untuk ekstraksi vektor & pencarian semantik sub-bab jurnal",
    defaultValue: "openai/text-embedding-3-small",
    isSecret: false,
    options: [
      "openai/text-embedding-3-small",
      "google/text-embedding-004",
      "text-embedding-3-large",
      "baai/bge-m3",
    ],
  },
  {
    key: "MAIAROUTER_CHAT_MODEL",
    label: "Nama Model Chat / Proposal Skripsi",
    desc: "Model LLM untuk penyusunan narasi proposal Bab 1, 2, 3, dan tabel matriks",
    defaultValue: "xai/grok-4-1-fast-non-reasoning",
    isSecret: false,
    options: [
      "xai/grok-4-1-fast-non-reasoning",
      "deepseek/deepseek-chat",
      "anthropic/claude-3-5-sonnet",
      "meta/llama-3.3-70b",
      "openai/gpt-4o-mini",
    ],
  },
  {
    key: "EMBEDDING_BASE_URL",
    label: "Base URL Khusus Endpoint Embedding (Opsional)",
    desc: "Endpoint dasar khusus API embedding jika berbeda dari server chat (default: https://api.maiarouter.ai/v1)",
    defaultValue: "https://api.openai.com/v1",
    isSecret: false,
  },
  {
    key: "MAIAROUTER_BASE_URL",
    label: "MaiaRouter (Base URL Endpoint Chat)",
    desc: "Endpoint dasar router API MaiaRouter (default: https://api.maiarouter.ai/v1)",
    defaultValue: "https://api.maiarouter.ai/v1",
    isSecret: false,
  },
  {
    key: "GROQ_API_KEY_FRAMEWORK_RELASI",
    label: "Groq (Rekomendasi Relasi Node)",
    desc: "Digunakan untuk rekomendasi relasi cerdas antar node kerangka berpikir",
    defaultValue: "",
    isSecret: true,
  },
  {
    key: "GROQ_API_KEY_SCREENING",
    label: "Groq (AI Screening & Relevansi)",
    desc: "Digunakan khusus untuk screening otomatis jurnal, ekstraksi metodologi, dan penilaian kelayakan",
    defaultValue: "",
    isSecret: true,
  },
  {
    key: "GROQ_API_KEY_FRAMEWORK_CROSS_CHECK_JURNAL",
    label: "Groq (Cross-Check & Telaah Silang Jurnal)",
    desc: "Digunakan untuk validasi silang bukti empiris dan intisari artikel jurnal",
    defaultValue: "",
    isSecret: true,
  },
  {
    key: "GROQ_API_KEY_FRAMEWORK_GENARATE_NODE",
    label: "Groq (Sintesis & Bangun Node)",
    desc: "Digunakan untuk sintesis otomatis pohon kerangka dan perangkuman kutipan verbatim",
    defaultValue: "",
    isSecret: true,
  },
  {
    key: "GROQ_API_KEY",
    label: "Groq (Master Fallback API Key)",
    desc: "Kunci API fallback utama untuk seluruh fitur Groq (Proposal AI Co-Writer, Outline Suggest, Screening)",
    defaultValue: "",
    isSecret: true,
  },
  {
    key: "ACADEMIC_POLITE_EMAIL",
    label: "Email Polite Pool Akademik",
    desc: "Email kontak untuk OpenAlex, Crossref, Unpaywall & Retraction Watch agar mendapat kuota API lebih tinggi",
    defaultValue: "admin@zetera.id",
    isSecret: false,
  },
  {
    key: "MINERU_PATH",
    label: "Path Binary MinerU Parser (Opsional)",
    desc: "Path kustom ke executable mineru CLI (contoh: C:\\Users\\...\\mineru.exe). Kosongkan jika ingin auto-detect atau gunakan parser internal",
    defaultValue: "",
    isSecret: false,
  },
  {
    key: "GROBID_URL",
    label: "GROBID Server URL (Opsional)",
    desc: "URL instance GROBID parser jurnal jika dijalankan via Docker (contoh: http://localhost:8070)",
    defaultValue: "http://localhost:8070",
    isSecret: false,
  },
  {
    key: "SEMANTIC_SCHOLAR_API_KEY",
    label: "Semantic Scholar API Key (Opsional)",
    desc: "Kunci API resmi Semantic Scholar untuk menaikkan rate-limit pencarian jurnal",
    defaultValue: "",
    isSecret: true,
  },
  {
    key: "CORE_API_KEY",
    label: "CORE Academic API Key (Opsional)",
    desc: "Kunci API repositori CORE UK untuk pencarian open access",
    defaultValue: "",
    isSecret: true,
  },
  {
    key: "DEEPSEEK_API_KEY",
    label: "DeepSeek (Draf Proposal & Skripsi)",
    desc: "Model penalaran mendalam untuk penyusunan narasi Bab 1, 2, 3, dan tabel matriks",
    defaultValue: "",
    isSecret: true,
  },
  {
    key: "GEMINI_API_KEY",
    label: "Google Gemini (Embeddings & RAG)",
    desc: "Digunakan untuk text-embedding-004 dan pencarian semantik dokumen",
    defaultValue: "",
    isSecret: true,
  },
  {
    key: "OPENAI_API_KEY",
    label: "OpenAI (Fallback LLM & Embeddings)",
    desc: "Digunakan untuk text-embedding-3-small dan GPT-4o Mini fallback",
    defaultValue: "",
    isSecret: true,
  },
];

/**
 * Mengambil template preset konfigurasi dari database
 */
export async function getKeyPresets() {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: "_SYSTEM_KEY_PRESETS" },
    });

    if (config && config.value) {
      try {
        return JSON.parse(config.value);
      } catch (e) {
        console.warn("Gagal parse JSON presets dari DB:", e.message);
      }
    }

    // Simpan default presets ke database jika belum ada
    await prisma.systemConfig.upsert({
      where: { key: "_SYSTEM_KEY_PRESETS" },
      create: {
        key: "_SYSTEM_KEY_PRESETS",
        value: JSON.stringify(DEFAULT_KEY_PRESETS, null, 2),
        isEncrypted: false,
        description: "Template Preset Daftar API Key dan Model AI",
      },
      update: {
        value: JSON.stringify(DEFAULT_KEY_PRESETS, null, 2),
        isEncrypted: false,
        description: "Template Preset Daftar API Key dan Model AI",
      },
    });

    return DEFAULT_KEY_PRESETS;
  } catch (err) {
    console.warn("Database query error in getKeyPresets:", err.message);
    return DEFAULT_KEY_PRESETS;
  }
}

/**
 * Inisialisasi seeding otomatis API key dari .env / default ke Database Terenkripsi saat server boot
 */
export async function initDefaultSecrets() {
  const keysToSync = [
    {
      key: "GROQ_API_KEY_FRAMEWORK_RELASI",
      desc: "API Key Groq untuk rekomendasi relasi cerdas antar node",
    },
    {
      key: "GROQ_API_KEY_SCREENING",
      desc: "API Key Groq untuk screening otomatis dan analisis relevansi jurnal",
    },
    {
      key: "GROQ_API_KEY_FRAMEWORK_CROSS_CHECK_JURNAL",
      desc: "API Key Groq untuk telaah silang bukti & intisari jurnal",
    },
    {
      key: "GROQ_API_KEY_FRAMEWORK_GENARATE_NODE",
      desc: "API Key Groq untuk sintesis dan pembangunan node kerangka berpikir otomatis",
    },
    {
      key: "GROQ_API_KEY",
      desc: "Master fallback API key Groq",
    },
    {
      key: "ACADEMIC_POLITE_EMAIL",
      desc: "Email polite pool untuk OpenAlex, Crossref, Unpaywall & Retraction Watch",
    },
    {
      key: "MINERU_PATH",
      desc: "Path binary mineru CLI jika menggunakan instalasi kustom",
    },
    {
      key: "GROBID_URL",
      desc: "URL instance GROBID parser jurnal",
    },
    {
      key: "SEMANTIC_SCHOLAR_API_KEY",
      desc: "API key Semantic Scholar untuk peningkatan kuota",
    },
    {
      key: "CORE_API_KEY",
      desc: "API key CORE repository",
    },
    {
      key: "MAIAROUTER_API_KEY",
      desc: "API Key Bearer untuk endpoint Maiarouter AI",
    },
    {
      key: "EMBEDDING_API_KEY",
      desc: "API Key khusus untuk model Embedding / Vektor",
    },
    {
      key: "MAIAROUTER_BASE_URL",
      desc: "Base URL Maiarouter AI (default: https://api.maiarouter.ai/v1)",
    },
    {
      key: "MAIAROUTER_EMBEDDING_MODEL",
      desc: "Model Embedding Maiarouter (default: openai/text-embedding-3-small)",
    },
    {
      key: "MAIAROUTER_CHAT_MODEL",
      desc: "Model LLM Chat/Reasoning Maiarouter (default: xai/grok-4-1-fast-non-reasoning)",
    },
  ];

  // Seed default presets
  await getKeyPresets();

  for (const item of keysToSync) {
    try {
      const existing = await prisma.systemConfig.findUnique({ where: { key: item.key } });
      const envVal = process.env[item.key] || (item.key.startsWith("GROQ_") ? process.env.GROQ_API_KEY : "");
      
      if (!existing && envVal) {
        await setSecret(item.key, envVal, item.desc);
        console.log(`✓ [ConfigService] Mengenkripsi & menyimpan "${item.key}" ke Database.`);
      }
    } catch (err) {
      console.warn(`[ConfigService] Warning sync default key ${item.key}:`, err.message);
    }
  }
}
