import prisma from "../../lib/prisma.js";

/**
 * GET /api/admin/vouchers
 * Daftar seluruh voucher kampanye
 */
export async function getAdminVouchers(req, res, next) {
  try {
    const vouchers = await prisma.voucher.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        partnerUser: { select: { id: true, name: true, email: true } },
        _count: { select: { redemptions: true } },
      },
    });

    res.status(200).json({ success: true, data: vouchers });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/vouchers
 * Membuat voucher promo baru
 */
export async function createAdminVoucher(req, res, next) {
  try {
    const {
      code,
      description,
      discountType = "PERCENTAGE",
      discountValue = 0,
      bonusCredits = 0,
      minPurchase = 0,
      maxUsageTotal = null,
      maxUsagePerUser = 1,
      startDate = null,
      endDate = null,
      isActive = true,
      partnerUserId = null,
      rewardDiamondAmount = 0,
    } = req.body;

    if (!code || !code.trim()) {
      const err = new Error("Kode voucher wajib diisi.");
      err.statusCode = 400;
      throw err;
    }

    const cleanCode = code.trim().toUpperCase();

    const existing = await prisma.voucher.findUnique({ where: { code: cleanCode } });
    if (existing) {
      const err = new Error(`Kode voucher "${cleanCode}" sudah digunakan.`);
      err.statusCode = 400;
      throw err;
    }

    // Jika ditugaskan ke mitra, pastikan user berstatus PARTNER
    if (partnerUserId) {
      await prisma.user.update({
        where: { id: partnerUserId },
        data: { partnerStatus: "PARTNER" },
      }).catch(() => null);
    }

    const created = await prisma.voucher.create({
      data: {
        code: cleanCode,
        description: description?.trim() || null,
        discountType,
        discountValue: Number(discountValue) || 0,
        bonusCredits: Number(bonusCredits) || 0,
        minPurchase: Number(minPurchase) || 0,
        maxUsageTotal: maxUsageTotal ? Number(maxUsageTotal) : null,
        maxUsagePerUser: Number(maxUsagePerUser) || 1,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        isActive: Boolean(isActive),
        partnerUserId: partnerUserId || null,
        rewardDiamondAmount: Number(rewardDiamondAmount) || 0,
      },
      include: {
        partnerUser: { select: { id: true, name: true, email: true } },
      },
    });

    res.status(201).json({
      success: true,
      message: `Voucher promo "${cleanCode}" berhasil dibuat!`,
      data: created,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/admin/vouchers/:id
 * Mengedit voucher promo
 */
export async function updateAdminVoucher(req, res, next) {
  try {
    const { id } = req.params;
    const {
      code,
      description,
      discountType,
      discountValue,
      bonusCredits,
      minPurchase,
      maxUsageTotal,
      maxUsagePerUser,
      startDate,
      endDate,
      isActive,
      partnerUserId,
      rewardDiamondAmount,
    } = req.body;

    const dataToUpdate = {};
    if (code !== undefined) dataToUpdate.code = code.trim().toUpperCase();
    if (description !== undefined) dataToUpdate.description = description?.trim() || null;
    if (discountType !== undefined) dataToUpdate.discountType = discountType;
    if (discountValue !== undefined) dataToUpdate.discountValue = Number(discountValue);
    if (bonusCredits !== undefined) dataToUpdate.bonusCredits = Number(bonusCredits);
    if (minPurchase !== undefined) dataToUpdate.minPurchase = Number(minPurchase);
    if (maxUsageTotal !== undefined) dataToUpdate.maxUsageTotal = maxUsageTotal ? Number(maxUsageTotal) : null;
    if (maxUsagePerUser !== undefined) dataToUpdate.maxUsagePerUser = Number(maxUsagePerUser);
    if (startDate !== undefined) dataToUpdate.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) dataToUpdate.endDate = endDate ? new Date(endDate) : null;
    if (isActive !== undefined) dataToUpdate.isActive = Boolean(isActive);
    if (partnerUserId !== undefined) {
      dataToUpdate.partnerUserId = partnerUserId || null;
      if (partnerUserId) {
        await prisma.user.update({
          where: { id: partnerUserId },
          data: { partnerStatus: "PARTNER" },
        }).catch(() => null);
      }
    }
    if (rewardDiamondAmount !== undefined) dataToUpdate.rewardDiamondAmount = Number(rewardDiamondAmount) || 0;

    const updated = await prisma.voucher.update({
      where: { id },
      data: dataToUpdate,
      include: {
        partnerUser: { select: { id: true, name: true, email: true } },
      },
    });

    res.status(200).json({
      success: true,
      message: `Voucher promo "${updated.code}" berhasil diperbarui!`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/admin/vouchers/:id
 * Menghapus voucher promo
 */
export async function deleteAdminVoucher(req, res, next) {
  try {
    const { id } = req.params;
    await prisma.voucher.delete({ where: { id } });
    res.status(200).json({ success: true, message: "Voucher berhasil dihapus." });
  } catch (err) {
    next(err);
  }
}
