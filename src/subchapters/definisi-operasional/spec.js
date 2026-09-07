/**
 * Spesifikasi Sub-bab: Definisi Operasional Variabel
 * Slug: definisi-operasional
 * Code: SUBCHAPTER_3_6
 */
export const spec = {
  slug: "definisi-operasional",
  code: "SUBCHAPTER_3_6",
  defaultTitle: "Definisi Operasional Variabel [Kuantitatif]",
  cluster: "BAB_3",
  category: "SUBCHAPTER",
  aliases: [
    "definisi operasional",
    "definisi operasional variabel",
    "operasionalisasi variabel",
    "variabel penelitian",
    "subchapter_3_6",
    "3.6",
  ],
  variables: ["TOPIC", "PRODI"],

  outline: {
    systemPrompt: `Anda adalah Metodolog Skripsi Ahli. Petakan konsep teoretis ke indikator empiris terukur, parameter teknis, dan skala pengukurannya (Likert / Interval / Rasio / Milidetik) untuk topik kuantitatif "{{TOPIC}}" Program Studi {{PRODI}}.`,
    recipeSteps: [
      "Untuk tiap variabel: definisi operasional, indikator, skala pengukuran (Likert/Nominal/Interval/Rasio).",
    ],
    defaultBullets: [
      { step: "Tabel definisi operasional variabel, indikator ukur, dan skala pengukuran", querySuffix: "definisi operasional variabel skala pengukuran" },
    ],
  },

  paper: {
    rules: {
      citationMode: "OPTIONAL",
      introSentenceRequired: true,
      alignmentRule: "Mengubah konsep abstrak menjadi besaran angka/metrik yang dapat dihitung",
      formatStyle: "TABLE",
      badgeText: "Tabel Operasional • Skala Metrik",
      badgeColor: "#D97706",
    },
    jsonSchema: {
      type: "object",
      properties: {
        introSentence: { type: "string" },
        operationalTable: {
          type: "array",
          items: {
            type: "object",
            properties: {
              variable: { type: "string" },
              conceptualDefinition: { type: "string" },
              operationalIndicator: { type: "string" },
              measurementScale: { type: "string" },
            },
          },
        },
        combinedDraft: { type: "string" },
      },
    },
    previewExample: {
      introSentence: "Definisi operasional variabel dalam penelitian ini dijabarkan pada tabel berikut untuk menghindari ambiguitas pemaknaan istilah:",
      points: [
        "1. Variabel Bebas (X): Dynamic Context Router dengan indikator embedding similarity score (skala rasio 0.0 - 1.0).",
        "2. Variabel Terikat (Y): Kohesi Dokumen Skripsi dengan indikator skor evaluasi kelayakan akademis (skala Likert 1 - 5).",
      ],
      renderedDraft: `Definisi operasional variabel dalam penelitian ini dijabarkan pada tabel berikut guna memperjelas batasan pengukuran empiris:\n\nTabel 3.2 Definisi Operasional Variabel Penelitian\n| Variabel | Definisi Operasional | Indikator Pengukuran | Skala |\n| Latensi Inferensi (X1) | Durasi waktu yang dibutuhkan model sejak instruksi dikirim hingga token pertama diterima | Waktu dalam satuan milidetik (ms) | Rasio |\n| Akurasi Konteks (Y1) | Derajat ketepatan hubungan logika antar-subbab tanpa pengulangan informasi | Skor penilaian rubrik validator ahli (1-100) | Interval |`,
    },
  },
};
