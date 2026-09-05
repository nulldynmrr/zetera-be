import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  let token = null;

  if (header && header.startsWith("Bearer ")) {
    token = header.slice(7).trim();
  } else if (req.query.token) {
    // Hanya izinkan token lewat query URL pada streaming PDF/media di mana tag <iframe> atau <embed> tidak bisa mengirim custom header
    const isPdfProxyPath = req.path.includes("/pdf-proxy") || req.path === "/api/proxy-pdf";
    if (isPdfProxyPath) {
      token = String(req.query.token).trim();
    } else {
      return res.status(401).json({
        success: false,
        message: "Pengiriman token melalui query URL dilarang untuk endpoint ini. Gunakan header Authorization: Bearer <token>",
      });
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, message: "Token autentikasi tidak ditemukan" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { sub: userId, role: "ADMIN" | "USER", iat, exp }
    next();
  } catch {
    res.status(401).json({ success: false, message: "Token tidak valid atau sudah kedaluwarsa" });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "ADMIN") {
    return res.status(403).json({ success: false, message: "Akses ditolak: Hanya untuk Administrator" });
  }
  next();
}
