import { Router } from "express";
import {
  getSubBabs,
  getSubBabById,
  createSubBab,
  updateSubBab,
  deleteSubBab,
  setRuleMappings,
  updateOutputSpec,
} from "../controllers/subbab.controller.js";

const router = Router();

router.get("/", getSubBabs);
router.get("/:id", getSubBabById);
router.post("/", createSubBab);
router.put("/:id", updateSubBab);
router.delete("/:id", deleteSubBab);

// Mappings & Output Spec endpoints
router.post("/:id/rules", setRuleMappings);
router.put("/:id/output-spec", updateOutputSpec);

export default router;
