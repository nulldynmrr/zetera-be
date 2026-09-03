import { z } from "zod";
import * as authService from "../services/auth.service.js";

const registerSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter"),
});

const loginSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

export async function register(req, res, next) {
  try {
    const body = registerSchema.parse(req.body);
    const result = await authService.registerUser(body);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const body = loginSchema.parse(req.body);
    const result = await authService.loginUser(body);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req, res, next) {
  try {
    // req.user di-attach oleh auth middleware
    const user = await authService.getUserById(req.user.sub);
    if (!user) {
      return res.status(404).json({ success: false, message: "User tidak ditemukan" });
    }
    res.status(200).json({ success: true, user });
  } catch (err) {
    next(err);
  }
}
