/**
 * Spesifikasi Sub-bab: Batasan Masalah
 * Slug: batasan-masalah
 * Code: SUBCHAPTER_1_4
 */
export const spec = {
  slug: "batasan-masalah",
  code: "SUBCHAPTER_1_4",
  defaultTitle: "Batasan Masalah",
  cluster: "BAB_1",
  category: "SUBCHAPTER",
  aliases: [
    "batasan masalah",
    "ruang lingkup",
    "scope penelitian",
    "batasan penelitian",
    "ruang lingkup penelitian",
    "subchapter_1_4",
    "1.4",
  ],
  variables: ["TOPIC", "PRODI", "BACKGROUND_CONTEXT"],

  outline: {
    systemPrompt: `Anda adalah Metodolog Skripsi Ahli. Batasi ruang lingkup topik "{{TOPIC}}" Program Studi {{PRODI}} agar penelitian terarah, fokus, mendalam, dan feasible.
Batasi ruang lingkup dari 3 aspek: (1) Data/dataset & rentang waktu, (2) Variabel/fitur yang diteliti, dan (3) Batasan teknis/framework/metode yang digunakan.
Wajib diawali 1 kalimat pengantar akademis mendalam dan DILARANG MENGGUNAKAN SITASI PUSTAKA.`,
    recipeSteps: [
      "Batasi dari sisi data (rentang waktu observasi, jumlah sampel/dataset, sumber data).",
      "Batasi dari sisi variabel atau dimensi yang diteliti (fokus utama riset).",
      "Batasi dari sisi metode, algoritma, framework, atau tools perangkat lunak yang dipakai.",
    ],
    defaultBullets: [
      { step: "Batasan ruang lingkup data observasi, sumber dataset, dan periode waktu", querySuffix: "batasan data sampel periode" },
      { step: "Batasan variabel terikat, variabel bebas, atau parameter yang dianalisis", querySuffix: "batasan variabel fokus penelitian" },
      { step: "Batasan platform, lingkungan komputasi, framework bahasa pemrograman", querySuffix: "batasan teknis implementasi tools" },
    ],
  },

  paper: {
    rules: {
      citationMode: "NONE", // TANPA SITASI
      introSentenceRequired: true,
      alignmentRule: "Menjaga batas kelayakan riset agar tidak melebar di luar metodologi Bab 3",
      formatStyle: "NUMBERED_LIST",
      badgeText: "Tanpa Sitasi • Scope Terukur",
      badgeColor: "#4F46E5",
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
      introSentence: "Agar pembahasan dalam penelitian ini terarah dan tidak menyimpang dari tujuan yang ditetapkan, maka batasan masalah ditentukan sebagai berikut:",
      points: [
        "1. Data yang digunakan merupakan data dokumen teks skripsi mahasiswa tahun akademik 2021–2024.",
        "2. Variabel pengujian berfokus pada akurasi penarikan konteks antar-subbab dan kecepatan latensi inferensi.",
        "3. Implementasi sistem dibangun menggunakan bahasa pemrograman TypeScript dengan runtime Node.js dan basis data MySQL.",
      ],
      renderedDraft: `Agar pembahasan dalam penelitian ini terarah dan tidak menyimpang dari tujuan yang ditetapkan, maka batasan masalah ditentukan sebagai berikut:\n1. Data yang digunakan merupakan data dokumen teks skripsi mahasiswa tahun akademik 2021–2024.\n2. Variabel pengujian berfokus pada akurasi penarikan konteks antar-subbab dan kecepatan latensi inferensi.\n3. Implementasi sistem dibangun menggunakan bahasa pemrograman TypeScript dengan runtime Node.js dan basis data MySQL.`,
    },
  },
};
