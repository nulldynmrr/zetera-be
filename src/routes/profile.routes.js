import { Router } from "express";
import * as profileController from "../controllers/profile.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(requireAuth);

// GET    /api/profile              → get current user's profile
// POST   /api/profile              → create/update profile (upsert — onboarding)
// GET    /api/profile/onboarding   → check if onboarding is complete
router.get("/onboarding", profileController.checkOnboarding);
router.get("/", profileController.getProfile);
router.post("/", profileController.upsertProfile);

export default router;
