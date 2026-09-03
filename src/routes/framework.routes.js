import { Router } from "express";
import * as frameworkController from "../controllers/framework.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router({ mergeParams: true });

router.use(requireAuth);

// Base: /api/projects/:projectId/framework
router.get("/", frameworkController.getFramework);
router.post("/nodes", frameworkController.createNode);
router.patch("/nodes/:nodeId", frameworkController.updateNode);
router.delete("/nodes/:nodeId", frameworkController.deleteNode);

router.post("/edges", frameworkController.createEdge);
router.delete("/edges/:edgeId", frameworkController.deleteEdge);

router.put("/sync-positions", frameworkController.syncPositions);

// AI Smart Relation Recommendation (Groq LLM)
router.post("/ai-recommend-relation", frameworkController.recommendRelation);

// AI Smart Auto-Generation from Approved Journals (Synthesis / Single Journal)
router.post("/generate-from-journals", frameworkController.generateFromJournals);

// AI Academic Skripsi Narrative Drafting Engine (Bab 1, 2, 3)
router.post("/generate-draft", frameworkController.generateDraft);

export default router;
