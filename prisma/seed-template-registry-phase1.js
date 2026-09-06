import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("═════════════════════════════════════════════════════════════");
  console.log("🌱 ZETERA PHASE 1: TEMPLATE & SECTION TYPE REGISTRY SEED");
  console.log("═════════════════════════════════════════════════════════════\n");

  // 1. LanguageStyleRuleset (§12.1)
  console.log("▶ [1/5] Inisialisasi LanguageStyleRuleset...");
  let languageStyle = await prisma.languageStyleRuleset.findFirst({
    where: { name: "Formal Baku & Orang Ketiga (Standar Skripsi Indonesia)" },
  });

  if (!languageStyle) {
    languageStyle = await prisma.languageStyleRuleset.create({
      data: {
        name: "Formal Baku & Orang Ketiga (Standar Skripsi Indonesia)",
        register: "formal_baku",
        selfReference: "third_person_penulis",
        hedgingRequired: true,
        bannedPhrases: ["saya", "aku", "menurut saya", "gue", "kayaknya", "kita tahu bahwa"],
        religiousOpeningAllowed: false,
      },
    });
    console.log("   ✓ LanguageStyleRuleset dibuat:", languageStyle.id);
  } else {
    console.log("   ✓ LanguageStyleRuleset sudah ada:", languageStyle.id);
  }

  // 2. AcademicRulesPolicy (§12.2)
  console.log("\n▶ [2/5] Inisialisasi AcademicRulesPolicy...");
  let academicPolicy = await prisma.academicRulesPolicy.findFirst({
    where: { name: "Standar Umum S1 Informatika (Telkom)" },
  });

  if (!academicPolicy) {
    academicPolicy = await prisma.academicRulesPolicy.create({
      data: {
        name: "Standar Umum S1 Informatika (Telkom)",
        minReferenceCount: 15,
        referenceRecencyYears: 5,
        mandatoryFrontMatter: [
          "Cover",
          "Lembar Pengesahan",
          "Pernyataan Orisinalitas",
          "Abstrak",
          "Daftar Isi",
          "Daftar Gambar",
          "Daftar Tabel",
        ],
        requiresDualCalendar: false,
      },
    });
    console.log("   ✓ AcademicRulesPolicy dibuat:", academicPolicy.id);
  } else {
    console.log("   ✓ AcademicRulesPolicy sudah ada:", academicPolicy.id);
  }

  // 3. Default ProposalTemplate (§2.0)
  console.log("\n▶ [3/5] Setup Default ProposalTemplate (Informatika Telkom)...");
  let template = await prisma.proposalTemplate.findFirst({
    where: { isDefault: true },
  });

  if (!template) {
    template = await prisma.proposalTemplate.create({
      data: {
        name: "Proposal Tugas Akhir — Informatika Standar Nasional (Telkom)",
        sourceCampus: "Telkom University",
        universityName: "Telkom University",
        prodiName: "Teknik Informatika",
        degreeLevel: "S1",
        numberingStyle: "decimal",
        defaultCitationStyle: "ieee",
        languageStyleId: languageStyle.id,
        academicRulesId: academicPolicy.id,
        isDefault: true,
      },
    });
    console.log("   ✓ Default ProposalTemplate dibuat:", template.id);
  } else {
    template = await prisma.proposalTemplate.update({
      where: { id: template.id },
      data: {
        universityName: template.universityName || "Telkom University",
        prodiName: template.prodiName || "Teknik Informatika",
        degreeLevel: template.degreeLevel || "S1",
        numberingStyle: template.numberingStyle || "decimal",
        defaultCitationStyle: template.defaultCitationStyle || "ieee",
        languageStyleId: languageStyle.id,
        academicRulesId: academicPolicy.id,
      },
    });
    console.log("   ✓ Default ProposalTemplate di-update:", template.id);
  }

  // 4. Section Type Registry (§2.1)
  console.log("\n▶ [4/5] Mendaftarkan Section Type Registry & Citation Policy per Template...");

  const CANONICAL_SECTIONS = [
    // BAB 1
    {
      sectionType: "latar_belakang",
      title: "Latar Belakang Masalah",
      citationPolicy: "required",
      contextDependencies: [],
      order: 1,
      purposeDescription:
        "Menguraikan masalah, urgensi riset, data fenomena empiris, dan research gap berdasarkan literatur terindeks.",
    },
    {
      sectionType: "identifikasi_masalah",
      title: "Identifikasi Masalah",
      citationPolicy: "optional",
      contextDependencies: ["latar_belakang"],
      order: 2,
      purposeDescription:
        "Menginventarisasi poin-poin permasalahan potensial dari sisi sistem, data, dan pengguna yang muncul dari latar belakang.",
    },
    {
      sectionType: "rumusan_masalah",
      title: "Rumusan Masalah",
      citationPolicy: "none",
      contextDependencies: ["identifikasi_masalah"],
      order: 3,
      purposeDescription:
        "Merumuskan pertanyaan penelitian eksplisit dalam kalimat tanya yang terukur dan selaras dengan tujuan penelitian.",
    },
    {
      sectionType: "tujuan_penelitian",
      title: "Tujuan Penelitian",
      citationPolicy: "none",
      contextDependencies: ["rumusan_masalah"],
      order: 4,
      purposeDescription:
        "Menetapkan capaian konkret penelitian yang menjawab setiap rumusan masalah secara 1:1 tanpa sitasi literatur.",
    },
    {
      sectionType: "batasan_masalah",
      title: "Batasan Masalah",
      citationPolicy: "none",
      contextDependencies: ["tujuan_penelitian"],
      order: 5,
      purposeDescription:
        "Membatasi ruang lingkup riset dari segi dataset, variabel, metode, dan lingkungan komputasi yang diuji.",
    },
    {
      sectionType: "manfaat_teoretis",
      title: "Manfaat Teoretis",
      citationPolicy: "optional",
      contextDependencies: ["latar_belakang"],
      order: 6,
      purposeDescription:
        "Menguraikan kontribusi keilmuan akademis terhadap bidang studi terkait topik penelitian.",
    },
    {
      sectionType: "manfaat_praktis",
      title: "Manfaat Praktis",
      citationPolicy: "none",
      contextDependencies: ["tujuan_penelitian"],
      order: 7,
      purposeDescription:
        "Menguraikan manfaat aplikatif hasil penelitian bagi instansi, praktisi, atau masyarakat pengguna.",
    },
    {
      sectionType: "sistematika_penulisan",
      title: "Sistematika Penulisan",
      citationPolicy: "none",
      contextDependencies: [],
      order: 8,
      purposeDescription:
        "Menjelaskan gambaran garis besar susunan isi tiap bab di dalam dokumen proposal skripsi.",
    },

    // BAB 2
    {
      sectionType: "landasan_teori",
      title: "Landasan Teori",
      citationPolicy: "required",
      contextDependencies: ["latar_belakang"],
      order: 9,
      purposeDescription:
        "Menguraikan teori dasar, konsep fundamental, dan formula/algoritma yang digunakan dengan rujukan pustaka primer.",
    },
    {
      sectionType: "penelitian_terdahulu",
      title: "Penelitian Terdahulu",
      citationPolicy: "required",
      contextDependencies: ["landasan_teori"],
      order: 10,
      purposeDescription:
        "Membandingkan studi-studi relevan terdahulu, memetakan kesamaan dan perbedaannya, serta menegaskan celah riset.",
    },
    {
      sectionType: "kerangka_berpikir",
      title: "Kerangka Berpikir",
      citationPolicy: "optional",
      contextDependencies: ["landasan_teori", "penelitian_terdahulu"],
      order: 11,
      purposeDescription:
        "Diagram alur dan narasi hubungan logis antar konsep/variabel dalam memecahkan masalah.",
    },
    {
      sectionType: "hipotesis_penelitian",
      title: "Hipotesis Penelitian",
      citationPolicy: "none",
      contextDependencies: ["kerangka_berpikir"],
      order: 12,
      purposeDescription:
        "Dugaan sementara hubungan antar variabel yang akan diuji secara empiris (khusus kuantitatif).",
    },

    // BAB 3
    {
      sectionType: "jenis_pendekatan_penelitian",
      title: "Jenis/Pendekatan Penelitian",
      citationPolicy: "optional",
      contextDependencies: ["tujuan_penelitian"],
      order: 13,
      purposeDescription:
        "Menjelaskan metode riset yang dipilih (kuantitatif/kualitatif) dan justifikasi metodologisnya.",
    },
    {
      sectionType: "objek_lokasi_penelitian",
      title: "Objek/Subjek dan Lokasi Penelitian",
      citationPolicy: "none",
      contextDependencies: ["batasan_masalah"],
      order: 14,
      purposeDescription:
        "Mendeskripsikan entitas sistem, data, atau institusi yang dijadikan objek studi.",
    },
    {
      sectionType: "populasi_sampel",
      title: "Populasi dan Sampel",
      citationPolicy: "optional",
      contextDependencies: ["objek_lokasi_penelitian"],
      order: 15,
      purposeDescription:
        "Menjelaskan karakteristik populasi, teknik penentuan ukuran sampel, dan kriteria inklusi/eksklusi.",
    },
    {
      sectionType: "teknik_pengumpulan_data",
      title: "Teknik Pengumpulan Data",
      citationPolicy: "optional",
      contextDependencies: ["populasi_sampel"],
      order: 16,
      purposeDescription:
        "Prosedur akuisisi data sekunder (API, dataset publik) atau primer (kuesioner, observasi).",
    },
    {
      sectionType: "instrumen_penelitian",
      title: "Instrumen Penelitian",
      citationPolicy: "optional",
      contextDependencies: ["teknik_pengumpulan_data"],
      order: 17,
      purposeDescription:
        "Alat ukur, kuesioner, atau software yang digunakan dalam proses pengumpulan data.",
    },
    {
      sectionType: "definisi_operasional_variabel",
      title: "Definisi Operasional Variabel",
      citationPolicy: "optional",
      contextDependencies: ["landasan_teori"],
      order: 18,
      purposeDescription:
        "Menjelaskan definisi kerja, indikator, skala pengukuran, dan parameter tiap variabel yang diuji.",
    },
    {
      sectionType: "teknik_analisis_data",
      title: "Teknik Analisis Data",
      citationPolicy: "optional",
      contextDependencies: ["jenis_pendekatan_penelitian"],
      order: 19,
      purposeDescription:
        "Langkah-langkah analitis, statistik deskriptif/inferensial, atau alur algoritma pemrosesan data.",
    },
    {
      sectionType: "uji_keabsahan_data",
      title: "Uji Validitas dan Reliabilitas",
      citationPolicy: "optional",
      contextDependencies: ["instrumen_penelitian"],
      order: 20,
      purposeDescription:
        "Metode pengujian ketepatan dan keandalan instrumen atau performa model.",
    },
  ];

  for (const s of CANONICAL_SECTIONS) {
    const existing = await prisma.proposalTemplateSection.findFirst({
      where: {
        templateId: template.id,
        sectionType: s.sectionType,
      },
    });

    if (existing) {
      await prisma.proposalTemplateSection.update({
        where: { id: existing.id },
        data: {
          title: s.title,
          purposeDescription: s.purposeDescription,
          citationPolicy: s.citationPolicy,
          contextDependencies: s.contextDependencies,
          order: s.order,
        },
      });
      console.log(`   ↻ Section '${s.sectionType}' diperbarui (Policy: ${s.citationPolicy})`);
    } else {
      await prisma.proposalTemplateSection.create({
        data: {
          templateId: template.id,
          sectionType: s.sectionType,
          title: s.title,
          purposeDescription: s.purposeDescription,
          citationPolicy: s.citationPolicy,
          contextDependencies: s.contextDependencies,
          order: s.order,
        },
      });
      console.log(`   + Section '${s.sectionType}' ditambahkan (Policy: ${s.citationPolicy})`);
    }
  }

  // 5. Cleanup node cacat '1.6.1 dIANR' pada project user (§0 Diagnosis C)
  console.log("\n▶ [5/5] Membersihkan sub-bab cacat '1.6.1 dIANR' pada database...");
  const deleteResult = await prisma.researchOutlineItem.deleteMany({
    where: {
      OR: [
        { itemId: "1.6.1" },
        { title: { contains: "dIANR" } },
      ],
    },
  });
  console.log(`   ✓ Dihapus ${deleteResult.count} record sub-bab cacat/halu.`);

  console.log("\n═════════════════════════════════════════════════════════════");
  console.log("✨ SEED FASE 1 SELESAI DENGAN SUKSES! ✨");
  console.log("═════════════════════════════════════════════════════════════\n");
}

main()
  .catch((e) => {
    console.error("❌ Gagal seed Fase 1:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
