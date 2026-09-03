import { Router } from "express";
import * as adminController from "../controllers/admin.controller.js";
import { requireAuth, requireAdmin } from "../middlewares/auth.middleware.js";

const router = Router();

// Semua rute admin diproteksi autentikasi JWT dan pengecekan role ADMIN
router.use(requireAuth);
router.use(requireAdmin);

// ── 1. Executive Dashboard & Stats ──
router.get("/stats", adminController.getAdminStats);
router.get("/executive-stats", adminController.getAdminStats);

// ── 2. Master Exchange Setting & Margin ──
router.get("/billing-config", adminController.getBillingConfig);
router.patch("/billing-config", adminController.updateBillingConfig);
router.post("/billing-config", adminController.updateBillingConfig);

// ── 3. AI Model Configurations CRUD ──
router.get("/ai-models", adminController.getAiModels);
router.post("/ai-models", adminController.createAiModel);
router.patch("/ai-models/:id", adminController.updateAiModel);
router.delete("/ai-models/:id", adminController.deleteAiModel);
router.post("/ai-models/:id/sync-balance", adminController.syncAiModelBalance);
router.post("/ai-models/:id/test", adminController.testAiModel);

// ── 4. Feature-to-Model Routing Matrix ──
router.get("/feature-routings", adminController.getFeatureRoutings);
router.patch("/feature-routings/:featureId", adminController.updateFeatureRouting);

// ── 5. Credit Packages (Harga & Langganan) ──
router.get("/credit-packages", adminController.getCreditPackages);
router.post("/credit-packages", adminController.createCreditPackage);
router.patch("/credit-packages/:id", adminController.updateCreditPackage);
router.delete("/credit-packages/:id", adminController.deleteCreditPackage);
router.post("/credit-packages/simulate", adminController.simulateIdealPackage);

// ── 6. Live AI Usage Logs & Telemetry ──
router.get("/usage-logs", adminController.getUsageLogs);

// ── 7. User Management ──
router.get("/users", adminController.getAdminUsers);
router.patch("/users/:userId/role", adminController.updateUserRole);

// ── 8. Legacy Database Encrypted API Keys ──
router.get("/presets", adminController.getAdminPresets);
router.get("/configs", adminController.getAdminConfigs);
router.post("/configs", adminController.updateAdminConfig);
router.post("/import-curl", adminController.importFromCurl);
router.delete("/configs/:key", adminController.deleteAdminConfig);
router.post("/configs/test-connection", adminController.testGroqConnection);
router.post("/configs/test-groq", adminController.testGroqConnection);

export default router;
