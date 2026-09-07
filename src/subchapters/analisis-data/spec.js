/**
 * Spesifikasi Sub-bab: Teknik Analisis Data
 * Slug: analisis-data
 * Code: SUBCHAPTER_3_7
 */
export const spec = {
  slug: "analisis-data",
  code: "SUBCHAPTER_3_7",
  defaultTitle: "Teknik Analisis Data",
  cluster: "BAB_3",
  category: "SUBCHAPTER",
  aliases: [
    "teknik analisis data",
    "analisis data",
    "metode analisis",
    "uji statistik",
    "tahapan analisis data",
    "subchapter_3_7",
    "3.7",
  ],
  variables: ["TOPIC", "PRODI"],

  outline: {
    systemPrompt: `Anda adalah Metodolog Skripsi Ahli. Rancang tahapan pemrosesan data mentah, uji statistik, atau reduksi & penyajian temuan untuk topik "{{TOPIC}}" Program Studi {{PRODI}}.
Bagi tahapan analisis secara berurutan: (1) Data preprocessing/cleaning, (2) Pengolahan metode inti, dan (3) Evaluasi metrik performa / pengujian hipotesis.`,
    recipeSteps: [
      "Jelaskan tahapan analisis berurutan (preprocessing → metode inti → evaluasi).",
      "Kuantitatif: Uji statistik yang dipakai & alasannya.",
      "Kualitatif: Teknik analisis (Miles & Huberman: reduksi, penyajian, verifikasi data).",
    ],
    defaultBullets: [
      { step: "Tahapan preprocessing data mentah (normalisasi, tokenisasi, filtering)", querySuffix: "tahapan preprocessing data mentah" },
      { step: "Metode inti komputasi, algoritma, atau pengujian statistik", querySuffix: "metode inti analisis statistik komputasi" },
      { step: "Kriteria evaluasi performa (Akurasi, F1-Score, Paired T-Test)", querySuffix: "metrik evaluasi akurasi uji hipotesis" },
    ],
  },

  paper: {
    rules: {
      citationMode: "REQUIRED",
      introSentenceRequired: true,
      alignmentRule: "Prosedur analisis harus secara langsung menjawab Rumusan Masalah",
      formatStyle: "PARAGRAPH",
      badgeText: "Tahapan Berurutan • Uji Statistik",
      badgeColor: "#D97706",
    },
    jsonSchema: {
      type: "object",
      properties: {
        introSentence: { type: "string" },
        preprocessingStep: { type: "string" },
        coreAnalysisStep: { type: "string" },
        evaluationStep: { type: "string" },
        combinedDraft: { type: "string" },
      },
    },
    previewExample: {
      introSentence: "Teknik analisis data dalam penelitian ini dilakukan melalui tiga tahapan terstruktur sebagai berikut:",
      points: [
        "1. Pra-pemrosesan Data: Pembersihan teks, parsing struktur bab, dan tokenisasi metadata.",
        "2. Pemodelan Inti: Eksekusi dynamic context routing dengan integrasi basis data MySQL.",
        "3. Uji Statistik & Evaluasi: Uji Wilcoxon Signed-Rank Test untuk membandingkan skor relevansi sebelum dan sesudah intervensi sistem.",
      ],
      renderedDraft: `Teknik analisis data dalam penelitian ini dilakukan melalui tiga tahapan berurutan:\n\n1. Pra-pemrosesan Data (Data Preprocessing): Berkas naskah proposal diekstraksi ke format teks terstruktur, kemudian dilakukan penghilangan karakter noise dan normalisasi tata letak sub-bab.\n\n2. Pemrosesan Inti (Core Modeling): Modul AI Router mengeksekusi sintesis draf dengan parameter suhu rendah (0,25) dan menginjeksikan memori terstruktur dari sub-bab sebelumnya.\n\n3. Evaluasi Metrik dan Uji Hipotesis: Dilakukan perbandingan skor konsistensi menggunakan Paired Sample t-Test pada taraf signifikansi α = 0,05 guna membuktikan apakah peningkatan kinerja terjadi secara signifikan.`,
    },
  },
};
