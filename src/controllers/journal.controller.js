import { z } from "zod";
import * as journalService from "../services/journal.service.js";

const createJournalSchema = z.object({
  title: z.string().min(1, "Judul jurnal wajib diisi"),
  authors: z.string().optional(),
  year: z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]).optional(),
  publication: z.string().optional(),
  doi: z.string().optional(),
  url: z.string().optional(),
  abstract: z.string().optional(),
  fullText: z.string().optional(),
  keyFindings: z.string().optional(),
  status: z.enum(["CANDIDATE", "UNDER_REVIEW", "APPROVED", "REJECTED", "ARCHIVED"]).optional(),
  sourceType: z.enum(["PDF", "DOI", "URL", "MANUAL"]).optional(),
  relevanceScore: z.number().optional(),
});

// MASALAH 2: sourcePage sekarang WAJIB (bukan opsional)
// Blueprint §2.1: setiap evidence wajib membawa {page}
const mapEvidenceSchema = z.object({
  nodeId: z.string().min(1, "Node framework wajib dipilih"),
  evidenceType: z.enum(["SUPPORTS", "CONTRADICTS", "MENTIONS"]).optional(),
  quote: z.string().optional(),
  pageNumber: z
    .number({ required_error: "Nomor halaman wajib diisi (blueprint §2.1)" })
    .int("Nomor halaman harus bilangan bulat")
    .positive("Nomor halaman harus positif"),
  confidence: z.number().optional(),
});

export async function listJournals(req, res, next) {
  try {
    const { query, status } = req.query;
    const journals = await journalService.listJournals(req.params.projectId, req.user.sub, { query, status });
    res.status(200).json({ success: true, data: journals });
  } catch (err) {
    next(err);
  }
}

export async function getJournal(req, res, next) {
  try {
    const journal = await journalService.getJournal(req.params.journalId, req.user.sub);
    res.status(200).json({ success: true, data: journal });
  } catch (err) {
    next(err);
  }
}

export async function createJournal(req, res, next) {
  try {
    const validData = createJournalSchema.parse(req.body);
    const journal = await journalService.createJournal(req.params.projectId, req.user.sub, validData);
    res.status(201).json({ success: true, data: journal });
  } catch (err) {
    next(err);
  }
}

export async function updateJournal(req, res, next) {
  try {
    const journal = await journalService.updateJournal(req.params.journalId, req.user.sub, req.body);
    res.status(200).json({ success: true, data: journal });
  } catch (err) {
    next(err);
  }
}

export async function deleteJournal(req, res, next) {
  try {
    await journalService.deleteJournal(req.params.journalId, req.user.sub);
    res.status(200).json({ success: true, message: "Jurnal berhasil dihapus" });
  } catch (err) {
    next(err);
  }
}

export async function purgeRejected(req, res, next) {
  try {
    const result = await journalService.purgeRejectedJournals(req.params.projectId, req.user.sub);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// Upload PDF — hanya ekstraksi lokal, belum screen AI
export async function uploadPdf(req, res, next) {
  try {
    const journal = await journalService.uploadAndParsePdf(req.params.projectId, req.user.sub, req.file);
    res.status(201).json({ success: true, data: journal });
  } catch (err) {
    next(err);
  }
}

export async function lookupDoi(req, res, next) {
  try {
    const { doi } = req.body;
    if (!doi) {
      return res.status(400).json({ success: false, message: "DOI wajib disertakan" });
    }
    const result = await journalService.lookupDoiMetadata(doi);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// MASALAH 1: Re-trigger ekstraksi PDF lokal (jika sebelumnya gagal)
export async function extractJournal(req, res, next) {
  try {
    const journal = await journalService.extractJournal(req.params.journalId, req.user.sub);
    res.status(200).json({
      success: true,
      message: "Ekstraksi PDF berhasil",
      data: journal,
    });
  } catch (err) {
    next(err);
  }
}

// MASALAH 1: AI Tier 1 Screening dari rawExtraction
export async function screenJournal(req, res, next) {
  try {
    const journal = await journalService.screenJournal(req.params.journalId, req.user.sub);
    res.status(200).json({
      success: true,
      message: "Screening AI selesai",
      data: journal,
    });
  } catch (err) {
    next(err);
  }
}

// MASALAH 2: Map evidence — pageNumber wajib via Zod schema
export async function mapEvidence(req, res, next) {
  try {
    const validData = mapEvidenceSchema.parse(req.body);
    const mapping = await journalService.mapNodeEvidence(req.params.journalId, req.user.sub, validData);
    res.status(201).json({ success: true, data: mapping });
  } catch (err) {
    next(err);
  }
}

export async function removeEvidence(req, res, next) {
  try {
    await journalService.removeNodeMapping(req.params.mappingId, req.user.sub);
    res.status(200).json({ success: true, message: "Pemetaan bukti berhasil dihapus" });
  } catch (err) {
    next(err);
  }
}

export async function aiCrosscheck(req, res, next) {
  try {
    const result = await journalService.aiCrosscheckJournal(
      req.params.projectId,
      req.params.journalId,
      req.user.sub
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// ── Overhaul v2: Tier Management ──────────────────────────
export async function updateTier(req, res, next) {
  try {
    const { journalId } = req.params;
    const { tier } = req.body;
    if (!tier) return res.status(400).json({ success: false, message: "Field 'tier' wajib diisi" });
    const updated = await journalService.updateJournalTier(journalId, req.user.sub, tier);
    res.status(200).json({ success: true, data: updated, message: `Tier jurnal diubah ke ${tier}` });
  } catch (err) {
    next(err);
  }
}

// ── Overhaul v2: DOI Verification ─────────────────────────
export async function verifyDoi(req, res, next) {
  try {
    const { journalId } = req.params;
    const result = await journalService.verifyJournalDoi(journalId, req.user.sub);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
