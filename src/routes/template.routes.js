import { Router } from "express";
import * as templateController from "../controllers/template.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(requireAuth);

// GET /api/templates            → list all templates (system default + user's own)
// POST /api/templates/seed      → seed default templates if not exist
// GET /api/templates/:templateId → get single template with sections
// POST /api/templates/:templateId/clone → clone template for user
// PATCH /api/templates/:templateId → update template / sections (user owned only)
// DELETE /api/templates/:templateId → delete template (user owned only)

router.get("/", templateController.listTemplates);
router.post("/seed", templateController.seedDefaultTemplates);
router.get("/:templateId", templateController.getTemplate);
router.post("/:templateId/clone", templateController.cloneTemplate);
router.patch("/:templateId", templateController.updateTemplate);
router.delete("/:templateId", templateController.deleteTemplate);

export default router;
