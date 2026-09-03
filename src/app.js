import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import "dotenv/config";

import authRoutes from "./routes/auth.routes.js";
import projectRoutes from "./routes/project.routes.js";
import frameworkRoutes from "./routes/framework.routes.js";
import journalRoutes from "./routes/journal.routes.js";
import screeningRoutes from "./routes/screening.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import templateRoutes from "./routes/template.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import proposalRoutes from "./routes/proposal.routes.js";
import memoryRoutes from "./routes/memory.routes.js";
import promptRoutes from "./routes/prompt.routes.js";
import { seedDefaultTemplate } from "./services/template.service.js";
import { initDefaultSecrets } from "./services/config.service.js";

const app = express();

// Auto-seed default template & encrypted database secrets in background on server boot
seedDefaultTemplate().catch((err) => {
  console.warn("Auto-seed template warning:", err.message);
});
initDefaultSecrets().catch((err) => {
  console.warn("Init default encrypted secrets warning:", err.message);
});

// Ensure uploads folder exists
const uploadDir = path.resolve("uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ── Middleware global ──────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      origin.includes("localhost") ||
      origin.includes("127.0.0.1") ||
      origin === process.env.FRONTEND_URL
    ) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
}));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve static uploads
app.use("/uploads", express.static(uploadDir));

// ── Routes ────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/prompts", promptRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/projects/:projectId/framework", frameworkRoutes);
app.use("/api/projects/:projectId/journals", journalRoutes);
app.use("/api/projects/:projectId/screening", screeningRoutes);
app.use("/api/projects/:projectId/proposal", proposalRoutes);
app.use("/api/projects/:projectId/memory", memoryRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/admin", adminRoutes);

// ── 404 handler ───────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} tidak ditemukan` });
});

// ── Global error handler ──────────────────────────
app.use((err, req, res, _next) => {
  // Zod validation error
  if (err.name === "ZodError") {
    const messages = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
    return res.status(400).json({ success: false, message: "Validasi gagal", errors: messages });
  }

  // Multer error
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ success: false, message: "Ukuran file terlalu besar (maksimal 35MB)" });
  }

  const status = err.statusCode || 500;
  const message = status === 500 ? (err.message || "Internal server error") : err.message;

  if (status === 500) console.error("[ERROR]", err);

  res.status(status).json({ success: false, message });
});

export default app;
