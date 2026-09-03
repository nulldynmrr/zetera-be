import readline from "readline";
import "dotenv/config";
import prisma from "../lib/prisma.js";
import { setSecret, getSecret } from "../services/config.service.js";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

const DEFAULT_KEYS = [
  {
    key: "GROQ_API_KEY_FRAMEWORK_RELASI",
    label: "Groq API Key (Rekomendasi Relasi Node)",
    desc: "Digunakan untuk AI Smart Recommendation relasi antar node di kanvas",
  },
  {
    key: "GROQ_API_KEY_FRAMEWORK_CROSS_CHECK_JURNAL",
    label: "Groq API Key (Cross-Check & Screening Jurnal)",
    desc: "Digunakan untuk AI Screening dan telaah silang intisari artikel jurnal",
  },
  {
    key: "GROQ_API_KEY_FRAMEWORK_GENARATE_NODE",
    label: "Groq API Key (Sintesis & Bangun Node Kerangka)",
    desc: "Digunakan untuk AI Auto-Generation sintesis pohon kerangka & kutipan verbatim",
  },
];

async function main() {
  console.log("================================================================");
  console.log(" 🔒 ZETERA SECURE DATABASE API KEY MANAGER (ENCRYPTED STORAGE) ");
  console.log("================================================================");
  console.log("API Key disimpan langsung ke MySQL dalam bentuk Ciphertext AES-256.");
  console.log("TIDAK PERLU disimpan dalam plaintext .env!\n");

  // 1. Tampilkan status key saat ini di Database
  console.log("📋 STATUS API KEY DI DATABASE SAAT INI:");
  console.log("----------------------------------------------------------------");
  for (const item of DEFAULT_KEYS) {
    const val = await getSecret(item.key);
    const masked = val ? `${val.slice(0, 8)}...${val.slice(-4)}` : "(Belum diset / Kosong)";
    const dbRecord = await prisma.systemConfig.findUnique({ where: { key: item.key } });
    
    console.log(`• Key: ${item.key}`);
    console.log(`  Nama      : ${item.label}`);
    console.log(`  Status    : ${val ? "✅ AKTIF TERENKRIPSI" : "⚠️ KOSONG"}`);
    console.log(`  Nilai     : ${masked}`);
    if (dbRecord) {
      console.log(`  DB Cipher : ${dbRecord.value.slice(0, 24)}... (IV: ${dbRecord.iv})`);
    }
    console.log("");
  }
  console.log("----------------------------------------------------------------\n");

  console.log("Pilihan Aksi:");
  console.log("1. Perbarui / Masukkan API Key Satu per Satu (Interaktif)");
  console.log("2. Set Cepat dari Argument CLI / Default");
  console.log("3. Keluar\n");

  const choice = await question("Pilih nomor (1/2/3): ");

  if (choice.trim() === "1") {
    console.log("\n--- Silakan masukkan nilai API Key baru (atau tekan Enter untuk lewati) ---\n");
    for (const item of DEFAULT_KEYS) {
      const currentVal = await getSecret(item.key);
      const promptText = `${item.label}\n[${item.key}] (Current: ${currentVal ? `${currentVal.slice(0, 8)}...` : "kosong"}): `;
      const inputVal = await question(promptText);

      if (inputVal.trim()) {
        await setSecret(item.key, inputVal.trim(), item.desc);
        console.log(`✓ Berhasil mengenkripsi dan menyimpan "${item.key}" ke Database!\n`);
      } else {
        console.log(`- Dilewati (nilai tidak diubah).\n`);
      }
    }
  } else if (choice.trim() === "2") {
    console.log("\nMenyimpan default key terenkripsi ke database...");
    for (const item of DEFAULT_KEYS) {
      const val = process.env[item.key] || process.env.GROQ_API_KEY || "";
      await setSecret(item.key, val, item.desc);
      console.log(`✓ Tersimpan: ${item.key}`);
    }
  }

  console.log("\n================================================================");
  console.log(" ✓ PENGATURAN SELESAI. DATABASE TELAH TERSINKRONISASI DENGAN AMAN. ");
  console.log("================================================================");
  rl.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Error:", err);
  rl.close();
  process.exit(1);
});
