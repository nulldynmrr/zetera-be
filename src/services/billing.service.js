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
 * Pencatatan Anomali & Deteksi Angka Fraud ke Database
 */
export async function recordFraudAlert({ userId = null, reason, severity = "MEDIUM", ipAddress = null, metadata = null }) {
  try {
    return await prisma.fraudAlertLog.create({
      data: {
        userId: userId || null,
        reason,
        severity,
        ipAddress: ipAddress || null,
        metadata: metadata ? metadata : undefined,
      },
    });
  } catch (err) {
    console.error("[FRAUD-DETECTION] Gagal mencatat alert fraud:", err.message);
    return null;
  }
}

/**
 * 1. Pre-Flight Atomic Credit Hold (Anti Race-Condition & Anti-Fraud)
 * Memastikan kredit dikurangi terlebih dahulu sebelum request dikirim ke Maia Router
 * Jika user membuka 10 tab sekaligus, request ke-2 dan seterusnya akan gagal atomik jika saldo habis.
 */
export async function reserveCredits(userId, requiredCredits = 0) {
  if (requiredCredits <= 0) {
    return { success: true, reservedCredits: 0 };
  }
  if (!userId) {
    const err = new Error("Autentikasi akun diperlukan untuk menggunakan fitur AI berbayar ini.");
    err.statusCode = 401;
    throw err;
  }

  // Admin akun bypass
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (user?.role === "ADMIN") {
    return { success: true, reservedCredits: 0, isAdmin: true };
  }

  return await prisma.$transaction(async (tx) => {
    // Pengecekan saldo atomik
    const totalRemaining = await tx.userCreditBalance.aggregate({
      where: { userId },
      _sum: { creditsRemaining: true },
    });

    const currentBalance = totalRemaining._sum.creditsRemaining || 0;
    if (currentBalance < requiredCredits) {
      // Catat potensi percobaan penipuan (insufficient balance abuse)
      await recordFraudAlert({
        userId,
        reason: `Percobaan konsumsi AI melebihi saldo (${currentBalance} koin tersedia, ${requiredCredits} dibutuhkan)`,
        severity: "LOW",
        metadata: { currentBalance, requiredCredits },
      });

      const err = new Error(
        `Saldo kredit riset tidak mencukupi. Diperlukan minimal ${requiredCredits} kredit, saldo Anda saat ini: ${currentBalance} kredit. Silakan top up kredit Anda.`
      );
      err.statusCode = 402;
      err.details = { requiredCredits, currentBalance };
      throw err;
    }

    // Ambil saldo aktif secara FIFO dan potong reservasi sementara
    const activeBalances = await tx.userCreditBalance.findMany({
      where: { userId, creditsRemaining: { gt: 0 } },
      orderBy: { purchasedAt: "asc" },
    });

    let remainingToHold = requiredCredits;
    for (const bal of activeBalances) {
      if (remainingToHold <= 0) break;
      const deductFromThis = Math.min(bal.creditsRemaining, remainingToHold);
      await tx.userCreditBalance.update({
        where: { id: bal.id },
        data: { creditsRemaining: bal.creditsRemaining - deductFromThis },
      });
      remainingToHold -= deductFromThis;
    }

    return { success: true, reservedCredits: requiredCredits, currentBalance: currentBalance - requiredCredits };
  });
}

/**
 * Pengembalian Saldo jika AI Error / Gagal (Atomic Refund)
 */
export async function refundReservedCredits(userId, creditsToRefund = 0, reason = "Pengembalian otomatis") {
  if (!userId || creditsToRefund <= 0) return;

  try {
    await prisma.$transaction(async (tx) => {
      // Cari saldo aktif terakhir atau buat baru jika tidak ada
      const latestBalance = await tx.userCreditBalance.findFirst({
        where: { userId },
        orderBy: { purchasedAt: "desc" },
      });

      if (latestBalance) {
        await tx.userCreditBalance.update({
          where: { id: latestBalance.id },
          data: { creditsRemaining: latestBalance.creditsRemaining + creditsToRefund },
        });
      } else {
        await tx.userCreditBalance.create({
          data: {
            userId,
            creditsPurchased: creditsToRefund,
            creditsRemaining: creditsToRefund,
          },
        });
      }

      const totalRemaining = await tx.userCreditBalance.aggregate({
        where: { userId },
        _sum: { creditsRemaining: true },
      });
      const balanceAfter = totalRemaining._sum.creditsRemaining || 0;

      await tx.creditTransaction.create({
        data: {
          userId,
          type: "REFUND",
          category: "REFUND",
          amount: creditsToRefund,
          balanceAfter,
          description: reason,
        },
      });
    });
  } catch (err) {
    console.error("[BILLING-REFUND] Gagal refund kredit reservasi:", err.message);
  }
}

/**
 * Memverifikasi kecukupan saldo kredit user
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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (user?.role === "ADMIN") {
    return { success: true, currentBalance: 999999, requiredCredits, isAdmin: true };
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
      category: "REGULAR_PURCHASE",
      amount,
      balanceAfter,
      description: description || `Transaksi kredit ${type}`,
      refId,
    },
  });
}

/**
 * Menyelesaikan (settle) pemakaian AI setelah pemanggilan API selesai
 * Menghitung pemakaian token riil, rekonsiliasi terhadap reservedCredits, mencatat log dan buku besar
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
  reservedCredits = 0,
}) {
  const feature = featureCode
    ? await prisma.researchFeature.findUnique({ where: { code: featureCode } })
    : null;

  const model = modelId
    ? await prisma.aiModelConfig.findUnique({ where: { id: modelId } })
    : null;

  const isFreeTier = model ? model.isFreeTier : false;
  const billingConfig = await getBillingConfig();

  // 1. Hitung modal riil USD berdasarkan input & output token dari provider
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

  // 2. Hitung jumlah kredit final yang seharusnya dibayar user
  let finalCreditsNeeded = 0;
  if (!isFreeTier && costUsd > 0) {
    const creditValueIdr = billingConfig.referenceCreditIdr || 500;
    const tokenCredits = Math.ceil(chargeIdr / creditValueIdr);
    finalCreditsNeeded = (feature?.baseCreditCost || 0) + tokenCredits;

    if (billingConfig.minCreditFloor > 0 && finalCreditsNeeded < billingConfig.minCreditFloor) {
      finalCreditsNeeded = billingConfig.minCreditFloor;
    }
  }

  // 3. Rekonsiliasi atomik di database
  return await prisma.$transaction(async (tx) => {
    let actualDeducted = 0;

    if (!isFreeTier && userId) {
      if (reservedCredits > 0) {
        if (finalCreditsNeeded < reservedCredits) {
          // Refund selisih lebih reservasi kembali ke saldo user
          const refundAmount = reservedCredits - finalCreditsNeeded;
          const latestBal = await tx.userCreditBalance.findFirst({
            where: { userId },
            orderBy: { purchasedAt: "desc" },
          });
          if (latestBal) {
            await tx.userCreditBalance.update({
              where: { id: latestBal.id },
              data: { creditsRemaining: latestBal.creditsRemaining + refundAmount },
            });
          }
          actualDeducted = finalCreditsNeeded;
        } else if (finalCreditsNeeded > reservedCredits) {
          // Kurangi selisih kekurangan jika pemakaian token melebihi estimasi
          const extraToDeduct = finalCreditsNeeded - reservedCredits;
          const activeBalances = await tx.userCreditBalance.findMany({
            where: { userId, creditsRemaining: { gt: 0 } },
            orderBy: { purchasedAt: "asc" },
          });
          let remaining = extraToDeduct;
          for (const bal of activeBalances) {
            if (remaining <= 0) break;
            const dec = Math.min(bal.creditsRemaining, remaining);
            await tx.userCreditBalance.update({
              where: { id: bal.id },
              data: { creditsRemaining: bal.creditsRemaining - dec },
            });
            remaining -= dec;
          }
          actualDeducted = finalCreditsNeeded;
        } else {
          actualDeducted = finalCreditsNeeded;
        }
      } else if (finalCreditsNeeded > 0) {
        // Pemotongan langsung jika belum direservasi (misal admin atau direct call)
        const activeBalances = await tx.userCreditBalance.findMany({
          where: { userId, creditsRemaining: { gt: 0 } },
          orderBy: { purchasedAt: "asc" },
        });
        let remaining = finalCreditsNeeded;
        for (const bal of activeBalances) {
          if (remaining <= 0) break;
          const dec = Math.min(bal.creditsRemaining, remaining);
          await tx.userCreditBalance.update({
            where: { id: bal.id },
            data: { creditsRemaining: bal.creditsRemaining - dec },
          });
          remaining -= dec;
          actualDeducted += dec;
        }
      }
    }

    // 4. Catat Log Telemetri AI
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

    // 5. Audit Trail ke Buku Besar credit_transactions
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
          category: "AI_USAGE",
          amount: -actualDeducted,
          balanceAfter,
          description: `Pemakaian AI: ${feature?.label || featureCode || "Fitur Riset"} (${model?.modelName || "LLM"}) - In: ${inputTokens} tk, Out: ${outputTokens} tk`,
          refId: log.id,
        },
      });
    }

    return log;
  });
}

/**
 * ── Voucher Engine & Promo Validation ──────────────────────────────────
 */

export async function validateVoucher({ code, userId, packageId }) {
  if (!code || !code.trim()) {
    throw new Error("Kode voucher tidak boleh kosong.");
  }

  const cleanCode = code.trim().toUpperCase();

  const voucher = await prisma.voucher.findUnique({
    where: { code: cleanCode },
    include: { creator: true },
  });

  if (!voucher || !voucher.isActive) {
    const err = new Error(`Kode voucher "${cleanCode}" tidak ditemukan atau sudah tidak aktif.`);
    err.statusCode = 404;
    throw err;
  }

  // 1. Anti-Fraud: Cek Self-Referral
  if (voucher.creatorUserId && userId && voucher.creatorUserId === userId) {
    await recordFraudAlert({
      userId,
      reason: `Percobaan menggunakan kode voucher / referral sendiri (${cleanCode})`,
      severity: "MEDIUM",
      metadata: { voucherCode: cleanCode },
    });
    const err = new Error("Anda tidak dapat menggunakan kode referral atau voucher milik Anda sendiri.");
    err.statusCode = 400;
    throw err;
  }

  // 2. Cek Tanggal Berlaku
  const now = new Date();
  if (voucher.startDate && now < voucher.startDate) {
    const err = new Error(`Voucher "${cleanCode}" baru dapat digunakan mulai ${voucher.startDate.toLocaleDateString("id-ID")}.`);
    err.statusCode = 400;
    throw err;
  }
  if (voucher.endDate && now > voucher.endDate) {
    const err = new Error(`Voucher "${cleanCode}" telah kedaluwarsa.`);
    err.statusCode = 400;
    throw err;
  }

  // 3. Cek Kuota Total (Global Usage Quota)
  if (voucher.maxUsageTotal !== null && voucher.currentUsageCount >= voucher.maxUsageTotal) {
    const err = new Error(`Kuota penggunaan voucher "${cleanCode}" sudah habis.`);
    err.statusCode = 400;
    throw err;
  }

  // 4. Cek Kuota Penggunaan Per User
  if (userId) {
    const userUsageCount = await prisma.voucherRedemption.count({
      where: { voucherId: voucher.id, userId },
    });
    if (userUsageCount >= voucher.maxUsagePerUser) {
      const err = new Error(`Anda telah mencapai batas maksimum penggunaan voucher "${cleanCode}".`);
      err.statusCode = 400;
      throw err;
    }
  }

  // 5. Cek Paket & Nominal Diskon
  let pkg = null;
  if (packageId) {
    pkg = await prisma.creditPackage.findUnique({ where: { id: packageId } });
    if (!pkg) {
      const err = new Error("Paket kredit tidak ditemukan.");
      err.statusCode = 404;
      throw err;
    }

    if (voucher.minPurchase > 0 && pkg.priceNormal < voucher.minPurchase) {
      const err = new Error(`Voucher ini hanya berlaku untuk pembelian minimal Rp ${voucher.minPurchase.toLocaleString("id-ID")}.`);
      err.statusCode = 400;
      throw err;
    }
  }

  // Hitung besaran diskon & bonus kredit
  let discountAmount = 0;
  let bonusCredits = voucher.bonusCredits || 0;
  const basePrice = pkg ? (pkg.priceDiscount && pkg.priceDiscount > 0 ? pkg.priceDiscount : pkg.priceNormal) : 0;

  if (voucher.discountType === "PERCENTAGE") {
    discountAmount = Math.round((basePrice * voucher.discountValue) / 100);
  } else if (voucher.discountType === "FIXED_AMOUNT") {
    discountAmount = Math.min(basePrice, voucher.discountValue);
  }

  const finalPrice = Math.max(0, basePrice - discountAmount);

  return {
    success: true,
    voucher: {
      id: voucher.id,
      code: voucher.code,
      description: voucher.description,
      discountType: voucher.discountType,
      discountValue: voucher.discountValue,
      bonusCredits,
    },
    calculation: {
      originalPrice: basePrice,
      discountAmount,
      finalPrice,
      bonusCredits,
    },
  };
}

/**
 * Eksekusi Pembelian Paket dengan Dukungan Diskon Voucher / Referral & Kuota Klaim
 */
export async function applyVoucherAndCheckout({
  userId,
  packageId,
  voucherCode = null,
  paymentMethod = "SIMULATION",
  ipAddress = null,
  userAgent = null,
}) {
  const pkg = await prisma.creditPackage.findUnique({
    where: { id: packageId },
  });

  if (!pkg || !pkg.isActive) {
    const err = new Error("Paket kredit tidak ditemukan atau sedang dinonaktifkan.");
    err.statusCode = 404;
    throw err;
  }

  // Cek kuota promo paket (discountClaimLimit) jika ada
  let isSpecialDiscountApplied = false;
  if (pkg.discountClaimLimit && pkg.discountClaimCount >= pkg.discountClaimLimit) {
    // Kuota promo habis, gunakan harga normal
    isSpecialDiscountApplied = false;
  } else if (pkg.priceDiscount && pkg.priceDiscount > 0) {
    isSpecialDiscountApplied = true;
  }

  // Cek harga bulan pertama jika user belum pernah membeli paket ini
  let effectivePackagePrice = pkg.priceNormal;
  if (isSpecialDiscountApplied && pkg.priceDiscount) {
    effectivePackagePrice = pkg.priceDiscount;
  } else if (pkg.firstMonthDiscountPrice) {
    const priorPurchases = await prisma.userCreditBalance.count({
      where: { userId, packageId: pkg.id },
    });
    if (priorPurchases === 0) {
      effectivePackagePrice = pkg.firstMonthDiscountPrice;
      isSpecialDiscountApplied = true;
    }
  }

  // Validasi Voucher jika ada
  let voucherData = null;
  let voucherObj = null;
  if (voucherCode && voucherCode.trim()) {
    voucherData = await validateVoucher({
      code: voucherCode,
      userId,
      packageId,
    });
    voucherObj = await prisma.voucher.findUnique({
      where: { code: voucherCode.trim().toUpperCase() },
    });
  }

  const discountAmount = voucherData?.calculation?.discountAmount || 0;
  const bonusCredits = voucherData?.calculation?.bonusCredits || 0;
  const finalPriceToPay = Math.max(0, effectivePackagePrice - discountAmount);
  const totalCreditsGranted = pkg.creditsGranted + bonusCredits;

  return await prisma.$transaction(async (tx) => {
    // 1. Tambah saldo kredit user
    const newBalance = await tx.userCreditBalance.create({
      data: {
        userId,
        packageId: pkg.id,
        creditsPurchased: totalCreditsGranted,
        creditsRemaining: totalCreditsGranted,
      },
    });

    // 2. Increment counter klaim diskon paket jika promo dipakai
    if (isSpecialDiscountApplied) {
      await tx.creditPackage.update({
        where: { id: pkg.id },
        data: { discountClaimCount: { increment: 1 } },
      });
    }

    // 3. Catat penebusan voucher jika voucher dipakai
    if (voucherObj) {
      await tx.voucher.update({
        where: { id: voucherObj.id },
        data: { currentUsageCount: { increment: 1 } },
      });

      await tx.voucherRedemption.create({
        data: {
          voucherId: voucherObj.id,
          userId,
          packageId: pkg.id,
          discountApplied: discountAmount,
          bonusCreditsGranted: bonusCredits,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      });

      // 4. Referral Reward: Beri komisi reward koin ke user yang membagikan link/kode
      if (voucherObj.creatorUserId && voucherObj.creatorUserId !== userId) {
        const referralRewardCredits = 20; // 20 Koin reward gratis untuk pemilik kode
        const referrerLatestBal = await tx.userCreditBalance.findFirst({
          where: { userId: voucherObj.creatorUserId },
          orderBy: { purchasedAt: "desc" },
        });

        if (referrerLatestBal) {
          await tx.userCreditBalance.update({
            where: { id: referrerLatestBal.id },
            data: { creditsRemaining: referrerLatestBal.creditsRemaining + referralRewardCredits },
          });
        } else {
          await tx.userCreditBalance.create({
            data: {
              userId: voucherObj.creatorUserId,
              creditsPurchased: referralRewardCredits,
              creditsRemaining: referralRewardCredits,
            },
          });
        }

        // Catat buku besar komisi referral
        const referrerBalAgg = await tx.userCreditBalance.aggregate({
          where: { userId: voucherObj.creatorUserId },
          _sum: { creditsRemaining: true },
        });
        const refBalAfter = referrerBalAgg._sum.creditsRemaining || 0;

        await tx.creditTransaction.create({
          data: {
            userId: voucherObj.creatorUserId,
            type: "REFERRAL_REWARD",
            category: "REWARD_EARNED",
            amount: referralRewardCredits,
            balanceAfter: refBalAfter,
            description: `Reward Referral: Teman membeli paket ${pkg.name} via kodemu! (+${referralRewardCredits} Koin)`,
            refId: newBalance.id,
          },
        });

        // Update profile referral
        await tx.userReferralProfile.upsert({
          where: { userId: voucherObj.creatorUserId },
          create: {
            userId: voucherObj.creatorUserId,
            referralCode: voucherObj.code,
            totalReferred: 1,
            totalCoinsEarned: referralRewardCredits,
          },
          update: {
            totalReferred: { increment: 1 },
            totalCoinsEarned: { increment: referralRewardCredits },
          },
        });
      }

      // 4b. Mitra / Partner Commission (Diamond Reward):
      // Jika voucher ditugaskan ke mitra (partnerUserId) dan memiliki rewardDiamondAmount > 0
      if (voucherObj.partnerUserId && voucherObj.partnerUserId !== userId && voucherObj.rewardDiamondAmount > 0) {
        const diamondAmount = voucherObj.rewardDiamondAmount;
        await tx.user.update({
          where: { id: voucherObj.partnerUserId },
          data: {
            rewardDiamonds: { increment: diamondAmount },
            partnerStatus: "PARTNER",
          },
        });

        await tx.creditTransaction.create({
          data: {
            userId: voucherObj.partnerUserId,
            type: "REFERRAL_REWARD",
            category: "REWARD_EARNED",
            amount: 0,
            diamondAmount: diamondAmount,
            balanceAfter: 0,
            description: `Komisi Reward Mitra: Pembeli menggunakan voucher ${voucherObj.code} untuk paket ${pkg.name} (+${diamondAmount.toLocaleString("id-ID")} Diamond)`,
            refId: newBalance.id,
          },
        });
      }
    }

    // 5. Catat audit trail pembelian ke credit_transactions
    const totalAgg = await tx.userCreditBalance.aggregate({
      where: { userId },
      _sum: { creditsRemaining: true },
    });
    const balanceAfter = totalAgg._sum.creditsRemaining || 0;

    const transaction = await tx.creditTransaction.create({
      data: {
        userId,
        type: "PURCHASE",
        category: (voucherObj || isSpecialDiscountApplied) ? "PROMO_PURCHASE" : "REGULAR_PURCHASE",
        amount: totalCreditsGranted,
        balanceAfter,
        description: (voucherObj || isSpecialDiscountApplied)
          ? `Beli Paket Promo: ${pkg.name} (${totalCreditsGranted} Koin) Rp ${finalPriceToPay.toLocaleString("id-ID")}${voucherObj ? ` via Voucher ${voucherObj.code}` : ""}`
          : `Beli Paket: ${pkg.name} (${totalCreditsGranted} Koin) Rp ${finalPriceToPay.toLocaleString("id-ID")} via ${paymentMethod}`,
        refId: newBalance.id,
      },
    });

    return {
      newBalance,
      transaction,
      totalCredits: balanceAfter,
      discountAmount,
      bonusCredits,
      finalPriceToPay,
    };
  });
}

/**
 * ── Referral Engine ────────────────────────────────────────────────────
 */

export async function ensureUserReferralProfile(userId) {
  let profile = await prisma.userReferralProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const nameSlug = (user?.name || "USER").replace(/[^a-zA-Z0-9]/g, "").slice(0, 5).toUpperCase();
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const code = `ZET-${nameSlug}${randomSuffix}`;

    profile = await prisma.userReferralProfile.create({
      data: {
        userId,
        referralCode: code,
      },
    });

    // Otomatis buatkan voucher referral aktif
    await prisma.voucher.upsert({
      where: { code },
      create: {
        code,
        description: `Kode Referral Pengguna ${user?.name || ""}`,
        discountType: "PERCENTAGE",
        discountValue: 15.0, // Diskon 15% untuk teman yang diajak
        bonusCredits: 10,     // Bonus 10 koin tambahan untuk teman
        maxUsagePerUser: 1,
        isActive: true,
        creatorUserId: userId,
      },
      update: {},
    });
  }

  return profile;
}

/**
 * ── Business Insight & Simulator Pembuatan Paket ────────────────────────
 * Memberikan proyeksi laba kotor, HPP API, margin %, dan break-even token
 */
export async function calculatePackageBusinessInsight({
  priceNormal,
  firstMonthDiscountPrice = null,
  creditsGranted,
  modelId = null,
}) {
  const billingConfig = await getBillingConfig();

  // Model yang dituju
  const model = modelId
    ? await prisma.aiModelConfig.findUnique({ where: { id: modelId } })
    : await prisma.aiModelConfig.findFirst({
        where: { isActive: true, isFreeTier: false },
        orderBy: { priceInputPer1M: "desc" },
      });

  const normalPrice = Number(priceNormal) || 0;
  const promoPrice = firstMonthDiscountPrice ? Number(firstMonthDiscountPrice) : normalPrice;
  const coins = Number(creditsGranted) || 1;

  // Asumsi rata-rata 1 koin = ~2.500 token (atau sesuai konfigurasi model avgTokensPerUse)
  const avgTokensPerCoin = model?.avgTokensPerUse || 2500;
  const inTokens = Math.round(avgTokensPerCoin * 0.35);
  const outTokens = Math.round(avgTokensPerCoin * 0.65);

  const costPerCoinUsd = model
    ? (inTokens / 1_000_000) * (model.priceInputPer1M || 0) +
      (outTokens / 1_000_000) * (model.priceOutputPer1M || 0)
    : 0.001;

  // Total HPP Modal Token API untuk seluruh kuota koin paket
  const totalHppUsd = costPerCoinUsd * coins;
  const totalHppIdr = Math.round(
    totalHppUsd * billingConfig.baseRateUsdIdr * (1 + billingConfig.inflationBuffer)
  );

  // Perhitungan Laba & Margin
  const profitNormalIdr = normalPrice - totalHppIdr;
  const normalMarginPercent = normalPrice > 0 ? Math.round((profitNormalIdr / normalPrice) * 100) : 0;

  const profitPromoIdr = promoPrice - totalHppIdr;
  const promoMarginPercent = promoPrice > 0 ? Math.round((profitPromoIdr / promoPrice) * 100) : 0;

  // Break-even total generasi yang bisa dilakukan sebelum profit menjadi 0
  const costPerCallIdr = Math.round(
    costPerCoinUsd * billingConfig.baseRateUsdIdr * (1 + billingConfig.inflationBuffer)
  );
  const breakEvenCalls = costPerCallIdr > 0 ? Math.floor(normalPrice / costPerCallIdr) : 9999;

  // Status kesehatan margin
  let healthStatus = "HEALTHY";
  let warningMessage = null;

  if (normalMarginPercent < 20 || promoMarginPercent < 15) {
    healthStatus = "RISKY";
    warningMessage = "Peringatan Bahaya: Margin laba di bawah 20%! Anda berisiko rugi jika user aktif menghabiskan kuota koin.";
  } else if (normalMarginPercent < 40) {
    healthStatus = "MODERATE";
    warningMessage = "Perhatian: Margin laba moderat (20-40%). Pertimbangkan menaikkan harga atau menurunkan koin.";
  }

  return {
    modelUsed: model?.routerLabel || model?.modelName || "Standard AI Model",
    modelPrices: {
      inputPer1M: model?.priceInputPer1M || 0,
      outputPer1M: model?.priceOutputPer1M || 0,
    },
    kursEffective: billingConfig.effectiveRateUsdIdr,
    totalHppIdr,
    normalPrice,
    profitNormalIdr,
    normalMarginPercent,
    promoPrice,
    profitPromoIdr,
    promoMarginPercent,
    breakEvenCalls,
    healthStatus,
    warningMessage,
  };
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

/**
 * ── Mitra / Partner Reward Center & Diamond Redemption ──────────────────
 */

/**
 * Mengambil profil reward mitra (Diamond balance, assigned vouchers, dan katalog redeem)
 */
export async function getPartnerRewardProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      partnerStatus: true,
      rewardDiamonds: true,
    },
  });

  if (!user) {
    const err = new Error("User tidak ditemukan.");
    err.statusCode = 404;
    throw err;
  }

  // Voucher yang ditugaskan ke mitra ini
  const assignedVouchers = await prisma.voucher.findMany({
    where: {
      OR: [{ partnerUserId: userId }, { creatorUserId: userId }],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      code: true,
      description: true,
      discountType: true,
      discountValue: true,
      bonusCredits: true,
      rewardDiamondAmount: true,
      currentUsageCount: true,
      maxUsageTotal: true,
      isActive: true,
      startDate: true,
      endDate: true,
    },
  });

  // Riwayat reward komisi
  const rewardLogs = await prisma.creditTransaction.findMany({
    where: {
      userId,
      category: { in: ["REWARD_EARNED", "DIAMOND_REDEMPTION"] },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  // Katalog paket kredit yang dapat ditukarkan dengan Diamond (1 Diamond = Rp 1)
  const packages = await prisma.creditPackage.findMany({
    where: { isActive: true },
    orderBy: { priceNormal: "asc" },
  });

  const redeemablePackages = packages.map((pkg) => {
    const priceIdr = pkg.priceDiscount || pkg.priceNormal;
    const diamondsRequired = priceIdr; // Rasio 1 Diamond = Rp 1
    const canRedeemFull = (user.rewardDiamonds || 0) >= diamondsRequired;
    const progressPercent = Math.min(100, Math.round(((user.rewardDiamonds || 0) / diamondsRequired) * 100));

    return {
      ...pkg,
      priceIdr,
      diamondsRequired,
      canRedeemFull,
      progressPercent,
    };
  });

  return {
    isRewardPartner: Boolean(user.partnerStatus || (user.rewardDiamonds && user.rewardDiamonds > 0)),
    partnerStatus: user.partnerStatus || (user.rewardDiamonds > 0 ? "PARTNER" : null),
    rewardDiamonds: user.rewardDiamonds || 0,
    equivalentRupiah: (user.rewardDiamonds || 0) * 1,
    assignedVouchers,
    rewardLogs,
    redeemablePackages,
  };
}

/**
 * Menukarkan (Redeem) Saldo Diamond menjadi Paket Kredit AI
 */
export async function redeemDiamondsForPackage({ userId, packageId }) {
  const [user, pkg] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.creditPackage.findUnique({ where: { id: packageId } }),
  ]);

  if (!user) {
    const err = new Error("Pengguna tidak ditemukan.");
    err.statusCode = 404;
    throw err;
  }

  if (!pkg || !pkg.isActive) {
    const err = new Error("Paket kredit tidak ditemukan atau nonaktif.");
    err.statusCode = 404;
    throw err;
  }

  const effectivePrice = pkg.priceDiscount || pkg.priceNormal;
  const diamondsNeeded = effectivePrice; // 1 Diamond = Rp 1

  if ((user.rewardDiamonds || 0) < diamondsNeeded) {
    const err = new Error(
      `Saldo Diamond tidak mencukupi. Anda memiliki ${user.rewardDiamonds || 0} Diamond, dibutuhkan ${diamondsNeeded} Diamond untuk menukarkan paket "${pkg.name}".`
    );
    err.statusCode = 400;
    throw err;
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Kurangi saldo rewardDiamonds user
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        rewardDiamonds: { decrement: diamondsNeeded },
      },
    });

    // 2. Tambahkan paket kredit ke saldo AI user
    const newCreditBalance = await tx.userCreditBalance.create({
      data: {
        userId,
        packageId: pkg.id,
        creditsPurchased: pkg.creditsGranted,
        creditsRemaining: pkg.creditsGranted,
      },
    });

    // 3. Hitung snapshot saldo kredit akhir
    const totalAgg = await tx.userCreditBalance.aggregate({
      where: { userId },
      _sum: { creditsRemaining: true },
    });
    const balanceAfter = totalAgg._sum.creditsRemaining || 0;

    // 4. Catat transaksi di buku besar (Category: DIAMOND_REDEMPTION)
    const transaction = await tx.creditTransaction.create({
      data: {
        userId,
        type: "DIAMOND_REDEMPTION",
        category: "DIAMOND_REDEMPTION",
        amount: pkg.creditsGranted,
        diamondAmount: -diamondsNeeded,
        balanceAfter,
        description: `Penukaran ${diamondsNeeded.toLocaleString("id-ID")} Diamond ke Paket ${pkg.name} (+${pkg.creditsGranted} Koin)`,
        refId: newCreditBalance.id,
      },
    });

    return {
      success: true,
      message: `Selamat! Penukaran ${diamondsNeeded.toLocaleString("id-ID")} Diamond berhasil. Paket "${pkg.name}" (+${pkg.creditsGranted} Koin) telah aktif di akun Anda.`,
      package: pkg,
      remainingDiamonds: updatedUser.rewardDiamonds,
      totalCredits: balanceAfter,
      transaction,
    };
  });
}

