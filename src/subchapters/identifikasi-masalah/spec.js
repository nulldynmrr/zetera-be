/**
 * Spesifikasi Sub-bab: Identifikasi Masalah
 * Slug: identifikasi-masalah
 * Code: SUBCHAPTER_1_2
 */
export const spec = {
  slug: "identifikasi-masalah",
  code: "SUBCHAPTER_1_2",
  defaultTitle: "Identifikasi Masalah",
  cluster: "BAB_1",
  category: "SUBCHAPTER",
  aliases: [
    "identifikasi masalah",
    "identifikasi permasalahan",
    "pemetaan masalah",
    "inventarisasi masalah",
    "subchapter_1_2",
    "1.2",
  ],
  variables: ["TOPIC", "PRODI", "BACKGROUND_CONTEXT"],

  outline: {
    systemPrompt: `Anda adalah Metodolog Skripsi Ahli. Petakan seluruh masalah potensial yang muncul dari isu Latar Belakang topik "{{TOPIC}}" Program Studi {{PRODI}}.
Pisahkan masalah secara terstruktur dari 3 dimensi: (1) Sisi objek penelitian/pengguna, (2) Sisi metode/algoritma, dan (3) Karakteristik data/sistem.
Wajib diawali 1 kalimat pengantar akademis mendalam sebelum daftar butir masalah bernomor.`,
    recipeSteps: [
      "Daftar masalah yang muncul dari isu di Latar Belakang (poin bernomor).",
      "Pisahkan masalah dari sisi objek penelitian, metode yang digunakan, dan karakteristik data.",
      "Pastikan tiap poin masalah bisa dipetakan ke minimal satu Rumusan Masalah.",
    ],
    defaultBullets: [
      { step: "Kendala operasional dan kebutuhan riil pada objek penelitian/pengguna", querySuffix: "masalah objek lapangan" },
      { step: "Keterbatasan metode konvensional atau algoritma eksisting yang digunakan", querySuffix: "keterbatasan metode algoritma" },
      { step: "Tantangan dalam pengumpulan, validitas, atau integritas data penelitian", querySuffix: "karakteristik anomali data" },
    ],
  },

  paper: {
    rules: {
      citationMode: "NONE", // BAB 1 SELAIN 1.1 WAJIB TANPA SITASI!
      introSentenceRequired: true,
      alignmentRule: "Setiap butir masalah harus dapat direspons oleh rumusan masalah",
      formatStyle: "NUMBERED_LIST",
      badgeText: "Tanpa Sitasi • Wajib Pengantar",
      badgeColor: "#059669",
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
      introSentence: "Berdasarkan uraian latar belakang yang telah dipaparkan, maka permasalahan yang dapat diidentifikasi dalam penelitian ini adalah sebagai berikut:",
      points: [
        "1. Keterbatasan waktu respon sistem saat menangani lonjakan data transaksi secara simultan.",
        "2. Rendahnya akurasi klasifikasi algoritma eksisting akibat tingginya tingkat ketidakseimbangan kelas pada dataset.",
        "3. Belum tersedianya mekanisme pemantauan anomali terotomasi pada alur kerja operasional pengguna.",
      ],
      renderedDraft: `Berdasarkan uraian latar belakang yang telah dipaparkan, maka permasalahan yang dapat diidentifikasi dalam penelitian ini adalah sebagai berikut:\n1. Keterbatasan waktu respon sistem saat menangani lonjakan data transaksi secara simultan.\n2. Rendahnya akurasi klasifikasi algoritma eksisting akibat tingginya tingkat ketidakseimbangan kelas pada dataset.\n3. Belum tersedianya mekanisme pemantauan anomali terotomasi pada alur kerja operasional pengguna.`,
    },
  },
};
