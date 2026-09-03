import { Router } from "express";
import * as promptController from "../controllers/prompt.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

// Public / Authenticated read
router.get("/", requireAuth, promptController.listPrompts);
router.get("/:code", requireAuth, promptController.getPrompt);

// Admin / User prompt customization
router.post("/", requireAuth, promptController.createPrompt);
router.put("/:id", requireAuth, promptController.updatePrompt);
router.delete("/:id", requireAuth, promptController.deletePrompt);

export default router;
