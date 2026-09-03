import { Router } from "express";
import { register, login, getMe } from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

// Public
router.post("/register", register);
router.post("/login", login);

// Protected
router.get("/me", requireAuth, getMe);

export default router;
