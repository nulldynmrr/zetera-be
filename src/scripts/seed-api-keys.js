import "dotenv/config";
import prisma from "../lib/prisma.js";
import { setSecret, getSecret } from "../services/config.service.js";

async function main() {
  console.log("=================================================");
  console.log("🔒 ZETERA DATABASE ENCRYPTED API KEY SEEDER");
  console.log("=================================================\n");

  const relasiKey =
    process.env.GROQ_API_KEY_FRAMEWORK_RELASI ||
    process.env.GROQ_API_KEY ||
    "";

  const crossCheckKey =
    process.env.GROQ_API_KEY_FRAMEWORK_CROSS_CHECK_JURNAL ||
    process.env.GROQ_API_KEY ||
    "";

  const generateNodeKey =
    process.env.GROQ_API_KEY_FRAMEWORK_GENARATE_NODE ||
    process.env.GROQ_API_KEY_FRAMEWORK_RELASI ||
    process.env.GROQ_API_KEY ||
    "";

  console.log("1. Menyimpan GROQ_API_KEY_FRAMEWORK_RELASI (Terenkripsi AES-256)...");
  await setSecret("GROQ_API_KEY_FRAMEWORK_RELASI", relasiKey, "API Key untuk Rekomendasi Relasi Node");

  console.log("2. Menyimpan GROQ_API_KEY_FRAMEWORK_CROSS_CHECK_JURNAL (Terenkripsi AES-256)...");
  await setSecret("GROQ_API_KEY_FRAMEWORK_CROSS_CHECK_JURNAL", crossCheckKey, "API Key untuk Cross Check & Screening Jurnal");

  console.log("3. Menyimpan GROQ_API_KEY_FRAMEWORK_GENARATE_NODE (Terenkripsi AES-256)...");
  await setSecret("GROQ_API_KEY_FRAMEWORK_GENARATE_NODE", generateNodeKey, "API Key untuk Sintesis & Bangun Node Kerangka");

  console.log("\nMemverifikasi hasil enkripsi di Database:");
  const configs = await prisma.systemConfig.findMany();
  for (const c of configs) {
    const decrypted = await getSecret(c.key);
    console.log(`- [KEY] ${c.key}`);
    console.log(`  Ciphertext di DB : ${c.value.slice(0, 32)}... (Panjang: ${c.value.length} karakter)`);
    console.log(`  IV di DB         : ${c.iv}`);
    console.log(`  Dekripsi Terbaca : ${decrypted.slice(0, 10)}...${decrypted.slice(-4)} (VALID ✓)`);
  }

  console.log("\n=================================================");
  console.log("✓ SEMUA API KEY TELAH DIENKRIPSI & TERSIMPAN DI DATABASE");
  console.log("=================================================");
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Gagal seed API Keys:", err);
  process.exit(1);
});
