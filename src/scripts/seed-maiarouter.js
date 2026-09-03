import "dotenv/config";
import prisma from "../lib/prisma.js";
import { setSecret } from "../services/config.service.js";

async function main() {
  console.log("=================================================");
  console.log("🚀 MENATA ULANG & MENGELOMPOKKAN SESUAI 2 CURL");
  console.log("=================================================\n");

  // ── GRUP 1: MAIAROUTER CHAT / PROPOSAL (cURL 1) ──
  console.log("📦 GRUP 1: MaiaRouter Chat Completions");
  await setSecret(
    "MAIAROUTER_CHAT_URL",
    "https://api.maiarouter.ai/v1/chat/completions",
    "Endpoint URL Chat Completions MaiaRouter"
  );
  await setSecret(
    "MAIAROUTER_CHAT_MODEL",
    "xai/grok-4-1-fast-non-reasoning",
    "Nama Model Chat LLM (xai/grok-4-1-fast-non-reasoning)"
  );
  await setSecret(
    "MAIAROUTER_API_KEY",
    process.env.MAIAROUTER_API_KEY || "",
    "API Key Bearer untuk Chat LLM (xai/grok-4-1-fast-non-reasoning)"
  );

  // ── GRUP 2: MAIAROUTER EMBEDDINGS / SEARCH ENGINE (cURL 2) ──
  console.log("📦 GRUP 2: MaiaRouter Embeddings & Search Engine");
  await setSecret(
    "MAIAROUTER_EMBEDDING_URL",
    "https://api.maiarouter.ai/v1/embeddings",
    "Endpoint URL Embeddings MaiaRouter"
  );
  await setSecret(
    "MAIAROUTER_EMBEDDING_MODEL",
    "openai/text-embedding-3-small",
    "Nama Model Embedding Vektor (openai/text-embedding-3-small)"
  );
  await setSecret(
    "EMBEDDING_API_KEY",
    process.env.EMBEDDING_API_KEY || "",
    "API Key Bearer Khusus untuk Model Embedding / Vektor"
  );

  // Hapus key lama MAIAROUTER_BASE_URL agar rapi dan tidak membingungkan
  await prisma.systemConfig.deleteMany({
    where: { key: "MAIAROUTER_BASE_URL" },
  });

  console.log("\nMemverifikasi seluruh konfigurasi di Database:");
  const configs = await prisma.systemConfig.findMany({ orderBy: { key: "asc" } });
  for (const c of configs) {
    console.log(`- ${c.key} → ${c.value.slice(0, 45)}...`);
  }

  console.log("\n✓ Selesai menata ulang database!");
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Gagal:", err);
  process.exit(1);
});
