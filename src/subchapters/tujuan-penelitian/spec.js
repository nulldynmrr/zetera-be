/**
 * Spesifikasi Sub-bab: Tujuan Penelitian
 * Slug: tujuan-penelitian
 * Code: SUBCHAPTER_1_5
 */
export const spec = {
  slug: "tujuan-penelitian",
  code: "SUBCHAPTER_1_5",
  defaultTitle: "Tujuan Penelitian",
  cluster: "BAB_1",
  category: "SUBCHAPTER",
  aliases: [
    "tujuan penelitian",
    "capaian penelitian",
    "tujuan riset",
    "research objectives",
    "subchapter_1_5",
    "1.5",
  ],
  variables: ["TOPIC", "PRODI", "BACKGROUND_CONTEXT"],

  outline: {
    systemPrompt: `Anda adalah Metodolog Skripsi Ahli. Formulasikan pernyataan deklaratif hasil akhir dan capaian konkret penelitian topik "{{TOPIC}}" Program Studi {{PRODI}}.
Wajib selaras 1:1 dengan Rumusan Masalah (1.3).
Gunakan kata kerja operasional terukur ("Untuk merancang...", "Untuk menguji...", "Untuk menganalisis...").
Wajib diawali 1 kalimat pengantar akademis mendalam dan DILARANG MENGGUNAKAN SITASI PUSTAKA.`,
    recipeSteps: [
      "Tulis satu tujuan untuk tiap Rumusan Masalah dalam kalimat pernyataan deklaratif (\"Untuk mengetahui...\", \"Untuk menganalisis...\", \"Untuk merancang...\").",
      "Pastikan tujuan bersifat terukur (measurable) dan konsisten dengan Batasan Masalah.",
    ],
    defaultBullets: [
      { step: "Tujuan perancangan atau implementasi solusi/sistem", querySuffix: "tujuan perancangan implementasi" },
      { step: "Tujuan pengujian performa, akurasi, dan perbandingan", querySuffix: "tujuan evaluasi pengujian performa" },
      { step: "Tujuan analisis kepuasan atau efektivitas bagi pengguna", querySuffix: "tujuan analisis efektivitas" },
    ],
  },

  paper: {
    rules: {
      citationMode: "NONE", // TANPA SITASI
      introSentenceRequired: true,
      alignmentRule: "Wajib selaras 1:1 dengan Rumusan Masalah (1.3)",
      formatStyle: "NUMBERED_LIST",
      badgeText: "Tanpa Sitasi • Selaras 1:1 Rumusan",
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
      introSentence: "Mengacu pada rumusan masalah yang telah ditetapkan, maka tujuan yang ingin dicapai dalam penelitian ini adalah sebagai berikut:",
      points: [
        "1. Merancang dan mengimplementasikan arsitektur dynamic context memory untuk menghubungkan pemahaman antar-subbab secara terstruktur.",
        "2. Menguji dan mengevaluasi kinerja akurasi relevansi serta latensi inferensi dari model yang dikembangkan.",
        "3. Menganalisis tingkat kepuasan dan efektivitas alur kerja pengguna dalam menyusun proposal tugas akhir.",
      ],
      renderedDraft: `Mengacu pada rumusan masalah yang telah ditetapkan, maka tujuan yang ingin dicapai dalam penelitian ini adalah sebagai berikut:\n1. Merancang dan mengimplementasikan arsitektur dynamic context memory untuk menghubungkan pemahaman antar-subbab secara terstruktur.\n2. Menguji dan mengevaluasi kinerja akurasi relevansi serta latensi inferensi dari model yang dikembangkan.\n3. Menganalisis tingkat kepuasan dan efektivitas alur kerja pengguna dalam menyusun proposal tugas akhir.`,
    },
  },
};
