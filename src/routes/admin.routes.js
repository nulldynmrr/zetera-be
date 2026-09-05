import { Router } from "express";
import { requireAuth, requireAdmin } from "../middlewares/auth.middleware.js";
import { getAdminStats, getUsageLogs } from "../controllers/admin/stats.controller.js";
import { getBillingConfig, updateBillingConfig } from "../controllers/admin/billing.controller.js";
import {
  getAiModels,
  createAiModel,
  updateAiModel,
  deleteAiModel,
  syncAiModelBalance,
  testAiModel,
} from "../controllers/admin/ai-models.controller.js";
import {
  getFeatureRoutings,
  updateFeatureRouting,
} from "../controllers/admin/feature-routing.controller.js";
import {
  getCreditPackages,
  createCreditPackage,
  updateCreditPackage,
  deleteCreditPackage,
  simulateIdealPackage,
} from "../controllers/admin/credit-packages.controller.js";
import { getAdminUsers, updateUserRole } from "../controllers/admin/users.controller.js";
import {
  getAdminConfigs,
  updateAdminConfig,
  deleteAdminConfig,
  getAdminPresets,
  importFromCurl,
  testGroqConnection,
} from "../controllers/admin/secrets.controller.js";

const router = Router();

// Semua rute admin diproteksi autentikasi JWT dan pengecekan role ADMIN
router.use(requireAuth);
router.use(requireAdmin);

// ── 1. Executive Dashboard & Stats ──
router.get("/stats", getAdminStats);
// @deprecated: Gunakan /stats. Dipertahankan sementara untuk kompatibilitas frontend legacy.
router.get("/executive-stats", getAdminStats);

// ── 2. Master Exchange Setting & Margin ──
router.get("/billing-config", getBillingConfig);
router.patch("/billing-config", updateBillingConfig);
router.post("/billing-config", updateBillingConfig);

// ── 3. AI Model Configurations CRUD ──
router.get("/ai-models", getAiModels);
router.post("/ai-models", createAiModel);
router.patch("/ai-models/:id", updateAiModel);
router.delete("/ai-models/:id", deleteAiModel);
router.post("/ai-models/:id/sync-balance", syncAiModelBalance);
router.post("/ai-models/:id/test", testAiModel);

// ── 4. Feature-to-Model Routing Matrix ──
router.get("/feature-routings", getFeatureRoutings);
router.patch("/feature-routings/:featureId", updateFeatureRouting);

// ── 5. Credit Packages (Harga & Langganan) ──
router.get("/credit-packages", getCreditPackages);
router.post("/credit-packages", createCreditPackage);
router.patch("/credit-packages/:id", updateCreditPackage);
router.delete("/credit-packages/:id", deleteCreditPackage);
router.post("/credit-packages/simulate", simulateIdealPackage);

// ── 6. Live AI Usage Logs & Telemetry ──
router.get("/usage-logs", getUsageLogs);

// ── 7. User Management ──
router.get("/users", getAdminUsers);
router.patch("/users/:userId/role", updateUserRole);

// ── 8. Legacy Database Encrypted API Keys ──
router.get("/presets", getAdminPresets);
router.get("/configs", getAdminConfigs);
router.post("/configs", updateAdminConfig);
router.post("/import-curl", importFromCurl);
router.delete("/configs/:key", deleteAdminConfig);
router.post("/configs/test-groq", testGroqConnection);
// @deprecated: Gunakan /configs/test-groq. Dipertahankan sementara untuk backward compatibility.
router.post("/configs/test-connection", testGroqConnection);

// ── 9. Research System & Citation Explorer ──
import {
  getAdminProjects,
  getAdminProjectJournals,
  updateAdminJournal,
  deleteAdminJournal,
  updateAdminCitation,
  deleteAdminCitation,
} from "../controllers/admin/projects.controller.js";

router.get("/projects", getAdminProjects);
router.get("/projects/:id/journals", getAdminProjectJournals);
router.patch("/journals/:id", updateAdminJournal);
router.delete("/journals/:id", deleteAdminJournal);
router.patch("/citations/:id", updateAdminCitation);
router.delete("/citations/:id", deleteAdminCitation);

export default router;
