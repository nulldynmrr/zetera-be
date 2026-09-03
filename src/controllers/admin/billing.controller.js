import * as billingService from "../../services/billing.service.js";

/**
 * Master Exchange Setting (SystemBillingConfig)
 */
export async function getBillingConfig(req, res, next) {
  try {
    const config = await billingService.getBillingConfig();
    res.status(200).json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
}

export async function updateBillingConfig(req, res, next) {
  try {
    const updated = await billingService.updateBillingConfig(req.body);
    res.status(200).json({
      success: true,
      message: "Master Exchange Setting & Margin berhasil diperbarui!",
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}
