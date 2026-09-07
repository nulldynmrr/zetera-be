/**
 * Spesifikasi Sub-bab: Rumusan Masalah
 * Slug: rumusan-masalah
 * Code: SUBCHAPTER_1_3
 */
export const spec = {
  slug: "rumusan-masalah",
  code: "SUBCHAPTER_1_3",
  defaultTitle: "Rumusan Masalah",
  cluster: "BAB_1",
  category: "SUBCHAPTER",
  aliases: [
    "rumusan masalah",
    "pertanyaan penelitian",
    "rumusan permasalahan",
    "research questions",
    "subchapter_1_3",
    "1.3",
  ],
  variables: ["TOPIC", "PRODI", "BACKGROUND_CONTEXT"],

  outline: {
    systemPrompt: `Anda adalah Metodolog Skripsi Ahli. Rumuskan pertanyaan penelitian operasional untuk topik "{{TOPIC}}" Program Studi {{PRODI}}.
Wajib selaras 1:1 dengan Tujuan Penelitian (1.5) dan dapat dijawab oleh tahapan metodologi Bab 3.
Gunakan kalimat tanya ilmiah ("Bagaimana...", "Sejauh mana...", "Apakah...").
Wajib diawali 1 kalimat pengantar akademis mendalam dan DILARANG MENGGUNAKAN SITASI PUSTAKA.`,
    recipeSteps: [
      "Tulis dalam kalimat tanya yang jelas (\"Bagaimana...\", \"Apakah...\", \"Sejauh mana...\").",
      "Pastikan jumlah rumusan masalah selaras 1:1 dengan Tujuan Penelitian.",
      "Pastikan tiap rumusan masalah dapat dijawab secara empiris dengan metode di BAB III.",
    ],
    defaultBullets: [
      { step: "Perumusan mekanisme/desain sistem atau penerapan metode", querySuffix: "rumusan masalah perancangan mekanisme" },
      { step: "Pengukuran tingkat kinerja, akurasi, atau efisiensi model", querySuffix: "rumusan masalah evaluasi kinerja" },
      { step: "Analisis dampak, pengaruh, atau perbandingan hasil terhadap baseline", querySuffix: "rumusan masalah perbandingan dampak" },
    ],
  },

  paper: {
    rules: {
      citationMode: "NONE", // TANPA SITASI
      introSentenceRequired: true,
      alignmentRule: "Wajib selaras 1:1 dengan butir Tujuan Penelitian (1.5)",
      formatStyle: "NUMBERED_LIST",
      badgeText: "Tanpa Sitasi • Selaras 1:1 Tujuan",
      badgeColor: "#D97706",
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
      introSentence: "Berdasarkan batasan dan identifikasi masalah yang telah diuraikan, rumusan masalah dalam penelitian ini dirumuskan sebagai berikut:",
      points: [
        "1. Bagaimana merancang arsitektur dynamic context memory untuk meningkatkan pemahaman konteks pada dokumen tugas akhir?",
        "2. Bagaimana kinerja akurasi dan latensi inferensi dari metode yang diusulkan dibandingkan dengan model dasar (baseline)?",
        "3. Sejauh mana kepuasan dan efektivitas penggunaan antarmuka sistem oleh pengguna akhir?",
      ],
      renderedDraft: `Berdasarkan batasan dan identifikasi masalah yang telah diuraikan, rumusan masalah dalam penelitian ini dirumuskan sebagai berikut:\n1. Bagaimana merancang arsitektur dynamic context memory untuk meningkatkan pemahaman konteks pada dokumen tugas akhir?\n2. Bagaimana kinerja akurasi dan latensi inferensi dari metode yang diusulkan dibandingkan dengan model dasar (baseline)?\n3. Sejauh mana kepuasan dan efektivitas penggunaan antarmuka sistem oleh pengguna akhir?`,
    },
  },
};
