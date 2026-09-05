import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import * as journalController from "../controllers/journal.controller.js";
import discoveryRoutes from "../modules/journal-discovery/journal-discovery.routes.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router({ mergeParams: true });

// Multer Storage Configuration for PDF Uploads
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `journal-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 35 * 1024 * 1024 }, // Max 35MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf" || file.originalname.endsWith(".pdf")) {
      cb(null, true);
    } else {
      cb(new Error("Hanya file dokumen PDF yang diperbolehkan"), false);
    }
  },
});

router.use(requireAuth);

// Base: /api/projects/:projectId/journals
router.get("/", journalController.listJournals);
router.post("/", journalController.createJournal);
router.post("/upload", upload.single("file"), journalController.uploadPdf);
router.post("/doi-lookup", journalController.lookupDoi);
router.delete("/purge-rejected", journalController.purgeRejected);

// ── Journal Discovery & Auto-Search Routes (PRD 011) ────────
router.use("/", discoveryRoutes);

// ── Verified Citation Evidence Endpoints (Strict Provenance) ────────
router.get("/citations", journalController.getAllCitations);
router.delete("/citations/:citationId", journalController.deleteCitation);

router.get("/:journalId", journalController.getJournal);
router.get("/:journalId/pdf-proxy", journalController.streamPdfProxy);
router.patch("/:journalId", journalController.updateJournal);
router.delete("/:journalId", journalController.deleteJournal);

// ── Verified Citation per-Journal ─────────────────────────
router.get("/:journalId/citations", journalController.getJournalCitations);
router.post("/:journalId/extract-citations", journalController.extractCitations);

// MASALAH 1: Pipeline terpisah — extract dulu, baru screen, baru analyze
// Blueprint §1.5: 3 endpoint terpisah supaya retry bisa selektif
router.post("/:journalId/extract", journalController.extractJournal);   // Tier 0: ekstraksi lokal ulang
router.post("/:journalId/screen", journalController.screenJournal);      // Tier 1: AI relevance check (Groq)
router.post("/:journalId/analyze", journalController.aiCrosscheck);      // Tier 2: deep extraction + crosscheck

// MASALAH 2: Evidence mapping — pageNumber sekarang required
router.post("/:journalId/evidence", journalController.mapEvidence);
router.delete("/:journalId/evidence/:mappingId", journalController.removeEvidence);

// ── Overhaul v2: Tiering & DOI Verification ───────────────
router.patch("/:journalId/tier", journalController.updateTier);         // Set PRIMARY/SUPPORTING/EXCLUDED
router.post("/:journalId/verify-doi", journalController.verifyDoi);     // Validasi DOI + set verifiedAt

export default router;
