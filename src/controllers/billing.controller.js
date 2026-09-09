import prisma from "../lib/prisma.js";

/**
 * GET /api/billing/packages
 * Mengambil daftar paket kredit aktif yang dibuat oleh Admin
 */
export async function getActivePackages(req, res, next) {
  try {
    const packages = await prisma.creditPackage.findMany({
      where: { isActive: true },
      orderBy: { priceNormal: "asc" },
    });
    res.status(200).json({ success: true, data: packages });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/billing/balance
 * Mengambil informasi detail saldo kredit user login dan ringkasan paket aktif
 */
export async function getUserBalance(req, res, next) {
  try {
    const userId = req.user.sub || req.user.id;

    const [userRecord, balanceAgg, balances] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, partnerStatus: true, rewardDiamonds: true },
      }),
      prisma.userCreditBalance.aggregate({
        where: { userId },
        _sum: { creditsRemaining: true, creditsPurchased: true },
      }),
      prisma.userCreditBalance.findMany({
        where: { userId, creditsRemaining: { gt: 0 } },
        include: { package: true },
        orderBy: { purchasedAt: "desc" },
      }),
    ]);

    const totalCredits = balanceAgg._sum.creditsRemaining || 0;
    const totalPurchased = balanceAgg._sum.creditsPurchased || 0;

    res.status(200).json({
      success: true,
      data: {
        totalCredits,
        totalPurchased,
        activeBalances: balances,
        partnerStatus: userRecord?.partnerStatus || null,
        rewardDiamonds: userRecord?.rewardDiamonds || 0,
        isRewardPartner: Boolean(userRecord?.partnerStatus || (userRecord?.rewardDiamonds && userRecord.rewardDiamonds > 0)),
      },
    });
  } catch (err) {
    next(err);
  }
}

import {
  applyVoucherAndCheckout,
  validateVoucher,
  ensureUserReferralProfile,
  calculatePackageBusinessInsight,
  getPartnerRewardProfile,
  redeemDiamondsForPackage,
} from "../services/billing.service.js";

/**
 * POST /api/billing/checkout
 * User membeli / memilih paket kredit yang telah dibuat oleh Admin
 * Mendukung kode promo/voucher, harga khusus bulan pertama, dan bonus referral
 */
export async function checkoutPackage(req, res, next) {
  try {
    const userId = req.user.sub || req.user.id;
    const { packageId, voucherCode, paymentMethod = "SIMULATION" } = req.body;

    if (!packageId) {
      const err = new Error("Paket kredit wajib dipilih.");
      err.statusCode = 400;
      throw err;
    }

    const ipAddress = req.ip || req.headers["x-forwarded-for"] || null;
    const userAgent = req.headers["user-agent"] || null;

    const result = await applyVoucherAndCheckout({
      userId,
      packageId,
      voucherCode,
      paymentMethod,
      ipAddress,
      userAgent,
    });

    res.status(200).json({
      success: true,
      message: `Selamat! Pembelian paket kredit berhasil diproses. Saldo bertambah +${result.newBalance.creditsPurchased} Koin!`,
      data: {
        creditsAdded: result.newBalance.creditsPurchased,
        totalCredits: result.totalCredits,
        discountAmount: result.discountAmount,
        bonusCredits: result.bonusCredits,
        finalPriceToPay: result.finalPriceToPay,
        transactionId: result.transaction.id,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/billing/voucher/validate
 * Validasi kuota, keabsahan tanggal, dan kalkulasi diskon voucher
 */
export async function validateVoucherEndpoint(req, res, next) {
  try {
    const userId = req.user?.sub || req.user?.id || null;
    const { code, packageId } = req.body;

    if (!code) {
      const err = new Error("Kode voucher wajib diisi.");
      err.statusCode = 400;
      throw err;
    }

    const validation = await validateVoucher({ code, userId, packageId });
    res.status(200).json(validation);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/billing/referral
 * Mengambil kode referral unik pengguna, jumlah teman yang diajak, dan total koin komisi
 */
export async function getUserReferralEndpoint(req, res, next) {
  try {
    const userId = req.user.sub || req.user.id;
    const profile = await ensureUserReferralProfile(userId);

    // Ambil riwayat reward koin referral
    const rewards = await prisma.creditTransaction.findMany({
      where: { userId, type: "REFERRAL_REWARD" },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    res.status(200).json({
      success: true,
      data: {
        referralCode: profile.referralCode,
        totalReferred: profile.totalReferred,
        totalCoinsEarned: profile.totalCoinsEarned,
        shareUrl: `${process.env.FRONTEND_URL || "http://localhost:3000"}/register?ref=${profile.referralCode}`,
        rewardsHistory: rewards,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/billing/packages/insight
 * Simulasi Business Insight untuk Admin saat membuat/mengedit paket
 */
export async function calculatePackageInsightEndpoint(req, res, next) {
  try {
    const { priceNormal, firstMonthDiscountPrice, creditsGranted, modelId } = req.body;
    const insight = await calculatePackageBusinessInsight({
      priceNormal,
      firstMonthDiscountPrice,
      creditsGranted,
      modelId,
    });
    res.status(200).json({ success: true, data: insight });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/billing/transactions
 * Mengambil buku besar riwayat transaksi kredit user (Audit Trail)
 */
export async function getUserTransactions(req, res, next) {
  try {
    const userId = req.user.sub || req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const category = req.query.category;
    const skip = (page - 1) * limit;

    const where = { userId };
    if (category && category !== "ALL") {
      where.category = category;
    }

    const [transactions, total] = await Promise.all([
      prisma.creditTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.creditTransaction.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/billing/reward-profile
 * Mengambil profil reward mitra (Diamond balance, assigned vouchers, dan katalog redeem)
 */
export async function getPartnerRewardProfileEndpoint(req, res, next) {
  try {
    const userId = req.user.sub || req.user.id;
    const profile = await getPartnerRewardProfile(userId);
    res.status(200).json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/billing/reward/redeem
 * Menukarkan saldo Diamond menjadi Paket Kredit AI
 */
export async function redeemDiamondsEndpoint(req, res, next) {
  try {
    const userId = req.user.sub || req.user.id;
    const { packageId } = req.body;

    if (!packageId) {
      const err = new Error("Parameter packageId wajib disertakan.");
      err.statusCode = 400;
      throw err;
    }

    const result = await redeemDiamondsForPackage({ userId, packageId });
    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}
