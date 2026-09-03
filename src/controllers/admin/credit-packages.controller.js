import prisma from "../../lib/prisma.js";
import * as billingService from "../../services/billing.service.js";

/**
 * Credit Packages (Harga & Langganan) & Simulator
 */
export async function getCreditPackages(req, res, next) {
  try {
    const packages = await prisma.creditPackage.findMany({
      orderBy: { priceNormal: "asc" },
    });
    res.status(200).json({ success: true, data: packages });
  } catch (err) {
    next(err);
  }
}

export async function createCreditPackage(req, res, next) {
  try {
    const {
      name,
      type = "ONE_TIME",
      creditsGranted,
      durationDays = null,
      priceNormal,
      priceDiscount = null,
      badgeLabel = "",
      isActive = true,
    } = req.body;

    if (!name || !creditsGranted || !priceNormal) {
      const err = new Error("Nama Paket, Jumlah Kredit, dan Harga Normal wajib diisi.");
      err.statusCode = 400;
      throw err;
    }

    const pkg = await prisma.creditPackage.create({
      data: {
        name: name.trim(),
        type,
        creditsGranted: Number(creditsGranted),
        durationDays: durationDays ? Number(durationDays) : null,
        priceNormal: Number(priceNormal),
        priceDiscount: priceDiscount ? Number(priceDiscount) : null,
        badgeLabel: badgeLabel ? badgeLabel.trim() : null,
        isActive: Boolean(isActive),
      },
    });

    res.status(201).json({
      success: true,
      message: `Paket harga "${pkg.name}" berhasil dibuat!`,
      data: pkg,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateCreditPackage(req, res, next) {
  try {
    const { id } = req.params;
    const { name, type, creditsGranted, durationDays, priceNormal, priceDiscount, badgeLabel, isActive } =
      req.body;

    const dataToUpdate = {};
    if (name !== undefined) dataToUpdate.name = name.trim();
    if (type !== undefined) dataToUpdate.type = type;
    if (creditsGranted !== undefined) dataToUpdate.creditsGranted = Number(creditsGranted);
    if (durationDays !== undefined) dataToUpdate.durationDays = durationDays ? Number(durationDays) : null;
    if (priceNormal !== undefined) dataToUpdate.priceNormal = Number(priceNormal);
    if (priceDiscount !== undefined) dataToUpdate.priceDiscount = priceDiscount ? Number(priceDiscount) : null;
    if (badgeLabel !== undefined) dataToUpdate.badgeLabel = badgeLabel ? badgeLabel.trim() : null;
    if (isActive !== undefined) dataToUpdate.isActive = Boolean(isActive);

    const updated = await prisma.creditPackage.update({
      where: { id },
      data: dataToUpdate,
    });

    res.status(200).json({
      success: true,
      message: `Paket "${updated.name}" berhasil diperbarui!`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteCreditPackage(req, res, next) {
  try {
    const { id } = req.params;
    await prisma.creditPackage.delete({ where: { id } });
    res.status(200).json({ success: true, message: "Paket berhasil dihapus." });
  } catch (err) {
    next(err);
  }
}

export async function simulateIdealPackage(req, res, next) {
  try {
    const { modelId, selectedFeatureCodes, targetMargin, expectedGenerationsPerMonth } = req.body;
    const result = await billingService.calculateIdealPackage({
      modelId,
      selectedFeatureCodes,
      targetMargin: targetMargin ? Number(targetMargin) : 0.4,
      expectedVolume: expectedGenerationsPerMonth ? Number(expectedGenerationsPerMonth) : 30,
    });
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
