import { z } from "zod";
import * as frameworkService from "../services/framework.service.js";
import * as aiService from "../services/ai.service.js";
import { prisma } from "../lib/prisma.js";

// Validation schemas
const createNodeSchema = z.object({
  label: z.string().min(1, "Label node wajib diisi").max(255),
  type: z.enum(["VARIABLE", "CONCEPT", "METHOD", "THEORY", "GAP"]).optional(),
  description: z.string().optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
});

const updateNodeSchema = z.object({
  label: z.string().min(1).max(255).optional(),
  type: z.enum(["VARIABLE", "CONCEPT", "METHOD", "THEORY", "GAP"]).optional(),
  description: z.string().optional(),
  status: z.enum(["UNSUPPORTED", "SUPPORTED", "CONTRADICTORY", "NEEDS_REVIEW"]).optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
  methodCoverage: z.string().optional(),
});

const createEdgeSchema = z.object({
  sourceNodeId: z.string().min(1, "Source node wajib dipilih"),
  targetNodeId: z.string().min(1, "Target node wajib dipilih"),
  relationshipLabel: z.string().max(255).optional(),
});

export async function getFramework(req, res, next) {
  try {
    const data = await frameworkService.getProjectFramework(req.params.projectId, req.user.sub);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function createNode(req, res, next) {
  try {
    const validData = createNodeSchema.parse(req.body);
    const node = await frameworkService.createFrameworkNode(req.params.projectId, req.user.sub, validData);
    res.status(201).json({ success: true, data: node });
  } catch (err) {
    next(err);
  }
}

export async function updateNode(req, res, next) {
  try {
    const validData = updateNodeSchema.parse(req.body);
    const node = await frameworkService.updateFrameworkNode(req.params.nodeId, req.user.sub, validData);
    res.status(200).json({ success: true, data: node });
  } catch (err) {
    next(err);
  }
}

export async function deleteNode(req, res, next) {
  try {
    await frameworkService.deleteFrameworkNode(req.params.nodeId, req.user.sub);
    res.status(200).json({ success: true, message: "Node berhasil dihapus" });
  } catch (err) {
    next(err);
  }
}

export async function createEdge(req, res, next) {
  try {
    const validData = createEdgeSchema.parse(req.body);
    const edge = await frameworkService.createFrameworkEdge(req.params.projectId, req.user.sub, validData);
    res.status(201).json({ success: true, data: edge });
  } catch (err) {
    next(err);
  }
}

export async function deleteEdge(req, res, next) {
  try {
    await frameworkService.deleteFrameworkEdge(req.params.edgeId, req.user.sub);
    res.status(200).json({ success: true, message: "Edge berhasil dihapus" });
  } catch (err) {
    next(err);
  }
}

export async function syncPositions(req, res, next) {
  try {
    const { nodes } = req.body;
    await frameworkService.batchSyncPositions(req.params.projectId, req.user.sub, nodes || []);
    res.status(200).json({ success: true, message: "Posisi node tersinkronisasi" });
  } catch (err) {
    next(err);
  }
}

// AI Smart Recommendation for Relationship between 2 Nodes (Groq LLM)
export async function recommendRelation(req, res, next) {
  try {
    const { sourceNodeId, targetNodeId } = req.body;
    const projectId = req.params.projectId;
    const userId = req.user.sub;

    const project = await prisma.researchProject.findFirst({
      where: { id: projectId, userId },
      include: {
        frameworkNodes: {
          where: { id: { in: [sourceNodeId, targetNodeId] } },
        },
      },
    });

    if (!project) {
      const err = new Error("Project tidak ditemukan");
      err.statusCode = 404;
      throw err;
    }

    const sourceNode = project.frameworkNodes.find((n) => n.id === sourceNodeId) || {
      label: req.body.sourceLabel || "Variabel X",
      type: req.body.sourceType || "VARIABLE",
      description: req.body.sourceDesc || "",
    };

    const targetNode = project.frameworkNodes.find((n) => n.id === targetNodeId) || {
      label: req.body.targetLabel || "Variabel Y",
      type: req.body.targetType || "VARIABLE",
      description: req.body.targetDesc || "",
    };

    const result = await aiService.recommendNodeRelation({
      projectTitle: project.title,
      projectField: project.field,
      sourceNode,
      targetNode,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function generateFromJournals(req, res, next) {
  try {
    const { journalId, mode } = req.body || {};
    const result = await frameworkService.generateFrameworkFromJournals(
      req.params.projectId,
      req.user.sub,
      { journalId, mode }
    );
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function generateDraft(req, res, next) {
  try {
    const result = await frameworkService.generateSkripsiDraftNarrative(
      req.params.projectId,
      req.user.sub
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

