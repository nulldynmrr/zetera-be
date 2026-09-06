import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { SUBCHAPTER_TAXONOMY } from "../src/services/taxonomy.service.js";

const prisma = new PrismaClient();

const GENERIC_SUBCHAPTER_RECIPE = {
  tag: "__generic__",
  scope: "subchapter",
  label: "Resep Generik Sub-Bab Kustom",
  description: "Resep pemodelan default untuk sub-bab kustom yang ditambahkan pengguna.",
  modelTier: "paid",
  systemPrompt: `Anda adalah Metodolog Penelitian Akademik Senior.
Rancang butir-butir instruksi riset yang sistematis, mendalam, dan terikat pada topik {{TOPIC}} untuk sub-bab {{SUBCHAPTER_TITLE}}.
Fokuskan pada telaah konsep dasar, dimensi/karakteristik penting, dukungan literatur empiris, dan implikasinya terhadap pemecahan masalah penelitian.`,
  steps: [
    { order: 1, instruction: "Kaji konsep fundamental, definisi teoretis, dan ruang lingkup mengenai topik sub-bab." },
    { order: 2, instruction: "Jelaskan karakteristik, dimensi indikator, atau mekanisme teknis yang relevan." },
    { order: 3, instruction: "Bahas temuan empiris atau implementasi dari penelitian terdahulu yang relevan." },
    { order: 4, instruction: "Tautkan hasil kajian ini ke dalam penyelesaian masalah utama penelitian." },
  ],
};

const ACADEMIC_FEATURE_SKILLS = [
  {
    tag: "proofread",
    scope: "feature",
    label: "Proofread Akademik Indonesia (EYD V & PUEBI)",
    description: "Memperbaiki tata bahasa, ejaan baku, dan keefektifan kalimat akademik Indonesia tanpa mengubah makna atau data empiris.",
    modelTier: "paid",
    systemPrompt: `Anda adalah Editor Bahasa Akademik Indonesia Senior bersertifikasi.
Tugas Anda adalah melakukan PROOFREADING naskah akademik berikut agar memenuhi standar tata bahasa baku EYD V / PUEBI.

ATURAN WAJIB:
1. Perbaiki kesalahan ejaan, tanda baca, konjungsi antarkalimat, dan pembentukan kata berimbuhan.
2. Gunakan konstruksi pasif ilmiah secara proporsional ("dilakukan", "ditemukan", "diperoleh").
3. HILANGKAN bahasa informal, kontraksi, dan kata-kata mubazir tanpa mengubah substansi ilmiah.
4. PERTAHANKAN SELURUH MARKER SITASI (contoh: (Sugiyono, 2021), [1], [2]) persis apa adanya tanpa perubahan sedikit pun.
5. DILARANG KERAS mengarang fakta, menambah klaim baru, atau memodifikasi angka/data statistik.
6. Kembalikan HANYA teks hasil revisi tanpa komentar atau penjelasan tambahan.`,
    steps: [],
  },
  {
    tag: "ai_spellcheck",
    scope: "feature",
    label: "Pemeriksa Typo & Ejaan Ringan (KBBI)",
    description: "Pemeriksaan cepat kata salah ketik (typo) dan ejaan baku sesuai KBBI dengan efisiensi tinggi.",
    modelTier: "free",
    systemPrompt: `Anda adalah Asisten Koreksi Ejaan Bahasa Indonesia (KBBI).
Koreksi hanya kata-kata yang salah ketik (typo) dan tanda baca dasar dalam teks naskah.
JANGAN mengubah struktur kalimat, susunan paragraf, atau pilihan kata yang sudah benar.
Pertahankan seluruh tanda sitasi secara utuh. Berikan langsung hasil teks yang sudah diperbaiki.`,
    steps: [],
  },
  {
    tag: "paraphrase",
    scope: "feature",
    label: "Parafrase Akademik & Peningkatan Tone Ilmiah (Tombol Bagusin)",
    description: "Menulis ulang paragraf naskah dengan tone akademik elegan, menghilangkan kalimat berbelit-belit, dan menjaga keaslian sitasi empiris.",
    modelTier: "paid",
    systemPrompt: `Anda adalah Penulis Akademik Indonesia Ahli & Editor Jurnal Ilmiah Terindeks SINTA/Scopus.
Tugas Anda adalah MEMPARAFRASEKAN DAN MEMPERBAGUS (POLISH) naskah akademik berikut agar mengalir elegan, memiliki kepadatan argumen yang kuat, dan bebas dari gaya penulisan mekanis AI.

PRINSIP WAJIB:
1. Tone formal-objektif: hindari kata ganti orang pertama ("saya", "penulis", "kami") dan frasa klise ("Dalam era globalisasi saat ini", "Tidak dapat dipungkiri").
2. Transisi logis mengalir: selingi kalimat kompleks dengan kalimat tegas ringkas, hilangkan kalimat berputar-putar.
3. KONSISTENSI SITASI MUTLAK: Seluruh penanda sitasi naskah asli (misal: (Pratama & Utami, 2023), [3], hal. 45) WAJIB DIPERTAHANKAN PERSIS VERBATIM di posisi yang sesuai secara konteks.
4. INTEGRITAS FAKTA: Jangan sekali-kali mengarang fakta, menambah temuan fiktif, atau mengubah angka statistik.
5. Kembalikan HANYA teks naskah hasil parafrase akademik yang sudah rapi dan siap pakai.`,
    steps: [],
  },
  {
    tag: "plagiarism_check",
    scope: "feature",
    label: "Pemeriksa Kemiripan Teks & Verifikasi Kutipan Jurnal",
    description: "Menganalisis kemiripan naskah terhadap pool jurnal referensi penelitian serta mendeteksi potensi kutipan yang belum teratribusi.",
    modelTier: "paid",
    systemPrompt: `Anda adalah Academic Integrity & Similarity Auditor.
Analisis draf naskah yang diberikan terhadap daftar teks referensi dan jurnal dalam pool riset.
Deteksi frasa atau kalimat yang memiliki kesamaan verbatim tinggi atau parafrase dangkal tanpa atribusi yang cukup.
Format output JSON:
{
  "similarityScore": number, // 0-100%
  "matchedSources": [
    { "title": string, "matchedSnippet": string, "draftSnippet": string, "suggestion": string }
  ],
  "summary": string
}`,
    steps: [],
  },
  {
    tag: "citation_generator",
    scope: "feature",
    label: "Generator Sitasi Otomatis (APA 7th & IEEE)",
    description: "Memformat metadata artikel jurnal menjadi sitasi teks dan daftar pustaka standar APA 7th atau IEEE.",
    modelTier: "free",
    systemPrompt: `Formatkan metadata referensi jurnal menjadi sitasi dalam-teks dan daftar pustaka resmi sesuai gaya sitasi yang diminta (APA 7th atau IEEE).`,
    steps: [],
  },
];

async function main() {
  console.log("🌱 Seeding PromptTemplate table & updating prompt library...");

  // 1. Seed 19 Subchapter Templates
  for (const [tag, item] of Object.entries(SUBCHAPTER_TAXONOMY)) {
    const existing = await prisma.promptTemplate.findFirst({
      where: { tag, scope: "subchapter", isActive: true },
    });

    const steps = (item.defaultRecipeSteps || []).map((step, idx) => ({
      order: idx + 1,
      instruction: step,
      variables: ["TOPIC", "SUBCHAPTER_TITLE"],
    }));

    if (!existing) {
      await prisma.promptTemplate.create({
        data: {
          tag,
          scope: "subchapter",
          label: `Resep Standar: ${item.defaultTitle}`,
          description: `Panduan pemodelan akademik standar untuk sub-bab ${item.defaultTitle} (Bab ${item.bab}).`,
          systemPrompt: `Anda adalah Research Blueprint Architect & Metodolog Skripsi Ahli.
Rancang instruksi riset yang konkret, mendalam, dan terikat ketat pada topik {{TOPIC}} untuk sub-bab ${item.defaultTitle}.`,
          steps,
          modelTier: "paid",
          version: 1,
          isActive: true,
          createdBy: "system",
        },
      });
      console.log(`  ✓ Created PromptTemplate [subchapter]: ${tag}`);
    } else {
      console.log(`  - Exists PromptTemplate [subchapter]: ${tag} (v${existing.version})`);
    }
  }

  // 2. Seed Generic Subchapter Recipe
  const existingGeneric = await prisma.promptTemplate.findFirst({
    where: { tag: GENERIC_SUBCHAPTER_RECIPE.tag, scope: "subchapter", isActive: true },
  });
  if (!existingGeneric) {
    await prisma.promptTemplate.create({
      data: {
        ...GENERIC_SUBCHAPTER_RECIPE,
        version: 1,
        isActive: true,
        createdBy: "system",
      },
    });
    console.log(`  ✓ Created PromptTemplate [subchapter]: __generic__`);
  }

  // 3. Seed 5 Academic Feature Skills
  for (const skill of ACADEMIC_FEATURE_SKILLS) {
    const existingSkill = await prisma.promptTemplate.findFirst({
      where: { tag: skill.tag, scope: "feature", isActive: true },
    });

    if (!existingSkill) {
      await prisma.promptTemplate.create({
        data: {
          tag: skill.tag,
          scope: "feature",
          label: skill.label,
          description: skill.description,
          systemPrompt: skill.systemPrompt,
          steps: skill.steps,
          modelTier: skill.modelTier,
          version: 1,
          isActive: true,
          createdBy: "system",
        },
      });
      console.log(`  ✓ Created PromptTemplate [feature]: ${skill.tag}`);
    } else {
      console.log(`  - Exists PromptTemplate [feature]: ${skill.tag} (v${existingSkill.version})`);
    }

    // Pastikan juga terdaftar di AiSkillPrompt agar kompatibel dengan panel admin
    const code = `SKILL_${skill.tag.toUpperCase()}`;
    await prisma.aiSkillPrompt.upsert({
      where: { code },
      update: {
        title: skill.label,
        category: "SKILL",
        tags: [skill.tag, skill.scope, skill.modelTier],
        description: skill.description,
        systemPrompt: skill.systemPrompt,
        isActive: true,
      },
      create: {
        code,
        title: skill.label,
        category: "SKILL",
        tags: [skill.tag, skill.scope, skill.modelTier],
        description: skill.description,
        systemPrompt: skill.systemPrompt,
        recipeSteps: [],
        version: 1,
        isActive: true,
        isSystem: true,
      },
    });
  }

  console.log("\n✅ PromptTemplate seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
