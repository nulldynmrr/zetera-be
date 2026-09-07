/**
 * Spesifikasi Sub-bab: Manfaat Penelitian
 * Slug: manfaat-penelitian
 * Code: SUBCHAPTER_1_6
 */
export const spec = {
  slug: "manfaat-penelitian",
  code: "SUBCHAPTER_1_6",
  defaultTitle: "Manfaat Penelitian",
  cluster: "BAB_1",
  category: "SUBCHAPTER",
  aliases: [
    "manfaat penelitian",
    "kegunaan penelitian",
    "signifikansi penelitian",
    "kontribusi riset",
    "subchapter_1_6",
    "1.6",
  ],
  variables: ["TOPIC", "PRODI", "BACKGROUND_CONTEXT"],

  outline: {
    systemPrompt: `Anda adalah Metodolog Skripsi Ahli. Uraikan kontribusi keilmuan (teoretis) dan kegunaan nyata bagi objek/stakeholder (praktis) dari topik "{{TOPIC}}" Program Studi {{PRODI}}.
Bagi ke dalam 2 butir utama: (1) Manfaat Teoretis / Akademis, dan (2) Manfaat Praktis / Aplikatif.
Wajib diawali 1 kalimat pengantar akademis mendalam dan DILARANG MENGGUNAKAN SITASI PUSTAKA.`,
    recipeSteps: [
      "Manfaat teoretis: kontribusi terhadap khazanah keilmuan di bidang studi terkait.",
      "Manfaat praktis: kegunaan konkret bagi objek penelitian, pengguna, organisasi, atau peneliti selanjutnya.",
    ],
    defaultBullets: [
      { step: "Kontribusi terhadap perkembangan keilmuan dan literatur akademik", querySuffix: "manfaat teoretis akademis" },
      { step: "Kegunaan praktis bagi stakeholder, institusi, dan praktisi lapangan", querySuffix: "manfaat praktis industri" },
    ],
  },

  paper: {
    rules: {
      citationMode: "NONE", // TANPA SITASI
      introSentenceRequired: true,
      alignmentRule: "Memperjelas nilai guna riset bagi ranah keilmuan dan praktisi",
      formatStyle: "NUMBERED_LIST",
      badgeText: "Tanpa Sitasi • Teoretis & Praktis",
      badgeColor: "#0284C7",
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
      introSentence: "Hasil dari penelitian ini diharapkan dapat memberikan kontribusi yang nyata baik secara teoretis maupun praktis sebagai berikut:",
      points: [
        "1. Manfaat Teoretis: Memperkaya khazanah keilmuan di bidang Rekayasa Perangkat Lunak dan Kecerdasan Buatan, khususnya mengenai pemodelan memori kontekstual pada sistem penulisan ilmiah terotomasi.",
        "2. Manfaat Praktis: Menjadi pedoman teknis dan solusi perangkat lunak bagi perguruan tinggi dalam membantu mahasiswa menyusun proposal penelitian yang selaras dengan kaidah metodologis.",
      ],
      renderedDraft: `Hasil dari penelitian ini diharapkan dapat memberikan kontribusi yang nyata baik secara teoretis maupun praktis sebagai berikut:\n1. Manfaat Teoretis: Memperkaya khazanah keilmuan di bidang Rekayasa Perangkat Lunak dan Kecerdasan Buatan, khususnya mengenai pemodelan memori kontekstual pada sistem penulisan ilmiah terotomasi.\n2. Manfaat Praktis: Menjadi pedoman teknis dan solusi perangkat lunak bagi perguruan tinggi dalam membantu mahasiswa menyusun proposal penelitian yang selaras dengan kaidah metodologis.`,
    },
  },
};
