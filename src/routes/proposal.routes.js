import { Router } from "express";
import * as proposalController from "../controllers/proposal.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get("/", proposalController.getProposal);
router.put("/", proposalController.saveProposal);
router.post("/save", proposalController.saveProposal);
router.post("/generate", proposalController.generateProposal);
router.post("/chat", proposalController.chatWithProposal);
router.get("/export-docx", proposalController.exportDocx);
router.get("/export-latex", proposalController.exportLatex);

export default router;

