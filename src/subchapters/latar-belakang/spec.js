/**
 * Spesifikasi Sub-bab: Latar Belakang (Piramida Terbalik)
 * Slug: latar-belakang
 * Code: SUBCHAPTER_1_1
 */
export const spec = {
  slug: "latar-belakang",
  code: "SUBCHAPTER_1_1",
  defaultTitle: "Latar Belakang (Piramida Terbalik)",
  cluster: "BAB_1",
  category: "SUBCHAPTER",
  aliases: [
    "latar belakang",
    "latar belakar",
    "latar belakang masalah",
    "konteks penelitian",
    "fenomena masalah",
    "background",
    "subchapter_1_1",
    "1.1",
  ],
  variables: ["TOPIC", "PRODI", "BACKGROUND_CONTEXT"],

  // 1. SKILL & RESEP OUTLINE BLUEPRINT
  outline: {
    systemPrompt: `Anda adalah Metodolog Skripsi Ahli. Rancang alur piramida terbalik 8 langkah sistematis untuk sub-bab Latar Belakang topik "{{TOPIC}}" Program Studi {{PRODI}}.
Pastikan transisi logis dari fenomena makro nasional/global, urgensi empiris, tinjauan literatur awal, hingga penegasan research gap dan jembatan ke rumusan masalah.`,
    recipeSteps: [
      "Definisikan konsep/variabel utama topik dari sumber akademik/resmi.",
      "Jelaskan fenomena/kondisi terkini terkait topik (data, tren, urgensi).",
      "Jelaskan dampak/pentingnya isu ini bila tidak diteliti/ditangani.",
      "Jelaskan konteks objek penelitian (platform, lokasi, populasi yang relevan dengan topik).",
      "Jelaskan metode/pendekatan yang dipakai dan alasan relevansinya untuk topik ini.",
      "Ulas singkat 2–4 penelitian terdahulu sejenis beserta temuannya.",
      "Identifikasi research gap dari penelitian terdahulu tersebut.",
      "Tutup dengan kalimat pengarah ke fokus penelitian (jembatan ke rumusan masalah).",
    ],
    defaultBullets: [
      { step: "Definisi konsep dan variabel utama penelitian", querySuffix: "definisi konsep fundamental" },
      { step: "Fenomena empiris, data statistik, dan urgensi di lapangan", querySuffix: "fenomena tren data statistik urgensi" },
      { step: "Dampak dan konsekuensi permasalahan jika tidak diselesaikan", querySuffix: "dampak tantangan implikasi" },
      { step: "Karakteristik objek penelitian dan batasan konteks", querySuffix: "konteks platform objek studi" },
      { step: "Justifikasi pemilihan metode dan algoritma yang diusulkan", querySuffix: "metode pendekatan justifikasi" },
      { step: "Sintesis perbandingan 2-4 penelitian terdahulu", querySuffix: "empirical research prior studies" },
      { step: "Research gap dan posisi kebaruan (novelty)", querySuffix: "research gap novelty" },
      { step: "Kalimat jembatan penghubung ke rumusan masalah", querySuffix: "fokus penelitian arah riset" },
    ],
  },

  // 2. ATURAN & PREVIEW OUTPUT DI PAPER / SKRIPSI
  paper: {
    rules: {
      citationMode: "REQUIRED", // Latar belakang wajib sitasi artikel empiris
      introSentenceRequired: true,
      alignmentRule: "Menjadi landasan pembuktian empiris lahirnya Rumusan Masalah",
      formatStyle: "PARAGRAPH", // Paragraf mengalir piramida terbalik
      badgeText: "Wajib Sitasi Empiris",
      badgeColor: "#2563EB",
    },
    jsonSchema: {
      type: "object",
      properties: {
        introSentence: { type: "string" },
        paragraphs: {
          type: "array",
          items: { type: "string" },
        },
        citedJournals: {
          type: "array",
          items: { type: "string" },
        },
        combinedDraft: { type: "string" },
      },
    },
    previewExample: {
      introSentence: "Perkembangan transformasi digital saat ini telah mengubah lanskap operasional secara masif.",
      points: [
        "Paragraf 1-2: Landasan konseptual dan fenomena empiris makro [1].",
        "Paragraf 3-4: Tantangan teknis di lapangan dan dampak kegagalan sistem [2].",
        "Paragraf 5-6: Komparasi studi terdahulu serta pembuktian research gap [3], [4].",
        "Paragraf 7-8: Justifikasi metode terpilih dan sintesis perumusan tujuan penelitian.",
      ],
      renderedDraft: `Perkembangan teknologi kecerdasan buatan telah mengubah lanskap pengolahan data modern secara masif. Kendati demikian, berbagai organisasi masih menghadapi kendala latensi dan akurasi model dalam lingkungan produksi skala besar [1].\n\nPenelitian terdahulu yang dilakukan Pratama et al. (2023) menunjukkan bahwa optimasi komputasi awan mampu mereduksi latensi hingga 18%, namun belum mengintegrasikan adaptive memory routing [2]. Berdasarkan kesenjangan penelitian (research gap) tersebut, penelitian ini mengusulkan pendekatan hybrid dynamic context router untuk menjawab keterbatasan efisiensi yang ada.`,
    },
  },
};
