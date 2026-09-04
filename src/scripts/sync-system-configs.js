import prisma from "../lib/prisma.js";
import { initDefaultSecrets, getKeyPresets, setSecret, getSecret } from "../services/config.service.js";

async function main() {
  console.log("Menjalankan sinkronisasi system_configs ke Database MySQL...");

  // 1. Refresh presets
  await prisma.systemConfig.deleteMany({
    where: { key: "_SYSTEM_KEY_PRESETS" },
  }).catch(() => {});

  const presets = await getKeyPresets();
  console.log(`✓ Template preset diperbarui (${presets.length} konfigurasi terdaftar).`);

  // 2. Inisialisasi default secrets
  await initDefaultSecrets();

  // 3. Pastikan kunci-kunci dasar terisi jika ada di .env
  const defaults = [
    { key: "ACADEMIC_POLITE_EMAIL", val: process.env.ACADEMIC_POLITE_EMAIL || "admin@zetera.id", desc: "Email polite pool akademis" },
    { key: "GROBID_URL", val: process.env.GROBID_URL || "http://localhost:8070", desc: "GROBID server endpoint" },
  ];

  for (const item of defaults) {
    const existing = await prisma.systemConfig.findUnique({ where: { key: item.key } });
    if (!existing && item.val) {
      await setSecret(item.key, item.val, item.desc);
      console.log(`✓ Default secret diset ke DB: ${item.key}`);
    }
  }

  // 4. Tampilkan semua configs di DB
  const all = await prisma.systemConfig.findMany({ select: { key: true, isEncrypted: true, description: true } });
  console.log("\nDaftar system_configs di Database saat ini:");
  console.table(all);
}

main()
  .catch((e) => {
    console.error("Error syncing system configs:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
