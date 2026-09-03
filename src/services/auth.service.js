import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = "7d";

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role || "USER" }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export async function registerUser({ name, email, password, role = "USER" }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const err = new Error("Email sudah terdaftar");
    err.statusCode = 409;
    throw err;
  }

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email, password: hashed, role: role === "ADMIN" ? "ADMIN" : "USER" },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  const token = signToken(user);
  return { user, token };
}

export async function loginUser({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const err = new Error("Email atau password salah");
    err.statusCode = 401;
    throw err;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    const err = new Error("Email atau password salah");
    err.statusCode = 401;
    throw err;
  }

  const { password: _, ...safeUser } = user;
  const token = signToken(user);
  return { user: safeUser, token };
}

export async function getUserById(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  return user;
}
