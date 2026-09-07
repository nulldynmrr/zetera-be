/**
 * Spesifikasi Sub-bab: Jenis / Pendekatan Penelitian
 * Slug: pendekatan-penelitian
 * Code: SUBCHAPTER_3_1
 */
export const spec = {
  slug: "pendekatan-penelitian",
  code: "SUBCHAPTER_3_1",
  defaultTitle: "Jenis / Pendekatan Penelitian",
  cluster: "BAB_3",
  category: "SUBCHAPTER",
  aliases: [
    "jenis penelitian",
    "pendekatan penelitian",
    "metode penelitian",
    "desain penelitian",
    "subchapter_3_1",
    "3.1",
  ],
  variables: ["TOPIC", "PRODI", "APPROACH"],

  outline: {
    systemPrompt: `Anda adalah Metodolog Skripsi Ahli. Nyatakan paradigma metodologis (Kuantitatif / Kualitatif / R&D / Eksperimen) dan rujukan buku metodologi standar (Sugiyono, Creswell) untuk topik "{{TOPIC}}" Program Studi {{PRODI}}.
Jelaskan alasan fundamental pemilihan pendekatan tersebut dikaitkan langsung dengan pemenuhan Rumusan Masalah.`,
    recipeSteps: [
      "Nyatakan pendekatan (kuantitatif/kualitatif) dan alasan pemilihan, dikaitkan ke Rumusan Masalah.",
      "Rujuk definisi pendekatan dari sumber metodologi (mis. Sugiyono, Creswell).",
    ],
    defaultBullets: [
      { step: "Deklarasi jenis dan pendekatan penelitian (Kuantitatif/Kualitatif/R&D)", querySuffix: "jenis pendekatan penelitian metodologi" },
      { step: "Rujukan buku teks metodologi resmi (Sugiyono / Creswell)", querySuffix: "rujukan buku metodologi penelitian" },
      { step: "Justifikasi kesesuaian paradigma dengan rumusan masalah", querySuffix: "justifikasi kesesuaian pendekatan masalah" },
    ],
  },

  paper: {
    rules: {
      citationMode: "REQUIRED", // Rujuk buku metodologi
      introSentenceRequired: true,
      alignmentRule: "Menjadi landasan operasional bagi teknik sampling dan instrumen",
      formatStyle: "PARAGRAPH",
      badgeText: "Rujuk Buku Metodologi • Sugiyono/Creswell",
      badgeColor: "#D97706",
    },
    jsonSchema: {
      type: "object",
      properties: {
        introSentence: { type: "string" },
        methodologyType: { type: "string" },
        methodologyReference: { type: "string" },
        justification: { type: "string" },
        combinedDraft: { type: "string" },
      },
    },
    previewExample: {
      introSentence: "Penelitian ini menggunakan pendekatan ilmiah terstruktur guna menjawab rumusan masalah yang telah ditetapkan:",
      points: [
        "1. Pendekatan: Metode Kuantitatif dengan desain Eksperimen Semu (Quasi-Experiment).",
        "2. Rujukan: Sugiyono (2019) dan Creswell (2018) mengenai pengukuran empiris terukur.",
        "3. Justifikasi: Pendekatan ini dipilih karena penelitian mengukur performa teknis sistem secara numerik.",
      ],
      renderedDraft: `Penelitian ini menggunakan pendekatan kuantitatif dengan desain eksperimen terapan (applied research). Menurut Sugiyono (2019), metode kuantitatif digunakan untuk meneliti pada populasi atau sampel tertentu dengan instrumen pengujian terstandar guna menguji hipotesis yang telah dirumuskan [8].\n\nPendekatan ini dipandang paling tepat karena rumusan masalah dalam penelitian ini berorientasi pada pengukuran performa objektif berupa tingkat akurasi inferensi konteks dan efisiensi waktu komputasi.`,
    },
  },
};
