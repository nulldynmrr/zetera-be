import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  const queryToken = req.query.token;

  const token = header && header.startsWith("Bearer ") ? header.slice(7) : queryToken;

  if (!token) {
    return res.status(401).json({ success: false, message: "Token tidak ditemukan" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { sub: userId, role: "ADMIN" | "USER", iat, exp }
    next();
  } catch {
    res.status(401).json({ success: false, message: "Token tidak valid atau sudah expired" });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "ADMIN") {
    return res.status(403).json({ success: false, message: "Akses ditolak: Hanya untuk Administrator" });
  }
  next();
}
