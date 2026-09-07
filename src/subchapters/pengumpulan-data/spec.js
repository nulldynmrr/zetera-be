/**
 * Spesifikasi Sub-bab: Teknik Pengumpulan Data
 * Slug: pengumpulan-data
 * Code: SUBCHAPTER_3_4
 */
export const spec = {
  slug: "pengumpulan-data",
  code: "SUBCHAPTER_3_4",
  defaultTitle: "Teknik Pengumpulan Data",
  cluster: "BAB_3",
  category: "SUBCHAPTER",
  aliases: [
    "teknik pengumpulan data",
    "pengumpulan data",
    "metode pengumpulan data",
    "prosedur pengumpulan data",
    "sumber data",
    "subchapter_3_4",
    "3.4",
  ],
  variables: ["TOPIC", "PRODI"],

  outline: {
    systemPrompt: `Anda adalah Metodolog Skripsi Ahli. Rancang prosedur pengumpulan data primer dan sekunder (kuesioner, observasi langsung, scraping API, studi dokumentasi) untuk topik "{{TOPIC}}" Program Studi {{PRODI}}.`,
    recipeSteps: [
      "Jelaskan sumber data (primer/sekunder).",
      "Jelaskan metode pengumpulan (kuesioner/wawancara/scraping/API) beserta prosedurnya.",
    ],
    defaultBullets: [
      { step: "Identifikasi sumber data primer dan sekunder yang digunakan", querySuffix: "sumber data primer sekunder" },
      { step: "Tahapan operasional dan protokol pelaksanaan pengumpulan data", querySuffix: "prosedur teknik pengumpulan data" },
    ],
  },

  paper: {
    rules: {
      citationMode: "OPTIONAL",
      introSentenceRequired: true,
      alignmentRule: "Memastikan data yang dikumpulkan valid dan dapat diuji reliabilitasnya",
      formatStyle: "NUMBERED_LIST",
      badgeText: "Primer & Sekunder • Prosedural",
      badgeColor: "#D97706",
    },
    jsonSchema: {
      type: "object",
      properties: {
        introSentence: { type: "string" },
        dataSources: { type: "array", items: { type: "string" } },
        collectionProcedure: { type: "string" },
        combinedDraft: { type: "string" },
      },
    },
    previewExample: {
      introSentence: "Teknik pengumpulan data yang diterapkan dalam penelitian ini dirancang secara sistematis melalui dua pendekatan sumber data:",
      points: [
        "1. Data Primer: Diperoleh melalui observasi langsung pencatatan log latensi inferensi dan penyebaran kuesioner skala Likert kepada 50 responden pengguna sistem.",
        "2. Data Sekunder: Diperoleh dari arsip repositori digital naskah tugas akhir serta referensi jurnal internasional bereputasi.",
      ],
      renderedDraft: `Teknik pengumpulan data yang diterapkan dalam penelitian ini dirancang secara sistematis melalui dua pendekatan sumber data:\n\n1. Data Primer: Diperoleh melalui pencatatan log telemetri performa sistem (response time, token count) saat model memproses instruksi, serta penyebaran kuesioner evaluasi kegunaan sistem berbasis USE Questionnaire kepada pengguna.\n\n2. Data Sekunder: Diperoleh dari dokumen naskah tugas akhir yang telah lulus uji sidang pada repositori perpustakaan universitas serta pedoman tata tulis ilmiah resmi.`,
    },
  },
};
