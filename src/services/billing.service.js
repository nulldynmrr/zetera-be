import prisma from "../lib/prisma.js";
import { getSecret } from "./config.service.js";

/**
 * ── Billing Engine Service ──────────────────────────────────────────────
 * Menangani kurs mata uang, perhitungan unit cost per model, verifikasi saldo
 * atomic, settling log transaksi telemetri, dan simulator paket ideal.
 * ────────────────────────────────────────────────────────────────────────
 */

/**
 * Mengambil singleton SystemBillingConfig (id = 1)
 */
export async function getBillingConfig() {
  let config = await prisma.systemBillingConfig.findUnique({
    where: { id: 1 },
  });

  if (!config) {
    config = await prisma.systemBillingConfig.create({
      data: {
        id: 1,
        globalMultiplier: 1.35,
        baseRateUsdIdr: 16500.0,
        inflationBuffer: 0.05,
        referenceCreditIdr: 500.0,
        minCreditFloor: 1,
      },
    });
  }

  const effectiveRateUsdIdr =
    config.baseRateUsdIdr * (1 + config.inflationBuffer) * config.globalMultiplier;

  return {
    ...config,
    effectiveRateUsdIdr: Math.round(effectiveRateUsdIdr),
  };
}

/**
 * Memperbarui singleton SystemBillingConfig
 */
export async function updateBillingConfig(data) {
  const { globalMultiplier, baseRateUsdIdr, inflationBuffer, referenceCreditIdr, minCreditFloor } = data;

  const updated = await prisma.systemBillingConfig.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      globalMultiplier: Number(globalMultiplier) || 1.35,
      baseRateUsdIdr: Number(baseRateUsdIdr) || 16500.0,
      inflationBuffer: Number(inflationBuffer) || 0.05,
      referenceCreditIdr: Number(referenceCreditIdr) || 500.0,
      minCreditFloor: minCreditFloor !== undefined ? Number(minCreditFloor) : 1,
    },
    update: {
      ...(globalMultiplier !== undefined && { globalMultiplier: Number(globalMultiplier) }),
      ...(baseRateUsdIdr !== undefined && { baseRateUsdIdr: Number(baseRateUsdIdr) }),
      ...(inflationBuffer !== undefined && { inflationBuffer: Number(inflationBuffer) }),
      ...(referenceCreditIdr !== undefined && { referenceCreditIdr: Number(referenceCreditIdr) }),
      ...(minCreditFloor !== undefined && { minCreditFloor: Number(minCreditFloor) }),
    },
  });

  const effectiveRateUsdIdr =
    updated.baseRateUsdIdr * (1 + updated.inflationBuffer) * updated.globalMultiplier;

  return {
    ...updated,
    effectiveRateUsdIdr: Math.round(effectiveRateUsdIdr),
  };
}

/**
 * Mengestimasi biaya kredit untuk pemanggilan fitur tertentu
 * @param {string} featureCode
 * @param {number} estimatedTokens
 * @param {string} [userId]
 */
export async function estimateCreditCost(featureCode, estimatedTokens = 1200, userId = null) {
  const feature = await prisma.researchFeature.findUnique({
    where: { code: featureCode },
    include: {
      routing: {
        include: { primaryModel: true },
      },
    },
  });

  if (!feature) {
    throw new Error(`Fitur riset dengan kode "${featureCode}" tidak ditemukan.`);
  }

  const primaryModel = feature.routing?.primaryModel;

  // Jika tidak ada model atau model berstatus Free-Tier (misal Groq $0)
  if (!primaryModel || primaryModel.isFreeTier) {
    return {
      isFreeTier: true,
      estimatedCredits: 0,
      baseCreditCost: feature.baseCreditCost || 0,
      model: primaryModel ? primaryModel.modelName : "Groq Free",
      featureLabel: feature.label,
    };
  }

  const billingConfig = await getBillingConfig();

  // Hitung modal USD mentah
  const inTokens = Math.round(estimatedTokens * 0.4);
  const outTokens = Math.round(estimatedTokens * 0.6);
  const rawCostUsd =
    (inTokens / 1_000_000) * primaryModel.priceInputPer1M +
    (outTokens / 1_000_000) * primaryModel.priceOutputPer1M;

  // Konversi ke IDR menggunakan kurs efektif
  const costIdr = rawCostUsd * billingConfig.effectiveRateUsdIdr;

  // Konversi ke satuan kredit (menggunakan referenceCreditIdr atau rasio paket)
  let creditValueIdr = billingConfig.referenceCreditIdr || 500;
  if (userId) {
    const activeBalance = await prisma.userCreditBalance.findFirst({
      where: { userId, creditsRemaining: { gt: 0 } },
      include: { package: true },
      orderBy: { purchasedAt: "desc" },
    });
    if (activeBalance?.package && activeBalance.package.creditsGranted > 0) {
      creditValueIdr = activeBalance.package.priceNormal / activeBalance.package.creditsGranted;
    }
  }

  const tokenCredits = Math.ceil(costIdr / creditValueIdr);
  let totalCredits = (feature.baseCreditCost || 0) + tokenCredits;

  if (billingConfig.minCreditFloor > 0 && totalCredits < billingConfig.minCreditFloor) {
    totalCredits = billingConfig.minCreditFloor;
  }

  return {
    isFreeTier: false,
    estimatedCredits: totalCredits,
    baseCreditCost: feature.baseCreditCost || 0,
    costUsd: rawCostUsd,
    costIdr: Math.round(costIdr),
    model: primaryModel.modelName,
    featureLabel: feature.label,
  };
}

/**
 * Memverifikasi kecukupan saldo kredit user secara atomic sebelum AI dieksekusi
 */
export async function verifyBalance(userId, requiredCredits = 0) {
  if (requiredCredits <= 0) {
    return { success: true, currentBalance: 0, requiredCredits: 0 };
  }
  if (!userId) {
    const err = new Error("Autentikasi akun diperlukan untuk menggunakan fitur AI berbayar ini.");
    err.statusCode = 401;
    throw err;
  }

  const totalRemaining = await prisma.userCreditBalance.aggregate({
    where: { userId },
    _sum: { creditsRemaining: true },
  });

  const currentBalance = totalRemaining._sum.creditsRemaining || 0;
  if (currentBalance < requiredCredits) {
    const err = new Error(
      `Saldo kredit riset tidak mencukupi. Diperlukan minimal ${requiredCredits} kredit, saldo Anda saat ini: ${currentBalance} kredit. Silakan top up kredit Anda.`
    );
    err.statusCode = 402;
    err.details = { requiredCredits, currentBalance };
    throw err;
  }

  return { success: true, currentBalance, requiredCredits };
}

/**
 * Mencatat transaksi kredit manual/programatik ke ledger audit credit_transactions
 */
export async function recordCreditTransaction({
  userId,
  type,
  amount,
  description,
  refId = null,
  tx = prisma,
}) {
  const userBal = await tx.userCreditBalance.aggregate({
    where: { userId },
    _sum: { creditsRemaining: true },
  });
  const balanceAfter = userBal._sum.creditsRemaining || 0;

  return await tx.creditTransaction.create({
    data: {
      userId,
      type,
      amount,
      balanceAfter,
      description: description || `Transaksi kredit ${type}`,
      refId,
    },
  });
}

/**
 * Menyelesaikan (settle) pemakaian AI setelah pemanggilan API selesai
 * 1. Mengurangi saldo user secara atomic FIFO (jika paid tier)
 * 2. Mencatat log telemetri AI lengkap
 * 3. Menulis entri audit buku besar (credit_transactions) secara konsisten
 */
export async function settleActualUsage({
  userId,
  featureCode,
  modelId,
  inputTokens = 0,
  outputTokens = 0,
  responseTimeMs = 0,
  statusCode = 200,
  customCostUsd = null,
}) {
  const feature = featureCode
    ? await prisma.researchFeature.findUnique({ where: { code: featureCode } })
    : null;

  const model = modelId
    ? await prisma.aiModelConfig.findUnique({ where: { id: modelId } })
    : null;

  const isFreeTier = model ? model.isFreeTier : false;
  const billingConfig = await getBillingConfig();

  // Hitung modal USD
  let costUsd = 0;
  if (customCostUsd !== null) {
    costUsd = Number(customCostUsd);
  } else if (model && !model.isFreeTier) {
    costUsd =
      (inputTokens / 1_000_000) * (model.priceInputPer1M || 0) +
      (outputTokens / 1_000_000) * (model.priceOutputPer1M || 0);
  }

  const rawCostIdr = costUsd * billingConfig.baseRateUsdIdr;
  const chargeIdr = costUsd * billingConfig.effectiveRateUsdIdr;
  const chargeUsd = costUsd * (1 + billingConfig.inflationBuffer) * billingConfig.globalMultiplier;
  const profitUsd = Math.max(0, chargeUsd - costUsd);

  // Hitung kredit yang dipotong
  let creditsToDeduct = 0;
  if (!isFreeTier && costUsd > 0) {
    const creditValueIdr = billingConfig.referenceCreditIdr || 500;
    const tokenCredits = Math.ceil(chargeIdr / creditValueIdr);
    creditsToDeduct = (feature?.baseCreditCost || 0) + tokenCredits;

    if (billingConfig.minCreditFloor > 0 && creditsToDeduct < billingConfig.minCreditFloor) {
      creditsToDeduct = billingConfig.minCreditFloor;
    }
  }

  // Atomic DB transaction
  return await prisma.$transaction(async (tx) => {
    let actualDeducted = 0;

    // 1. Deduct balance jika bukan free-tier dan ada user
    if (!isFreeTier && creditsToDeduct > 0 && userId) {
      // Ambil saldo yang aktif secara FIFO
      const activeBalances = await tx.userCreditBalance.findMany({
        where: { userId, creditsRemaining: { gt: 0 } },
        orderBy: { purchasedAt: "asc" },
      });

      let remainingToDeduct = creditsToDeduct;
      for (const bal of activeBalances) {
        if (remainingToDeduct <= 0) break;
        const deductFromThis = Math.min(bal.creditsRemaining, remainingToDeduct);
        await tx.userCreditBalance.update({
          where: { id: bal.id },
          data: { creditsRemaining: bal.creditsRemaining - deductFromThis },
        });
        remainingToDeduct -= deductFromThis;
        actualDeducted += deductFromThis;
      }
    }

    // 2. Insert Usage Log
    const log = await tx.aiUsageLog.create({
      data: {
        userId: userId || null,
        featureId: feature?.id || null,
        modelId: model?.id || null,
        inputTokens,
        outputTokens,
        costUsd,
        costIdr: Math.round(rawCostIdr),
        chargeUser: chargeUsd,
        creditsCharged: isFreeTier ? 0 : actualDeducted,
        profitUsd,
        isFreeTierCall: isFreeTier,
        responseTimeMs,
        statusCode,
      },
    });

    // 3. Tulis audit trail ke CreditTransaction jika ada kredit yang terpotong
    if (!isFreeTier && actualDeducted > 0 && userId) {
      const userBal = await tx.userCreditBalance.aggregate({
        where: { userId },
        _sum: { creditsRemaining: true },
      });
      const balanceAfter = userBal._sum.creditsRemaining || 0;

      await tx.creditTransaction.create({
        data: {
          userId,
          type: "USAGE",
          amount: -actualDeducted,
          balanceAfter,
          description: `Pemakaian AI: ${feature?.label || featureCode || "Fitur Riset"} (${model?.modelName || "LLM"})`,
          refId: log.id,
        },
      });
    }

    return log;
  });
}

/**
 * Simulator Kalkulator Paket Ideal (Ideal Credit & Margin Calculator)
 */
export async function calculateIdealPackage({
  modelId,
  selectedFeatureCodes = [],
  targetMargin = 0.4, // 40% margin
  expectedGenerationsPerMonth = 30,
}) {
  const billingConfig = await getBillingConfig();
  const model = modelId
    ? await prisma.aiModelConfig.findUnique({ where: { id: modelId } })
    : await prisma.aiModelConfig.findFirst({ where: { isActive: true, isFreeTier: false } });

  const features = await prisma.researchFeature.findMany({
    where: {
      code: { in: selectedFeatureCodes.length > 0 ? selectedFeatureCodes : ["DRAFT_SKRIPSI", "SINTESIS_MULTI_JURNAL"] },
    },
  });

  // Rata-rata token per fitur
  const avgTokensPerFeature = model?.avgTokensPerUse || 2500;
  const inTokens = Math.round(avgTokensPerFeature * 0.35);
  const outTokens = Math.round(avgTokensPerFeature * 0.65);

  const costPerUseUsd = model
    ? (inTokens / 1_000_000) * model.priceInputPer1M + (outTokens / 1_000_000) * model.priceOutputPer1M
    : 0.002;

  const totalMonthlyCostUsd = costPerUseUsd * expectedGenerationsPerMonth;
  const rawHppIdr = totalMonthlyCostUsd * billingConfig.baseRateUsdIdr * (1 + billingConfig.inflationBuffer);

  // Harga jual yang disarankan berdasarkan target margin
  const suggestedPriceIdr = Math.ceil((rawHppIdr / (1 - targetMargin)) / 1000) * 1000;
  const recommendedCredits = expectedGenerationsPerMonth * 10;
  const pricePerCredit = suggestedPriceIdr / recommendedCredits;

  return {
    modelUsed: model?.modelName || "Standard Paid LLM",
    estimatedCostPerCallUsd: costPerUseUsd,
    totalHppIdr: Math.round(rawHppIdr),
    suggestedPriceIdr,
    recommendedCredits,
    pricePerCredit: Math.round(pricePerCredit),
    effectiveMarginPercent: Math.round(((suggestedPriceIdr - rawHppIdr) / suggestedPriceIdr) * 100),
    featuresIncluded: features.map((f) => f.label),
  };
}
