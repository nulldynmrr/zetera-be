import { PrismaClient } from "@prisma/client";
import { setSecret } from "../src/services/config.service.js";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Seeding AI Engine, Billing, and Feature Routings...")  // 1. Singleton Master Exchange & Credit Settings (id = 1)
  const billingConfig = await prisma.systemBillingConfig.upsert({
    where: { id: 1 },
    update: {
      globalMultiplier: 1.35, // Margin markup 35%
      baseRateUsdIdr: 17739.0, // Kurs dasar USD ke IDR Rp 17.739
      inflationBuffer: 0.05, // Buffer inflasi 5%
      referenceCreditIdr: 500.0, // 1 kredit = Rp 500
      minCreditFloor: 1, // Minimal 1 kredit
    },
    create: {
      id: 1,
      globalMultiplier: 1.35, // Margin markup 35%
      baseRateUsdIdr: 17739.0, // Kurs dasar USD ke IDR Rp 17.739
      inflationBuffer: 0.05, // Buffer inflasi 5%
      referenceCreditIdr: 500.0, // 1 kredit = Rp 500
      minCreditFloor: 1, // Minimal 1 kredit
    },
  });
  console.log("✅ Master Exchange Setting initialized (Effective Rate:", Math.round(billingConfig.baseRateUsdIdr * (1 + billingConfig.inflationBuffer) * billingConfig.globalMultiplier), "IDR)");

  // 2. Master Model AI Configurations
  // Model 1: Groq Cloud (Free Tier)
  const groqFree = await prisma.aiModelConfig.upsert({
    where: { id: "groq-qwen-free" },
    update: {
      routerLabel: "GROQ CLOUD (Free Tier)",
      modelName: "qwen/qwen3.8-27b",
      isFreeTier: true,
      priceInputPer1M: 0.0,
      priceOutputPer1M: 0.0,
      isActive: true,
    },
    create: {
      id: "groq-qwen-free",
      routerLabel: "GROQ CLOUD (Free Tier)",
      baseUrl: "https://api.groq.com/openai/v1",
      modelName: "qwen/qwen3.8-27b",
      apiKeyEncrypted: process.env.GROQ_API_KEY || "gsk_groq_default_key",
      modelKind: "LLM",
      pricingUnit: "TOKEN",
      priceInputPer1M: 0.0,
      priceOutputPer1M: 0.0,
      maxBudgetUsd: 0.0,
      rpmLimit: 30,
      avgTokensPerUse: 1200,
      isActive: true,
      isFreeTier: true,
      lastSyncedBalance: 0.0,
    },
  });

  // Model 2: ZAI (glm-4.7-flash) [FREE]
  const zaiFlash = await prisma.aiModelConfig.upsert({
    where: { id: "zai-glm-flash" },
    update: {
      routerLabel: "ZAI (glm-4.7-flash)",
      modelName: "zai/glm-4.7-flash",
      isFreeTier: true,
      priceInputPer1M: 0.0,
      priceOutputPer1M: 0.0,
      isActive: true,
    },
    create: {
      id: "zai-glm-flash",
      routerLabel: "ZAI (glm-4.7-flash)",
      baseUrl: "https://api.maiarouter.ai/v1",
      modelName: "zai/glm-4.7-flash",
      apiKeyEncrypted: process.env.MAIAROUTER_API_KEY || "sk-maia_default_key",
      modelKind: "LLM",
      pricingUnit: "TOKEN",
      priceInputPer1M: 0.0,
      priceOutputPer1M: 0.0,
      maxBudgetUsd: 0.0,
      rpmLimit: 60,
      avgTokensPerUse: 2500,
      isActive: true,
      isFreeTier: true,
      lastSyncedBalance: 0.0,
    },
  });

  // Model 3: XAI Non-Reasoning (Fast) [PAID]
  const xaiFast = await prisma.aiModelConfig.upsert({
    where: { id: "xai-grok-fast" },
    update: {
      routerLabel: "XAI (grok-4-1-fast-non-reasoning)",
      modelName: "xai/grok-4-1-fast-non-reasoning",
      isFreeTier: false,
      priceInputPer1M: 0.20,
      priceOutputPer1M: 0.50,
      isActive: true,
    },
    create: {
      id: "xai-grok-fast",
      routerLabel: "XAI (grok-4-1-fast-non-reasoning)",
      baseUrl: "https://api.maiarouter.ai/v1",
      modelName: "xai/grok-4-1-fast-non-reasoning",
      apiKeyEncrypted: process.env.MAIAROUTER_API_KEY || "sk-maia_default_key",
      modelKind: "LLM",
      pricingUnit: "TOKEN",
      priceInputPer1M: 0.20,
      priceOutputPer1M: 0.50,
      maxBudgetUsd: 50.0,
      rpmLimit: 120,
      avgTokensPerUse: 3500,
      isActive: true,
      isFreeTier: false,
      lastSyncedBalance: 48.25,
    },
  });

  // Model 4: XAI Reasoning [PAID]
  const xaiReasoning = await prisma.aiModelConfig.upsert({
    where: { id: "xai-grok-reasoning" },
    update: {
      routerLabel: "XAI (grok-4-1-fast-reasoning)",
      modelName: "xai/grok-4-1-fast-reasoning",
      isFreeTier: false,
      priceInputPer1M: 0.50,
      priceOutputPer1M: 1.50,
      isActive: true,
    },
    create: {
      id: "xai-grok-reasoning",
      routerLabel: "XAI (grok-4-1-fast-reasoning)",
      baseUrl: "https://api.maiarouter.ai/v1",
      modelName: "xai/grok-4-1-fast-reasoning",
      apiKeyEncrypted: process.env.MAIAROUTER_API_KEY || "sk-maia_default_key",
      modelKind: "LLM",
      pricingUnit: "TOKEN",
      priceInputPer1M: 0.50,
      priceOutputPer1M: 1.50,
      maxBudgetUsd: 30.0,
      rpmLimit: 60,
      avgTokensPerUse: 5000,
      isActive: true,
      isFreeTier: false,
      lastSyncedBalance: 28.5,
    },
  });

  console.log("✅ 4 AI Models configured (Groq Free, ZAI Flash, XAI Fast, XAI Reasoning)");

  // 3. 14 Fitur Riset Skripsi Sesuai Matrix Router (Dual-Tier Free & Paid)
  const featuresList = [
    {
      code: "JOURNAL_SCREENING",
      label: "Screening & Relevansi Jurnal Otomatis",
      description: "Pemeriksaan kesesuaian jurnal terhadap topik riset saat diunggah",
      baseCreditCost: 0,
      primaryModelId: groqFree.id,
      fallbackModelId: zaiFlash.id,
    },
    {
      code: "JOURNAL_EXTRACTION",
      label: "Ekstraksi PDF Jurnal ke JSON Terstruktur",
      description: "Parsing sub-bab & nomor halaman PDF otomatis (Powered by MinerU)",
      baseCreditCost: 0,
      primaryModelId: groqFree.id,
      fallbackModelId: null, // Tanpa fallback
    },
    {
      code: "ABSTRACT_TRANSLATION",
      label: "Penerjemah Abstrak Jurnal (ID / EN)",
      description: "Subtitle dwibahasa untuk pemahaman cepat jurnal internasional",
      baseCreditCost: 1,
      primaryModelId: groqFree.id,
      fallbackModelId: xaiFast.id,
    },
    {
      code: "ANATOMI_1_JURNAL",
      label: "Bedah Anatomi 1 Jurnal (Metrik & Variabel)",
      description: "Ekstraksi metodologi, sampel, gap, dan temuan kunci per artikel",
      baseCreditCost: 2,
      primaryModelId: xaiFast.id,
      fallbackModelId: xaiReasoning.id,
    },
    {
      code: "SINTESIS_MULTI_JURNAL",
      label: "Sintesis Multi-Jurnal (Matriks Komparasi)",
      description: "Merajut keterkaitan antar 3-10 jurnal sekaligus",
      baseCreditCost: 4,
      primaryModelId: xaiFast.id,
      fallbackModelId: xaiReasoning.id,
    },
    {
      code: "BANGUN_OTOMATIS_AI",
      label: "Bangun Kerangka Berpikir AI Otomatis",
      description: "Menghasilkan relasi graf dan variabel kausalitas di kanvas",
      baseCreditCost: 2,
      primaryModelId: zaiFlash.id,
      fallbackModelId: groqFree.id,
    },
    {
      code: "RAPIHKAN_NODE",
      label: "Rapihkan & Reorganisasi Posisi Node",
      description: "Penataan tata letak kanvas kerangka pemikiran",
      baseCreditCost: 0,
      primaryModelId: zaiFlash.id,
      fallbackModelId: groqFree.id,
    },
    {
      code: "DRAFT_SKRIPSI",
      label: "Penyusunan Draf Skripsi Penuh (Bab 1, 2, 3)",
      description: "Menghasilkan naskah akademik berstandar APA 7th dan sitasi presisi",
      baseCreditCost: 8,
      primaryModelId: xaiFast.id,
      fallbackModelId: xaiReasoning.id,
    },
    {
      code: "OUTLINE_BUILDER",
      label: "Penyusun Outline & Struktur Bab Pasca-Review",
      description: "Penyesuaian bab riset berdasarkan masukan dosen pembimbing",
      baseCreditCost: 3,
      primaryModelId: xaiFast.id,
      fallbackModelId: xaiReasoning.id,
    },
    {
      code: "PROMPT_LIBRARY_RUN",
      label: "Eksekusi Custom Prompt Riset",
      description: "Menjalankan prompt kustom dari koleksi prompt library",
      baseCreditCost: 2,
      primaryModelId: zaiFlash.id,
      fallbackModelId: null,
    },
    {
      code: "OUTLINE_BLUEPRINT",
      label: "Research Blueprint Generator (Tahap 5)",
      description: "Instruksi riset komprehensif (WHAT, WHY, HOW) dan query jurnal per sub-bab",
      baseCreditCost: 4,
      primaryModelId: zaiFlash.id,
      fallbackModelId: groqFree.id,
    },
    {
      code: "TOPIC_BRAINSTORM",
      label: "Brainstorming Topik & Judul Riset (Tahap 3)",
      description: "Eksplorasi minat dan rekomendasi judul skripsi berbasis AI",
      baseCreditCost: 2,
      primaryModelId: zaiFlash.id,
      fallbackModelId: groqFree.id,
    },
    {
      code: "PROPOSAL_OUTLINE_RECOMMEND",
      label: "Rekomendasi Struktur Sub-Bab Proposal",
      description: "Penyusunan sub-bab spesifik topik untuk Bab 1, 2, dan 3",
      baseCreditCost: 3,
      primaryModelId: xaiFast.id,
      fallbackModelId: xaiReasoning.id,
    },
    {
      code: "JOURNAL_CROSS_CHECK",
      label: "Cross-Check Disiplin Ilmu & Relevansi Jurnal",
      description: "Verifikasi keselarasan jurnal terhadap topik riset skripsi",
      baseCreditCost: 1,
      primaryModelId: zaiFlash.id,
      fallbackModelId: null,
    },
  ];

  for (const item of featuresList) {
    const feat = await prisma.researchFeature.upsert({
      where: { code: item.code },
      update: {
        label: item.label,
        description: item.description,
        baseCreditCost: item.baseCreditCost,
      },
      create: {
        code: item.code,
        label: item.label,
        description: item.description,
        baseCreditCost: item.baseCreditCost,
        isActive: true,
      },
    });

    await prisma.featureRouting.upsert({
      where: { featureId: feat.id },
      update: {
        primaryModelId: item.primaryModelId,
        fallbackModelId: item.fallbackModelId,
      },
      create: {
        featureId: feat.id,
        primaryModelId: item.primaryModelId,
        fallbackModelId: item.fallbackModelId,
      },
    });
  }
  console.log("✅ 14 Academic Research Features & Routing Matrices mapped.");

  // 4. Default Credit Packages
  const packagesList = [
    {
      id: "pkg-starter",
      name: "StarterPack Riset",
      type: "ONE_TIME",
      creditsGranted: 100,
      durationDays: null,
      priceNormal: 25000,
      priceDiscount: 19000,
      badgeLabel: "HEMAT 24%",
      isActive: true,
    },
    {
      id: "pkg-student",
      name: "Student Pack (Proposal Kilat)",
      type: "ONE_TIME",
      creditsGranted: 50,
      durationDays: null,
      priceNormal: 15000,
      priceDiscount: 9900,
      badgeLabel: "TERPOPULER",
      isActive: true,
    },
    {
      id: "pkg-premium-monthly",
      name: "Premium Skripsi Unlimited (30 Hari)",
      type: "SUBSCRIPTION",
      creditsGranted: 600,
      durationDays: 30,
      priceNormal: 49000,
      priceDiscount: 35000,
      badgeLabel: "VIP UNLIMITED",
      isActive: true,
    },
  ];

  for (const pkg of packagesList) {
    await prisma.creditPackage.upsert({
      where: { id: pkg.id },
      update: pkg,
      create: pkg,
    });
  }
  console.log("✅ 3 Default Credit Packages created (StarterPack, Student Pack, Premium Monthly).");

  console.log("🎉 Seeding AI Billing & Engine successfully completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
