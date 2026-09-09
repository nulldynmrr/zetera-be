import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import {
  getActivePackages,
  getUserBalance,
  checkoutPackage,
  getUserTransactions,
  validateVoucherEndpoint,
  getUserReferralEndpoint,
  calculatePackageInsightEndpoint,
  getPartnerRewardProfileEndpoint,
  redeemDiamondsEndpoint,
} from "../controllers/billing.controller.js";

const router = Router();

// Endpoint publik: paket kredit aktif yang dapat dilihat calon pembeli & user
router.get("/packages", getActivePackages);
router.post("/packages/insight", calculatePackageInsightEndpoint);

// Endpoint terproteksi autentikasi user
router.use(requireAuth);
router.get("/balance", getUserBalance);
router.post("/checkout", checkoutPackage);
router.post("/voucher/validate", validateVoucherEndpoint);
router.get("/referral", getUserReferralEndpoint);
router.get("/transactions", getUserTransactions);
router.get("/reward-profile", getPartnerRewardProfileEndpoint);
router.post("/reward/redeem", redeemDiamondsEndpoint);

export default router;
