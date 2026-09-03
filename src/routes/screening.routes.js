import { Router } from "express";
import * as screeningController from "../controllers/screening.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router({ mergeParams: true });

router.use(requireAuth);

// Base: /api/projects/:projectId/screening
router.post("/evaluate-batch", screeningController.screenAbstractsBatch);
router.post("/auto-populate-framework", screeningController.autoPopulateFramework);

export default router;
