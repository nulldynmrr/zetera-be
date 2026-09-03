import { Router } from "express";
import * as projectController from "../controllers/project.controller.js";
import * as outlineController from "../controllers/outline.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(requireAuth);

router.get("/", projectController.listProjects);
router.post("/", projectController.createProject);
router.post("/brainstorm-topics", projectController.brainstormTopics);
router.post("/recommend-outline", projectController.recommendOutline);
router.get("/:id", projectController.getProject);
router.patch("/:id", projectController.updateProject);
router.delete("/:id", projectController.deleteProject);
router.post("/:id/sync-framework", projectController.syncProposalToFramework);

// ── Overhaul v2: Custom BAB / Daftar Isi routes ──
router.get("/:id/custom-outline", projectController.getCustomOutline);
router.put("/:id/custom-outline", projectController.saveCustomOutline);
router.post("/:id/custom-outline/ai-suggest", projectController.aiSuggestSubchapters);

// ── Outline / Research Blueprint routes ──
router.get("/:id/outline", outlineController.getOutline);
router.get("/:id/outline/search", outlineController.searchPapers);  // Must be before /:itemId
router.post("/:id/outline/generate", outlineController.generateBlueprint);
router.get("/:id/outline/:itemId/pool-journals", outlineController.getPoolJournals);
router.post("/:id/outline/:itemId/generate", outlineController.generateItemBlueprint);
router.patch("/:id/outline/:itemId", outlineController.updateOutlineItem);
router.post("/:id/outline/:itemId/evidence", outlineController.addEvidence);
router.delete("/:id/outline/:itemId/evidence/:evidenceId", outlineController.removeEvidence);

export default router;

