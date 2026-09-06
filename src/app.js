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

import { requireAuth } from "./middlewares/auth.middleware.js";

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

// ── SSRF Guard Helper ──────────────────────────────
function isSafeExternalUrl(targetUrl) {
  try {
    const parsed = new URL(targetUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { safe: false, reason: "Protokol harus http: atau https:" };
    }

    const hostname = parsed.hostname.toLowerCase();

    // 1. Tolak hostname loopback & internal domain
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal")
    ) {
      return { safe: false, reason: "Akses ke hostname lokal/internal dilarang" };
    }

    // 2. Tolak IPv4 loopback & subnet privat (RFC 1918 + Link-Local Cloud Metadata)
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipv4Match = hostname.match(ipv4Regex);
    if (ipv4Match) {
      const o1 = Number(ipv4Match[1]);
      const o2 = Number(ipv4Match[2]);
      if (o1 === 127) return { safe: false, reason: "Akses ke IP loopback (127.0.0.0/8) dilarang" };
      if (o1 === 10) return { safe: false, reason: "Akses ke subnet privat (10.0.0.0/8) dilarang" };
      if (o1 === 172 && o2 >= 16 && o2 <= 31) return { safe: false, reason: "Akses ke subnet privat (172.16.0.0/12) dilarang" };
      if (o1 === 192 && o2 === 168) return { safe: false, reason: "Akses ke subnet privat (192.168.0.0/16) dilarang" };
      if (o1 === 169 && o2 === 254) return { safe: false, reason: "Akses ke cloud metadata / link-local (169.254.0.0/16) dilarang" };
      if (o1 === 0) return { safe: false, reason: "Akses ke IP non-routable 0.0.0.0 dilarang" };
    }

    // 3. Tolak IPv6 loopback / unique local
    if (
      hostname === "[::1]" ||
      hostname === "::1" ||
      hostname.startsWith("fc00:") ||
      hostname.startsWith("fd") ||
      hostname.startsWith("fe80:")
    ) {
      return { safe: false, reason: "Akses ke IPv6 privat/loopback dilarang" };
    }

    return { safe: true };
  } catch {
    return { safe: false, reason: "Format URL tidak valid" };
  }
}

// ── Middleware global ──────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "https://zetera.vercel.app",
].filter(Boolean);

// Dukungan Private Network Access (PNA) untuk Chrome saat akses dari HTTPS (Vercel) ke localhost
app.use((req, res, next) => {
  if (req.headers["access-control-request-private-network"]) {
    res.setHeader("Access-Control-Allow-Private-Network", "true");
  }
  next();
});

app.use(cors({
  origin: (origin, callback) => {
    // Izinkan request tanpa origin (mobile apps, server-to-server, curl, Postman)
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      origin.startsWith("http://localhost:") ||
      origin.startsWith("http://127.0.0.1:") ||
      origin.endsWith(".vercel.app")
    ) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Access-Control-Request-Private-Network"],
}));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve static uploads
app.use("/uploads", express.static(uploadDir));

// PDF Proxy Endpoint for embedded split-screen viewing without X-Frame-Options or CORS blocks
// Protected with requireAuth and SSRF guard
app.get("/api/proxy-pdf", requireAuth, async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send("Parameter URL wajib disertakan");

  const safety = isSafeExternalUrl(targetUrl);
  if (!safety.safe) {
    return res.status(403).send(`Permintaan ditolak demi keamanan (SSRF): ${safety.reason}`);
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "application/pdf,application/octet-stream,*/*",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return res
        .status(response.status)
        .send(`Gagal mengambil naskah PDF (${response.status}): ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "application/pdf";
    if (contentType.toLowerCase().includes("text/html")) {
      return res.status(415).send("URL target mengembalikan halaman web (HTML), bukan berkas PDF.");
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline");
    res.removeHeader("X-Frame-Options");
    res.removeHeader("Content-Security-Policy");

    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error("PDF Proxy error:", err);
    res.status(500).send(`Gagal memuat PDF: ${err.message}`);
  }
});

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
