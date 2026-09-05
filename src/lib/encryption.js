import crypto from "crypto";
import "dotenv/config";

// Master key resolution with strict security checks
function resolveMasterSecret() {
  const masterKey = process.env.ENCRYPTION_MASTER_KEY || process.env.JWT_SECRET;
  if (!masterKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "[SECURITY CRITICAL] ENCRYPTION_MASTER_KEY atau JWT_SECRET wajib dikonfigurasi di environment production."
      );
    }
    console.warn(
      "[SECURITY WARNING] ENCRYPTION_MASTER_KEY tidak ditemukan. Menggunakan fallback lokal dev. Pastikan mengisi ENCRYPTION_MASTER_KEY di berkas .env sebelum deploy."
    );
    return "zetera-dev-master-encryption-key-secure-seed-2026";
  }
  return masterKey;
}

const MASTER_SECRET = resolveMasterSecret();
// 32-byte key for AES-256
const ENCRYPTION_KEY = crypto.createHash("sha256").update(MASTER_SECRET).digest();

const GCM_ALGORITHM = "aes-256-gcm";
const LEGACY_CBC_ALGORITHM = "aes-256-cbc";

/**
 * Enkripsi teks rahasia (API Key, password, token) ke format aman terotentikasi (AES-256-GCM)
 * Menyimpan IV (12 byte) dan AuthTag (16 byte) dalam format hex terpadu: `${iv}:${tag}`
 */
export function encryptText(plainText) {
  if (!plainText) return { cipherText: "", iv: "" };
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(GCM_ALGORITHM, ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(plainText, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag();

    return {
      cipherText: encrypted,
      iv: `${iv.toString("hex")}:${authTag.toString("hex")}`,
    };
  } catch (err) {
    console.error("[Encryption] Gagal melakukan enkripsi GCM:", err.message);
    throw err;
  }
}

/**
 * Dekripsi teks rahasia kembali ke teks asli
 * Mendukung AES-256-GCM baru serta backward compatibility untuk legacy AES-256-CBC
 */
export function decryptText(cipherText, ivCombined) {
  if (!cipherText || !ivCombined) return "";
  try {
    // 1. Mode AES-256-GCM terotentikasi (format: iv:authTag)
    if (ivCombined.includes(":")) {
      const [ivHex, tagHex] = ivCombined.split(":");
      const iv = Buffer.from(ivHex, "hex");
      const authTag = Buffer.from(tagHex, "hex");

      const decipher = crypto.createDecipheriv(GCM_ALGORITHM, ENCRYPTION_KEY, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(cipherText, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    }

    // 2. Mode Legacy AES-256-CBC (untuk data lama yang tersimpan sebelum migrasi GCM)
    const iv = Buffer.from(ivCombined, "hex");
    const decipher = crypto.createDecipheriv(LEGACY_CBC_ALGORITHM, ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(cipherText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.error("[Encryption] Gagal mendekripsi secret:", err.message);
    return "";
  }
}
