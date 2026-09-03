import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import * as discoveryController from "./journal-discovery.controller.js";

const router = Router({ mergeParams: true });

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `quick-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 35 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf" || file.originalname.endsWith(".pdf")) {
      cb(null, true);
    } else {
      cb(new Error("Hanya file dokumen PDF yang diperbolehkan"), false);
    }
  },
});

router.use(requireAuth);

router.post("/search", discoveryController.searchJournalsHandler);
router.get("/search/:searchId", discoveryController.getCachedSearchHandler);
router.post("/candidates/import", discoveryController.importCandidateHandler);
router.post("/quick-summarize", upload.single("file"), discoveryController.quickSummarizeHandler);

export default router;
