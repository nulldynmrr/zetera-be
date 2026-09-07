/**
 * Spesifikasi Sub-bab: Instrumen Penelitian & Kisi-Kisi
 * Slug: instrumen-penelitian
 * Code: SUBCHAPTER_3_5
 */
export const spec = {
  slug: "instrumen-penelitian",
  code: "SUBCHAPTER_3_5",
  defaultTitle: "Instrumen Penelitian & Kisi-Kisi",
  cluster: "BAB_3",
  category: "SUBCHAPTER",
  aliases: [
    "instrumen penelitian",
    "kisi-kisi instrumen",
    "alat ukur penelitian",
    "pedoman instrumen",
    "alat dan bahan",
    "subchapter_3_5",
    "3.5",
  ],
  variables: ["TOPIC", "PRODI"],

  outline: {
    systemPrompt: `Anda adalah Metodolog Skripsi Ahli. Dokumentasikan alat ukur, pedoman pengumpulan data, software pendukung, dan tabel kisi-kisi instrumen (variabel, indikator, butir ukur) untuk topik "{{TOPIC}}" Program Studi {{PRODI}}.`,
    recipeSteps: [
      "Jelaskan alat/instrumen yang dipakai (kuesioner, pedoman wawancara, tools/software).",
      "Sertakan tabel kisi-kisi instrumen (variabel, indikator, butir ukur).",
    ],
    defaultBullets: [
      { step: "Dokumentasi spesifikasi hardware, software, atau pedoman instrumen", querySuffix: "instrumen alat bahan software hardware" },
      { step: "Tabel kisi-kisi penyusunan instrumen (variabel ke butir ukur)", querySuffix: "tabel kisi-kisi instrumen indikator" },
    ],
  },

  paper: {
    rules: {
      citationMode: "OPTIONAL",
      introSentenceRequired: true,
      alignmentRule: "Setiap variabel harus memiliki indikator ukur empiris yang terpetakan jelas",
      formatStyle: "TABLE",
      badgeText: "Tabel Kisi-Kisi • Butir Ukur",
      badgeColor: "#D97706",
    },
    jsonSchema: {
      type: "object",
      properties: {
        introSentence: { type: "string" },
        instrumentGrid: {
          type: "array",
          items: {
            type: "object",
            properties: {
              variable: { type: "string" },
              indicators: { type: "array", items: { type: "string" } },
              itemNumbers: { type: "string" },
            },
          },
        },
        combinedDraft: { type: "string" },
      },
    },
    previewExample: {
      introSentence: "Instrumen penelitian yang digunakan terdiri dari perangkat keras, perangkat lunak pengujian, dan instrumen kuesioner terstruktur dengan kisi-kisi sebagai berikut:",
      points: [
        "1. Perangkat Keras & Lunak: Node.js v20, MySQL 8.0, Groq SDK Llama-3.3-70b.",
        "2. Kisi-Kisi Instrumen: Pemetaan Variabel Efisiensi, Akurasi Konteks, dan Usability ke 15 butir kuesioner skala Likert 1-5.",
      ],
      renderedDraft: `Instrumen yang digunakan dalam penelitian ini mencakup perangkat lunak komputasi dan instrumen kuesioner terstruktur:\n\nTabel 3.1 Kisi-Kisi Instrumen Penelitian\n| Variabel | Indikator | No. Butir |\n| Kegunaan (Usefulness) | Membantu penyusunan latar belakang piramida terbalik | 1, 2, 3 |\n| Kemudahan (Ease of Use) | Kemudahan memahami navigasi antarmuka per sub-bab | 4, 5, 6 |\n| Kepuasan (Satisfaction) | Keselarasan rumusan masalah dan tujuan penelitian | 7, 8, 9 |`,
    },
  },
};
