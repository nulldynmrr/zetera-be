import "dotenv/config";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSeed() {
  console.log("═════════════════════════════════════════════════════════════");
  console.log("🌱 ZETERA DATABASE MASTER SEED ENGINE");
  console.log("═════════════════════════════════════════════════════════════\n");

  try {
    // 1. Seed AI Engine, Billing, and Credit Packages
    console.log("▶ [1/2] Menjalankan seed-ai-billing.js...");
    execSync(`node "${path.join(__dirname, "seed-ai-billing.js")}"`, {
      stdio: "inherit",
    });

    // 2. Seed Prompt & Skill Library
    console.log("\n▶ [2/2] Menjalankan seed-prompts.js...");
    execSync(`node "${path.join(__dirname, "seed-prompts.js")}"`, {
      stdio: "inherit",
    });

    console.log("\n═════════════════════════════════════════════════════════════");
    console.log("✨ SELURUH SEEDING BERHASIL DISELESAIKAN DENGAN SUKSES! ✨");
    console.log("═════════════════════════════════════════════════════════════\n");
  } catch (err) {
    console.error("\n❌ Gagal menjalankan database seed:", err.message);
    process.exit(1);
  }
}

runSeed();
