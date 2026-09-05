import { z } from "zod";
import * as projectService from "../services/project.service.js";
import * as proposalFlowService from "../services/proposal-flow.service.js";

const createProjectSchema = z.object({
  title: z.string().min(3, "Judul project minimal 3 karakter"),
  description: z.string().optional(),
  field: z.string().optional(),
  nama: z.string().optional(),
  logoUrl: z.string().optional(),
  prodi: z.string().optional(),
  kelas: z.string().optional(),
  approachType: z.string().optional(),
  approachConfig: z.any().optional(),
  commonNarrative: z.any().optional(),
  customOutline: z.any().optional(),
  citationStyle: z.string().optional(),
});

const updateProjectSchema = z.object({
  title: z.string().min(3, "Judul project minimal 3 karakter").optional(),
  description: z.string().optional(),
  field: z.string().optional(),
  nama: z.string().optional(),
  logoUrl: z.string().optional(),
  prodi: z.string().optional(),
  kelas: z.string().optional(),
  approachType: z.string().optional(),
  approachConfig: z.any().optional(),
  commonNarrative: z.any().optional(),
  customOutline: z.any().optional(),
  citationStyle: z.string().optional(),
  status: z.enum(["ACTIVE", "ARCHIVED", "COMPLETED"]).optional(),
});

export async function listProjects(req, res, next) {
  try {
    const projects = await projectService.getUserProjects(req.user.sub);
    res.status(200).json({ success: true, data: projects });
  } catch (err) {
    next(err);
  }
}

export async function getProject(req, res, next) {
  try {
    const project = await projectService.getProjectById(req.params.id, req.user.sub);
    res.status(200).json({ success: true, data: project });
  } catch (err) {
    next(err);
  }
}

export async function createProject(req, res, next) {
  try {
    const body = createProjectSchema.parse(req.body);

    // Auto-refine dengan Groq jika latar belakang atau tujuan masih sangat pendek / ngasal (< 15 karakter)
    const bg = body.commonNarrative?.background?.trim() || "";
    const purp = body.commonNarrative?.purpose?.trim() || "";
    if (bg.length < 15 || purp.length < 10) {
      try {
        const refined = await proposalFlowService.refineProposalNarrative({
          title: body.title,
          field: body.field || body.prodi,
          approachType: body.approachType,
          approachConfig: body.approachConfig,
          currentBackground: bg,
          currentPurpose: purp,
          currentScope: body.commonNarrative?.scope || "",
          userId: req.user.sub,
        });
        if (refined) {
          body.commonNarrative = {
            ...(body.commonNarrative || {}),
            background: refined.background || bg,
            purpose: refined.purpose || purp,
            scope: refined.scope || body.commonNarrative?.scope || "",
          };
        }
      } catch (refineErr) {
        console.warn("Auto-refine narrative fallback on create:", refineErr.message);
      }
    }

    const project = await projectService.createProject(req.user.sub, body);
    res.status(201).json({ success: true, data: project });
  } catch (err) {
    next(err);
  }
}

// ── AI Refine Narasi Umum (Latar Belakang, Tujuan, Batasan) ──
export async function refineNarrative(req, res, next) {
  try {
    const {
      title,
      field,
      approachType,
      approachConfig,
      currentBackground,
      currentPurpose,
      currentScope,
    } = req.body;

    const refined = await proposalFlowService.refineProposalNarrative({
      title,
      field,
      approachType,
      approachConfig,
      currentBackground,
      currentPurpose,
      currentScope,
      userId: req.user?.sub,
    });

    res.status(200).json({ success: true, data: refined });
  } catch (err) {
    next(err);
  }
}

export async function updateProject(req, res, next) {
  try {
    const body = updateProjectSchema.parse(req.body);
    const project = await projectService.updateProject(req.params.id, req.user.sub, body);
    res.status(200).json({ success: true, data: project });
  } catch (err) {
    next(err);
  }
}

export async function deleteProject(req, res, next) {
  try {
    await projectService.deleteProject(req.params.id, req.user.sub);
    res.status(200).json({ success: true, message: "Project berhasil dihapus" });
  } catch (err) {
    next(err);
  }
}

// ── AI Brainstorming Topik ──
export async function brainstormTopics(req, res, next) {
  try {
    const { minat, kataKunci, masalahDitemukan, constraints, field } = req.body;
    const candidates = await proposalFlowService.brainstormTopics({
      minat,
      kataKunci,
      masalahDitemukan,
      constraints,
      field,
      userId: req.user?.sub,
    });
    res.status(200).json({ success: true, data: candidates });
  } catch (err) {
    next(err);
  }
}

// ── AI Rekomendasi Sub-Bab (Outline) ──
export async function recommendOutline(req, res, next) {
  try {
    const { title, field, approachType, approachConfig } = req.body;
    const outline = await proposalFlowService.recommendOutline({
      title,
      field,
      approachType,
      approachConfig,
      userId: req.user?.sub,
    });
    res.status(200).json({ success: true, data: outline });
  } catch (err) {
    next(err);
  }
}

// ── Sinkronisasi Proposal ke Kanvas Framework ──
export async function syncProposalToFramework(req, res, next) {
  try {
    const { proposalText } = req.body;
    const result = await proposalFlowService.syncProposalToFramework({
      projectId: req.params.id,
      userId: req.user?.sub,
      proposalText,
    });
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// ── Overhaul v2: Custom Outline (Daftar Isi Builder) ──
export async function getCustomOutline(req, res, next) {
  try {
    const result = await projectService.getCustomOutline(req.params.id, req.user.sub);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function saveCustomOutline(req, res, next) {
  try {
    const { customOutline } = req.body;
    const result = await projectService.saveCustomOutline(req.params.id, req.user.sub, customOutline);
    res.status(200).json({ success: true, data: result, message: "Struktur Daftar Isi berhasil disimpan." });
  } catch (err) {
    next(err);
  }
}

export async function aiSuggestSubchapters(req, res, next) {
  try {
    const { babNumber, currentOutline } = req.body;
    const subChapters = await projectService.aiSuggestSubchapters({
      projectId: req.params.id,
      userId: req.user.sub,
      babNumber,
      currentOutline,
    });
    res.status(200).json({ success: true, data: subChapters });
  } catch (err) {
    next(err);
  }
}


