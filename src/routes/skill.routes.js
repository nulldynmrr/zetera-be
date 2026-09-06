import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import * as skillController from "../controllers/skill.controller.js";

const router = Router();

// Academic Skills Runner & Intent
router.post("/run", requireAuth, skillController.runSkill);
router.post("/intent", requireAuth, skillController.parseIntent);

// Versioned Draft Endpoints
router.get("/draft/:projectId/:tag", requireAuth, skillController.getDraft);
router.post("/draft/:projectId/:tag", requireAuth, skillController.saveDraft);

export default router;
