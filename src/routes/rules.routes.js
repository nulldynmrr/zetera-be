import { Router } from "express";
import {
  getRules,
  getRuleById,
  createRule,
  updateRule,
  deleteRule,
  upsertVariant,
  deleteVariant,
} from "../controllers/rules.controller.js";

const router = Router();

router.get("/", getRules);
router.get("/:id", getRuleById);
router.post("/", createRule);
router.put("/:id", updateRule);
router.delete("/:id", deleteRule);

// Variants endpoints
router.post("/:id/variants", upsertVariant);
router.delete("/:id/variants/:variantId", deleteVariant);

export default router;
