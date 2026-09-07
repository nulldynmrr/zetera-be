/**
 * Spesifikasi Sub-bab: Populasi & Sampel / Informan
 * Slug: populasi-sampel
 * Code: SUBCHAPTER_3_3
 */
export const spec = {
  slug: "populasi-sampel",
  code: "SUBCHAPTER_3_3",
  defaultTitle: "Populasi & Sampel / Informan",
  cluster: "BAB_3",
  category: "SUBCHAPTER",
  aliases: [
    "populasi dan sampel",
    "populasi sampel",
    "subjek dan informan",
    "teknik sampling",
    "ukuran sampel",
    "subchapter_3_3",
    "3.3",
  ],
  variables: ["TOPIC", "PRODI"],

  outline: {
    systemPrompt: `Anda adalah Metodolog Skripsi Ahli. Rancang penetapan populasi target, rumus penentuan ukuran sampel (Slovin / Krejcie-Morgan untuk Kuantitatif) atau kriteria informan kunci (Purposive Sampling untuk Kualitatif) untuk topik "{{TOPIC}}" Program Studi {{PRODI}}.`,
    recipeSteps: [
      "Kuantitatif: Definisikan populasi, teknik sampling, justifikasi ukuran sampel (rumus Slovin/Krejcie).",
      "Kualitatif: Kriteria informan/subjek dan teknik penentuannya (purposive/snowball).",
    ],
    defaultBullets: [
      { step: "Karakteristik dan jumlah populasi target penelitian", querySuffix: "populasi target karakteristik" },
      { step: "Teknik sampling dan perhitungan rumus ukuran sampel yang representatif", querySuffix: "rumus slovin teknik sampling sampel" },
    ],
  },

  paper: {
    rules: {
      citationMode: "REQUIRED", // Rujuk rumus Slovin/Krejcie
      introSentenceRequired: true,
      alignmentRule: "Sampel harus mewakili populasi target secara representatif",
      formatStyle: "PARAGRAPH",
      badgeText: "Rumus Sampling • Slovin / Purposive",
      badgeColor: "#D97706",
    },
    jsonSchema: {
      type: "object",
      properties: {
        introSentence: { type: "string" },
        population: { type: "string" },
        sampleFormula: { type: "string" },
        sampleSize: { type: "number" },
        combinedDraft: { type: "string" },
      },
    },
    previewExample: {
      introSentence: "Populasi dan penetapan jumlah sampel dalam penelitian ini ditentukan berdasarkan kriteria metodologis berikut:",
      points: [
        "1. Populasi: Sebanyak 450 dokumen skripsi mahasiswa program studi Informatika.",
        "2. Rumus: Menggunakan rumus Slovin dengan batas toleransi kesalahan (error margin) 5%.",
        "3. Sampel: Diperoleh ukuran sampel minimum sebanyak 212 dokumen melalui Stratified Random Sampling.",
      ],
      renderedDraft: `Populasi dalam penelitian ini adalah seluruh berkas naskah skripsi mahasiswa tingkat akhir yang terdaftar pada sistem repositori kampus sejumlah 450 dokumen. Penentuan ukuran sampel dilakukan menggunakan rumus Slovin dengan tingkat presisi e = 0,05 [9]:\n\nn = N / (1 + N(e)^2) = 450 / (1 + 450(0,05)^2) = 211,76 ≈ 212 dokumen.\n\nDengan demikian, jumlah sampel yang diteliti adalah 212 dokumen yang dipilih menggunakan teknik stratified random sampling berdasarkan tahun kelulusan.`,
    },
  },
};
