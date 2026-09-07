/**
 * Spesifikasi Sub-bab: Penelitian Terdahulu
 * Slug: penelitian-terdahulu
 * Code: SUBCHAPTER_2_2
 */
export const spec = {
  slug: "penelitian-terdahulu",
  code: "SUBCHAPTER_2_2",
  defaultTitle: "Penelitian Terdahulu (Matriks Komparasi)",
  cluster: "BAB_2",
  category: "SUBCHAPTER",
  aliases: [
    "penelitian terdahulu",
    "studi terdahulu",
    "kajian terdahulu",
    "matriks penelitian terdahulu",
    "state of the art",
    "literature review",
    "subchapter_2_2",
    "2.2",
  ],
  variables: ["TOPIC", "PRODI"],

  outline: {
    systemPrompt: `Anda adalah Metodolog Skripsi Ahli. Susun tabel komparasi dan narasi sintesis kritis penelitian terdahulu untuk topik "{{TOPIC}}" Program Studi {{PRODI}}.
Bandingkan 3-5 studi empiris mutakhir (5 tahun terakhir): peneliti, tahun, metode, temuan, persamaan, dan perbedaan.
Tegaskan research gap dan novelty (kebaruan) penelitian ini secara eksplisit.`,
    recipeSteps: [
      "Tabel/daftar penelitian terdahulu: peneliti, tahun, topik, metode, hasil.",
      "Analisis persamaan & perbedaan dengan penelitian ini.",
      "Simpulkan gap/kontribusi baru penelitian ini secara eksplisit.",
    ],
    defaultBullets: [
      { step: "Tabel perbandingan 3-5 paper empiris sejenis 5 tahun terakhir", querySuffix: "empirical study prior research" },
      { step: "Analisis sintesis persamaan dan perbedaan sudut pandang metodologi", querySuffix: "perbandingan metode penelitian terdahulu" },
      { step: "Penegasan kesenjangan penelitian (research gap) dan posisi novelty", querySuffix: "research gap novelty kebaruan penelitian" },
    ],
  },

  paper: {
    rules: {
      citationMode: "REQUIRED",
      introSentenceRequired: true,
      alignmentRule: "Membuktikan kebaruan (novelty) dan mencegah duplikasi penelitian",
      formatStyle: "TABLE",
      badgeText: "Wajib Matriks Tabel • Novelty Gap",
      badgeColor: "#059669",
    },
    jsonSchema: {
      type: "object",
      properties: {
        introSentence: { type: "string" },
        tableData: {
          type: "array",
          items: {
            type: "object",
            properties: {
              no: { type: "number" },
              authorYear: { type: "string" },
              title: { type: "string" },
              method: { type: "string" },
              results: { type: "string" },
              differences: { type: "string" },
            },
          },
        },
        synthesisNarrative: { type: "string" },
      },
    },
    previewExample: {
      introSentence: "Kajian terhadap penelitian-penelitian terdahulu yang relevan disajikan dalam bentuk matriks komparasi berikut guna mempertegas posisi kebaruan penelitian:",
      points: [
        "1. Susun tabel komparasi: Peneliti (Tahun), Judul, Metode, Hasil Utama, dan Persamaan/Perbedaan.",
        "2. Narasi sintesis kritis yang menjelaskan kelemahan/keterbatasan studi terdahulu.",
        "3. Deklarasi kebaruan: 'Perbedaan mendasar penelitian ini dengan penelitian sebelumnya terletak pada integrasi...'",
      ],
      renderedDraft: `Kajian terhadap penelitian terdahulu yang relevan disajikan dalam bentuk matriks komparasi guna mempertegas posisi kebaruan penelitian:\n\nTabel 2.1 Matriks Komparasi Penelitian Terdahulu\n| No | Peneliti & Tahun | Metode | Hasil Utama | Perbedaan dengan Penelitian Ini |\n| 1 | Wibowo et al. (2022) | TF-IDF + Cosine | Relevansi dokumen 74% | Menggunakan representasi sparse statis, belum kontekstual |\n| 2 | Hidayat (2023) | Fine-tuned BERT | Akurasi F1 82% | Belum memiliki memori terstruktur antar-bab |\n\nBerdasarkan matriks di atas, kebaruan penelitian ini terletak pada penerapan arsitektur memori berlapis yang menghubungkan keputusan pada Bab 1 langsung ke pembentukan instrumen Bab 3.`,
    },
  },
};
