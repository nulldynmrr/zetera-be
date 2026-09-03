import { Router } from "express";
import * as memoryController from "../controllers/memory.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router({ mergeParams: true });

router.use(requireAuth);

// Base: /api/projects/:projectId/memory
router.get("/", memoryController.getMemory);
router.put("/toc", memoryController.updateToc);
router.put("/citations", memoryController.updateCitation);

export default router;
