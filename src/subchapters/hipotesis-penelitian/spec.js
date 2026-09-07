/**
 * Spesifikasi Sub-bab: Hipotesis Penelitian
 * Slug: hipotesis-penelitian
 * Code: SUBCHAPTER_2_4
 */
export const spec = {
  slug: "hipotesis-penelitian",
  code: "SUBCHAPTER_2_4",
  defaultTitle: "Hipotesis Penelitian [Kuantitatif]",
  cluster: "BAB_2",
  category: "SUBCHAPTER",
  aliases: [
    "hipotesis penelitian",
    "hipotesis riset",
    "dugaan sementara",
    "research hypothesis",
    "subchapter_2_4",
    "2.4",
  ],
  variables: ["TOPIC", "PRODI"],

  outline: {
    systemPrompt: `Anda adalah Metodolog Skripsi Ahli. Rumuskan dugaan sementara H0 (hipotesis nol) dan H1 (hipotesis alternatif/terarah) untuk topik kuantitatif "{{TOPIC}}" Program Studi {{PRODI}}.
Wajib konsisten dan terikat langsung dengan Rumusan Masalah serta Kerangka Berpikir.`,
    recipeSteps: [
      "Tulis H0/H1 untuk tiap hubungan variabel yang diuji.",
      "Harus konsisten dengan Rumusan Masalah & Kerangka Berpikir.",
    ],
    defaultBullets: [
      { step: "Perumusan H0 (tidak terdapat pengaruh/perbedaan signifikan)", querySuffix: "hipotesis nol h0" },
      { step: "Perumusan H1 (terdapat pengaruh positif/peningkatan performa signifikan)", querySuffix: "hipotesis alternatif h1" },
    ],
  },

  paper: {
    rules: {
      citationMode: "OPTIONAL",
      introSentenceRequired: true,
      alignmentRule: "Wajib diuji secara inferensial pada teknik analisis Bab 3 dan hasil Bab 4",
      formatStyle: "NUMBERED_LIST",
      badgeText: "Kuantitatif • Format H0/H1",
      badgeColor: "#059669",
    },
    jsonSchema: {
      type: "object",
      properties: {
        introSentence: { type: "string" },
        hypotheses: {
          type: "array",
          items: {
            type: "object",
            properties: {
              code: { type: "string" },
              statement: { type: "string" },
            },
          },
        },
        combinedDraft: { type: "string" },
      },
    },
    previewExample: {
      introSentence: "Berdasarkan kerangka pemikiran dan rumusan masalah yang diajukan, hipotesis dalam penelitian ini dirumuskan sebagai berikut:",
      points: [
        "H0: Tidak terdapat perbedaan performa akurasi yang signifikan antara arsitektur baseline dengan model dynamic context memory.",
        "H1: Terdapat peningkatan akurasi relevansi dan reduksi halusinasi yang signifikan pada model dengan dynamic context memory dibandingkan arsitektur baseline.",
      ],
      renderedDraft: `Berdasarkan kerangka pemikiran dan rumusan masalah yang diajukan, hipotesis dalam penelitian ini dirumuskan sebagai berikut:\n\nH0: Tidak terdapat perbedaan performa akurasi yang signifikan antara arsitektur baseline dengan model dynamic context memory.\n\nH1: Terdapat peningkatan akurasi relevansi dan reduksi halusinasi yang signifikan pada model dengan dynamic context memory dibandingkan arsitektur baseline.`,
    },
  },
};
