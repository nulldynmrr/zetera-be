import crypto from "crypto";
import "dotenv/config";

// Master key derivation from JWT_SECRET or ENCRYPTION_MASTER_KEY
const MASTER_SECRET =
  process.env.ENCRYPTION_MASTER_KEY ||
  process.env.JWT_SECRET ||
  "zetera-default-secure-master-encryption-key-2026";

// 32-byte key for AES-256
const ENCRYPTION_KEY = crypto.createHash("sha256").update(MASTER_SECRET).digest();
const ALGORITHM = "aes-256-cbc";

/**
 * Enkripsi teks rahasia (API Key, password, token) ke format aman
 */
export function encryptText(plainText) {
  if (!plainText) return { cipherText: "", iv: "" };
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  return {
    cipherText: encrypted,
    iv: iv.toString("hex"),
  };
}

/**
 * Dekripsi teks rahasia kembali ke teks asli
 */
export function decryptText(cipherText, ivHex) {
  if (!cipherText || !ivHex) return "";
  try {
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(cipherText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.error("Gagal mendekripsi secret:", err.message);
    return "";
  }
}
