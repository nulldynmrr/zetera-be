/**
 * Spesifikasi Sub-bab: Sistematika Penulisan (Roadmap Dokumen)
 * Slug: sistematika-penulisan
 * Code: SUBCHAPTER_1_7
 */
export const spec = {
  slug: "sistematika-penulisan",
  code: "SUBCHAPTER_1_7",
  defaultTitle: "Sistematika Penulisan (Roadmap Dokumen)",
  cluster: "BAB_1",
  category: "SUBCHAPTER",
  aliases: [
    "sistematika penulisan",
    "sistematika skripsi",
    "roadmap dokumen",
    "struktur penulisan",
    "subchapter_1_7",
    "1.7",
  ],
  variables: ["TOPIC", "PRODI", "DATABASE_TOC"],

  outline: {
    systemPrompt: `Anda adalah Metodolog Skripsi Ahli. Susun narasi roadmap struktur bab per bab untuk topik "{{TOPIC}}" Program Studi {{PRODI}}.
Baca dan sinkronkan dengan seluruh daftar BAB yang terdaftar di database proyek.
Tuliskan narasi ringkas kohesif per bab yang merangkum fokus utama dan keterkaitan logis antar bab.
MUTLAK TANPA SITASI PUSTAKA: Jangan pernah mencantumkan sitasi kurung siku [1], [2] atau rujukan literatur apapun karena sub-bab ini murni peta jalan alur dokumen skripsi.`,
    recipeSteps: [
      "Baca seluruh daftar BAB dan sub-bab yang terdaftar di Daftar Isi Database proyek.",
      "Tuliskan narasi ringkas per bab yang merangkum fokus utama dan keterkaitan logis antar bab.",
      "Pastikan tidak ada sitasi kurung siku [1], [2] atau klaim pustaka (murni alur dokumen skripsi).",
    ],
    defaultBullets: [
      { step: "BAB I PENDAHULUAN: Latar belakang masalah, rumusan, batasan, tujuan, dan manfaat penelitian.", querySuffix: "sistematika bab 1 pendahuluan" },
      { step: "BAB II TINJAUAN PUSTAKA: Kajian teori pendukung, sintesis penelitian terdahulu, dan kerangka berpikir.", querySuffix: "sistematika bab 2 tinjauan pustaka" },
      { step: "BAB III METODOLOGI PENELITIAN: Desain riset, subjek/objek, prosedur pengumpulan data, dan teknik analisis.", querySuffix: "sistematika bab 3 metodologi penelitian" },
    ],
  },

  paper: {
    rules: {
      citationMode: "NONE", // MUTLAK TANPA SITASI!
      introSentenceRequired: true,
      alignmentRule: "Wajib sinkron 1:1 dengan struktur Daftar Isi resmi di database proyek",
      formatStyle: "ROADMAP",
      badgeText: "Sinkron DB Daftar Isi • Tanpa Sitasi",
      badgeColor: "#10B981",
    },
    jsonSchema: {
      type: "object",
      properties: {
        introSentence: { type: "string" },
        pointAnswers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              index: { type: "number" },
              text: { type: "string" },
            },
          },
        },
        combinedDraft: { type: "string" },
      },
    },
    previewExample: {
      // ⚠️ HANYA CONTOH ILUSTRATIF — output nyata mengikuti Daftar Isi database proyek user
      introSentence: "Sistematika penulisan skripsi ini disusun ke dalam beberapa bab sebagai berikut:",
      points: [
        "BAB I PENDAHULUAN: Berisikan latar belakang masalah, rumusan masalah, batasan masalah, tujuan dan manfaat penelitian, dan sistematika penulisan.",
        "BAB II LANDASAN TEORI: Membahas teori yang diperlukan dalam penelitian, penelitian terdahulu yang relevan, serta kerangka berpikir.",
        "BAB III METODOLOGI PENELITIAN: Menjelaskan metode, objek penelitian, teknik pengumpulan data, instrumen, dan teknik analisis.",
        "BAB IV HASIL DAN PEMBAHASAN: Memaparkan hasil analisis data, pengujian model, serta pembahasan temuan secara empiris.",
        "BAB V KESIMPULAN DAN SARAN: Merangkum kesimpulan dan memberikan saran serta arahan pengembangan.",
      ],
      // Tiap BAB = paragraf tersendiri dengan heading bold (sesuai konvensi skripsi Indonesia)
      renderedDraft:
        "Sistematika penulisan skripsi ini disusun ke dalam beberapa bab sebagai berikut:\n\n" +
        "BAB I  PENDAHULUAN\n" +
        "Bab ini berisikan latar belakang masalah, rumusan masalah, batasan masalah, tujuan dan manfaat penelitian, metode penelitian, dan sistematika penulisan.\n\n" +
        "BAB II  LANDASAN TEORI\n" +
        "Bab ini membahas secara singkat teori yang diperlukan dalam penelitian, penelitian terdahulu yang relevan, serta kerangka berpikir yang menjadi dasar konseptual.\n\n" +
        "BAB III  METODOLOGI PENELITIAN\n" +
        "Pada bab ini dijelaskan metode yang digunakan, meliputi jenis penelitian, objek penelitian, teknik pengumpulan data, instrumen penelitian, dan teknik analisis data.\n\n" +
        "BAB IV  HASIL DAN PEMBAHASAN\n" +
        "Bab ini memaparkan hasil analisis data, pengujian hipotesis atau model, serta pembahasan temuan penelitian secara empiris.\n\n" +
        "BAB V  KESIMPULAN DAN SARAN\n" +
        "Bab ini merangkum kesimpulan dari seluruh hasil penelitian dan memberikan saran serta arahan pengembangan selanjutnya.",
      formatNote: "Tiap BAB = heading kapital + deskripsi paragraf di bawahnya. Jumlah bab fleksibel sesuai Daftar Isi user.",
    },
  },
};
