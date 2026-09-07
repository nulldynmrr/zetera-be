/**
 * Spesifikasi Sub-bab: Landasan Teori
 * Slug: landasan-teori
 * Code: SUBCHAPTER_2_1
 */
export const spec = {
  slug: "landasan-teori",
  code: "SUBCHAPTER_2_1",
  defaultTitle: "Landasan Teori",
  cluster: "BAB_2",
  category: "SUBCHAPTER",
  aliases: [
    "landasan teori",
    "kajian teori",
    "teori pendukung",
    "tinjauan pustaka",
    "subchapter_2_1",
    "2.1",
  ],
  variables: ["TOPIC", "PRODI"],

  outline: {
    systemPrompt: `Anda adalah Metodolog Skripsi Ahli. Rancang kajian konsep fundamental, sintesis definisi kerja, dimensi indikator, dan cara kerja teknis metode untuk topik "{{TOPIC}}" Program Studi {{PRODI}}.
Wajib mengomparasikan minimal 2 rujukan buku teks / jurnal bereputasi per konsep utama dan menyimpulkan definisi kerja operasional yang dipakai penelitian ini.`,
    recipeSteps: [
      "Definisi konsep dari minimal 2 sumber (buku/jurnal), bandingkan, lalu simpulkan definisi kerja yang dipakai penelitian ini.",
      "Karakteristik/dimensi/indikator dari konsep tersebut.",
      "Jika topik memakai metode/algoritma spesifik → jelaskan cara kerjanya secara konseptual, rujuk sumber aslinya.",
    ],
    defaultBullets: [
      { step: "Kajian konsep dasar dan sintesis definisi kerja dari para ahli", querySuffix: "definisi teori konsep fundamental" },
      { step: "Dimensi, indikator, dan prinsip operasional variabel penelitian", querySuffix: "dimensi indikator teori" },
      { step: "Kajian teoritis dan cara kerja teknis algoritma/metode yang digunakan", querySuffix: "cara kerja algoritma arsitektur metode" },
    ],
  },

  paper: {
    rules: {
      citationMode: "REQUIRED",
      introSentenceRequired: true,
      alignmentRule: "Mendasari setiap variabel dan metode yang akan diukur pada Bab 3",
      formatStyle: "PARAGRAPH",
      badgeText: "Wajib Sitasi Pustaka • Multi-Sumber",
      badgeColor: "#059669",
    },
    jsonSchema: {
      type: "object",
      properties: {
        introSentence: { type: "string" },
        sections: { type: "array", items: { type: "string" } },
        combinedDraft: { type: "string" },
      },
    },
    previewExample: {
      introSentence: "Landasan teori dalam penelitian ini mencakup pemaparan konsep-konsep fundamental yang menjadi pijakan teoretis pemecahan masalah:",
      points: [
        "1. Konsep Large Language Model (LLM) dan Attention Mechanism [5].",
        "2. Teori Dynamic Context Window dan Stateful Memory Architecture [6].",
        "3. Kerangka Evaluasi RAG (Retrieval-Augmented Generation) [7].",
      ],
      renderedDraft: `Kecerdasan Buatan Generatif berbasis Transformer memanfaatkan mekanisme multi-head self-attention untuk memproses dependensi konteks teks panjang [5]. Vaswani et al. (2017) menyatakan bahwa representasi vektor mampu menangkap relasi semantik secara efektif, namun tetap dibatasi oleh panjang jendela konteks maksimum.\n\nDalam konteks penelitian ini, definisi operasional Large Language Model mengacu pada arsitektur pretrained transformer yang dipadukan dengan modul memori terstruktur untuk mempertahankan histori keputusan ilmiah antar-subbab [6].`,
    },
  },
};
