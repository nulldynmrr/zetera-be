import prisma from "../src/lib/prisma.js";

async function main() {
  const systemPrompt = `Anda adalah Pakar Parafrase Akademik Indonesia & Senior Scientific Editor.
Tugas utama Anda adalah memparafrasekan naskah akademik skripsi/makalah dengan aturan MUTLAK berikut:
1. PRESERVASI MAKNA 100%: Dilarang mengubah makna esensial, inti argumen, klaim ilmiah, proposisi teoretis, angka, rumus, tahun, atau temuan empiris sedikit pun.
2. WAJIB PERTAHANKAN SELURUH SITASI & RUJUKAN: Penanda sitasi seperti (Nama, Tahun), (Nama dkk., Tahun), nomor kurung siku [1], atau catatan rujukan HARUS dipertahankan persis pada posisinya yang relevan.
3. STRUKTUR KALIMAT VARIATIF, BAKU & ELEGAN:
   - Gunakan kaidah Tata Bahasa Baku Bahasa Indonesia (EYD V dan KBBI).
   - Hilangkan pemborosan kata (pleonasme) dan pengulangan leksikal yang kaku.
   - Ubah kalimat pasif berbelit-belit menjadi konstruksi kalimat yang lebih tegas, lugas, dan mengalir kohesif antar-paragraf.
   - Hindari gaya bahasa santai atau terjemahan mesin yang kaku.
4. FORMAT OUTPUT: Berikan HANYA teks naskah hasil parafrase tanpa kalimat pembuka (seperti 'Berikut hasil parafrase...'), tanpa penutup, dan tanpa tanda kutip pembungkus.`;

  // 1. Ensure ResearchFeature PROPOSAL_SECTION_SYNTHESIS exists and routed to PAID model
  const feat = await prisma.researchFeature.upsert({
    where: { code: "PROPOSAL_SECTION_SYNTHESIS" },
    update: {
      label: "Sintesis & Parafrase Naskah Proposal",
      description: "Pemolesan, proofreading EYD V, dan parafrase akademik naskah tanpa mengubah makna",
      baseCreditCost: 2,
      isActive: true,
    },
    create: {
      code: "PROPOSAL_SECTION_SYNTHESIS",
      label: "Sintesis & Parafrase Naskah Proposal",
      description: "Pemolesan, proofreading EYD V, dan parafrase akademik naskah tanpa mengubah makna",
      baseCreditCost: 2,
      isActive: true,
    },
  });

  await prisma.featureRouting.upsert({
    where: { featureId: feat.id },
    update: {
      primaryModelId: "xai-grok-reasoning",
      fallbackModelId: "xai-grok-fast",
    },
    create: {
      featureId: feat.id,
      primaryModelId: "xai-grok-reasoning",
      fallbackModelId: "xai-grok-fast",
    },
  });

  // 2. Ensure PARAPHRASE_ACADEMIC feature exists
  const featPara = await prisma.researchFeature.upsert({
    where: { code: "PARAPHRASE_ACADEMIC" },
    update: {
      label: "Parafrase Akademik Tanpa Mengubah Makna",
      description: "Parafrase kalimat ilmiah formal berstandar EYD V dengan preservasi 100% makna dan sitasi",
      baseCreditCost: 2,
      isActive: true,
    },
    create: {
      code: "PARAPHRASE_ACADEMIC",
      label: "Parafrase Akademik Tanpa Mengubah Makna",
      description: "Parafrase kalimat ilmiah formal berstandar EYD V dengan preservasi 100% makna dan sitasi",
      baseCreditCost: 2,
      isActive: true,
    },
  });

  await prisma.featureRouting.upsert({
    where: { featureId: featPara.id },
    update: {
      primaryModelId: "xai-grok-reasoning",
      fallbackModelId: "xai-grok-fast",
    },
    create: {
      featureId: featPara.id,
      primaryModelId: "xai-grok-reasoning",
      fallbackModelId: "xai-grok-fast",
    },
  });

  // 3. Upsert AiSkillPrompt
  await prisma.aiSkillPrompt.upsert({
    where: { code: "PARAPHRASE_ACADEMIC" },
    update: {
      title: "Parafrase Akademik Tanpa Mengubah Makna",
      category: "SKILL",
      tags: ["parafrase", "akademik", "tanpa_ubah_makna", "eyd_v", "sitasi_preservasi"],
      description: "Menulis ulang kalimat akademik menjadi lebih lugas, baku, dan variatif dengan preservasi 100% makna dan penanda sitasi.",
      systemPrompt,
      userPromptTemplate: "Parafrasekan naskah akademik berikut dengan tetap mempertahankan makna dan sitasi:\n\n{TEXT}",
      recipeSteps: [
        "Identifikasi proposisi utama dan seluruh marker sitasi (Author, Year)",
        "Susun ulang struktur klausa (inversi/aktif-pasif) untuk mengoptimalkan kohesi",
        "Ganti kata-kata non-baku dan pleonasme dengan istilah akademik presisi",
        "Validasi kembali bahwa tidak ada informasi baru yang ditambahkan dan tidak ada sitasi yang terhapus",
      ],
      isActive: true,
      isSystem: true,
    },
    create: {
      code: "PARAPHRASE_ACADEMIC",
      title: "Parafrase Akademik Tanpa Mengubah Makna",
      category: "SKILL",
      tags: ["parafrase", "akademik", "tanpa_ubah_makna", "eyd_v", "sitasi_preservasi"],
      description: "Menulis ulang kalimat akademik menjadi lebih lugas, baku, dan variatif dengan preservasi 100% makna dan penanda sitasi.",
      systemPrompt,
      userPromptTemplate: "Parafrasekan naskah akademik berikut dengan tetap mempertahankan makna dan sitasi:\n\n{TEXT}",
      recipeSteps: [
        "Identifikasi proposisi utama dan seluruh marker sitasi (Author, Year)",
        "Susun ulang struktur klausa (inversi/aktif-pasif) untuk mengoptimalkan kohesi",
        "Ganti kata-kata non-baku dan pleonasme dengan istilah akademik presisi",
        "Validasi kembali bahwa tidak ada informasi baru yang ditambahkan dan tidak ada sitasi yang terhapus",
      ],
      isActive: true,
      isSystem: true,
    },
  });

  // 4. Upsert PromptTemplate for tag: paraphrase
  const existingTpl = await prisma.promptTemplate.findFirst({
    where: { tag: "paraphrase", scope: "feature" },
  });

  if (existingTpl) {
    await prisma.promptTemplate.update({
      where: { id: existingTpl.id },
      data: {
        systemPrompt,
        label: "Parafrase Akademik Tanpa Mengubah Makna",
        description: "Preservasi 100% makna dan penanda sitasi sesuai kaidah EYD V",
        modelTier: "paid",
        isActive: true,
      },
    });
  } else {
    await prisma.promptTemplate.create({
      data: {
        tag: "paraphrase",
        scope: "feature",
        label: "Parafrase Akademik Tanpa Mengubah Makna",
        description: "Preservasi 100% makna dan penanda sitasi sesuai kaidah EYD V",
        systemPrompt,
        userPromptTemplate: "Parafrasekan naskah akademik berikut dengan tetap mempertahankan makna dan sitasi:\n\n{TEXT}",
        modelTier: "paid",
        isActive: true,
      },
    });
  }

  console.log("SUCCESS: All seeds applied!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
