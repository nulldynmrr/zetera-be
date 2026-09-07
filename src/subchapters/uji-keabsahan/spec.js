/**
 * Spesifikasi Sub-bab: Uji Validitas & Reliabilitas / Keabsahan Data
 * Slug: uji-keabsahan
 * Code: SUBCHAPTER_3_8
 */
export const spec = {
  slug: "uji-keabsahan",
  code: "SUBCHAPTER_3_8",
  defaultTitle: "Uji Validitas & Reliabilitas / Keabsahan Data",
  cluster: "BAB_3",
  category: "SUBCHAPTER",
  aliases: [
    "uji validitas dan reliabilitas",
    "keabsahan data",
    "validitas instrumen",
    "reliabilitas instrumen",
    "triangulasi data",
    "subchapter_3_8",
    "3.8",
  ],
  variables: ["TOPIC", "PRODI"],

  outline: {
    systemPrompt: `Anda adalah Metodolog Skripsi Ahli. Rancang prosedur pengujian validitas butir, reliabilitas Cronbach Alpha (> 0.70), atau triangulasi data kualitatif untuk topik "{{TOPIC}}" Program Studi {{PRODI}}.`,
    recipeSteps: [
      "Kuantitatif: Uji instrumen (validitas Pearson/CFA, reliabilitas Cronbach Alpha > 0.70).",
      "Kualitatif: Teknik triangulasi (sumber, metode, waktu) dan member checking untuk menjamin keabsahan data.",
    ],
    defaultBullets: [
      { step: "Prosedur pengujian validitas butir (Korelasi Bivariate Pearson / r-tabel)", querySuffix: "uji validitas pearson instrumen" },
      { step: "Prosedur pengujian reliabilitas instrumen (Cronbach Alpha > 0.70)", querySuffix: "uji reliabilitas cronbach alpha kriteria" },
    ],
  },

  paper: {
    rules: {
      citationMode: "REQUIRED",
      introSentenceRequired: true,
      alignmentRule: "Menjamin instrumen ukur benar-benar mengukur apa yang seharusnya diukur",
      formatStyle: "PARAGRAPH",
      badgeText: "Validitas Pearson • Cronbach Alpha > 0.70",
      badgeColor: "#D97706",
    },
    jsonSchema: {
      type: "object",
      properties: {
        introSentence: { type: "string" },
        validityTest: { type: "string" },
        reliabilityTest: { type: "string" },
        combinedDraft: { type: "string" },
      },
    },
    previewExample: {
      introSentence: "Untuk memastikan bahwa data yang dihimpun memiliki derajat ketepatan dan konsistensi yang tinggi, instrumen penelitian diuji melalui dua tahapan pengujian:",
      points: [
        "1. Uji Validitas: Menggunakan korelasi Product Moment Pearson dengan kriteria r-hitung > r-tabel pada signifikansi 5%.",
        "2. Uji Reliabilitas: Menggunakan koefisien Cronbach's Alpha dengan ambang batas keandalan minimum 0,70.",
      ],
      renderedDraft: `Guna menjamin keabsahan instrumen ukur, dilakukan pengujian validitas dan reliabilitas data:\n\n1. Uji Validitas: Dilakukan dengan membandingkan nilai r-hitung (korelasi Pearson) tiap butir pernyataan dengan nilai r-tabel pada taraf signifikansi 5%. Butir instrumen dinyatakan valid apabila nilai r-hitung > r-tabel.\n\n2. Uji Reliabilitas: Dilakukan terhadap butir-butir yang telah valid dengan mengukur nilai koefisien Cronbach's Alpha. Menurut Nunnally (1994), suatu instrumen dikategorikan reliabel dan layak digunakan dalam penelitian apabila memiliki nilai koefisien Cronbach's Alpha ≥ 0,70.`,
    },
  },
};
