/**
 * Spesifikasi Sub-bab: Kerangka Berpikir
 * Slug: kerangka-berpikir
 * Code: SUBCHAPTER_2_3
 */
export const spec = {
  slug: "kerangka-berpikir",
  code: "SUBCHAPTER_2_3",
  defaultTitle: "Kerangka Berpikir",
  cluster: "BAB_2",
  category: "SUBCHAPTER",
  aliases: [
    "kerangka berpikir",
    "kerangka konseptual",
    "alur pikir penelitian",
    "conceptual framework",
    "subchapter_2_3",
    "2.3",
  ],
  variables: ["TOPIC", "PRODI"],

  outline: {
    systemPrompt: `Anda adalah Metodolog Skripsi Ahli. Rancang visualisasi dan narasi logis alur input → proses → output untuk topik "{{TOPIC}}" Program Studi {{PRODI}}.
Hubungkan alur pikir secara sistematis dari isu latar belakang, teori di 2.1, gap di 2.2, hingga solusi metode yang diusulkan.`,
    recipeSteps: [
      "Gambarkan alur input → proses/metode → output yang diharapkan (diagram kerangka berpikir).",
      "Hubungkan tiap elemen kerangka berpikir ke teori di 2.1 dan gap di 2.2.",
    ],
    defaultBullets: [
      { step: "Tahap Input: Masalah, variabel penelitian, dan data mentah", querySuffix: "kerangka berpikir tahap input" },
      { step: "Tahap Proses: Metode, algoritma, tahapan pengolahan data", querySuffix: "kerangka berpikir proses metode" },
      { step: "Tahap Output: Luaran sistem, rekomendasi, atau model teruji", querySuffix: "kerangka berpikir output luaran" },
    ],
  },

  paper: {
    rules: {
      citationMode: "OPTIONAL",
      introSentenceRequired: true,
      alignmentRule: "Menjadi jembatan logis dari masalah teoretis ke prosedur teknis Bab 3",
      formatStyle: "PARAGRAPH",
      badgeText: "Diagram Alur Logis • Input-Proses-Output",
      badgeColor: "#059669",
    },
    jsonSchema: {
      type: "object",
      properties: {
        introSentence: { type: "string" },
        inputPhase: { type: "string" },
        processPhase: { type: "string" },
        outputPhase: { type: "string" },
        combinedDraft: { type: "string" },
      },
    },
    previewExample: {
      introSentence: "Kerangka berpikir dalam penelitian ini menggambarkan alur penyelesaian masalah secara terstruktur dari tahap identifikasi hingga pencapaian luaran akhir:",
      points: [
        "1. Input: Tingginya diskoneksi konteks antar-subbab pada penyusunan skripsi mahasiswa.",
        "2. Proses: Penerapan stateful memory embedding dan dynamic prompt injection berbasis taksonomi akademis.",
        "3. Output: Draf proposal skripsi yang utuh, kohesif, dan terverifikasi bebas sitasi pada bagian non-empiris.",
      ],
      renderedDraft: `Kerangka berpikir dalam penelitian ini disusun untuk menguraikan alur penalaran logis dari fenomena permasalahan menuju solusi akhir:\n\n1. Tahap Masukan (Input): Fenomena inkonsistensi narasi antar-subbab tugas akhir akibat model AI yang memproses instruksi secara terisolasi tanpa memory sharing.\n\n2. Tahap Pemrosesan (Process): Perancangan database-driven skill taxonomy dengan modul memori terstruktur yang mengaitkan identifikasi masalah, rumusan masalah, dan tujuan secara 1:1.\n\n3. Tahap Luaran (Output): Terwujudnya sistem asisten cerdas yang mampu menyintesis proposal penelitian secara adaptif dengan tingkat keselarasan logis yang tinggi.`,
    },
  },
};
