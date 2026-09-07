/**
 * Spesifikasi Sub-bab: Objek / Subjek dan Lokasi Penelitian
 * Slug: objek-lokasi
 * Code: SUBCHAPTER_3_2
 */
export const spec = {
  slug: "objek-lokasi",
  code: "SUBCHAPTER_3_2",
  defaultTitle: "Objek / Subjek dan Lokasi Penelitian",
  cluster: "BAB_3",
  category: "SUBCHAPTER",
  aliases: [
    "objek penelitian",
    "subjek penelitian",
    "lokasi penelitian",
    "tempat dan waktu penelitian",
    "objek dan lokasi",
    "subchapter_3_2",
    "3.2",
  ],
  variables: ["TOPIC", "PRODI"],

  outline: {
    systemPrompt: `Anda adalah Metodolog Skripsi Ahli. Rinci profil objek penelitian (platform, software, institusi, dataset) dan batasan spasial/temporal untuk topik "{{TOPIC}}" Program Studi {{PRODI}}.`,
    recipeSteps: [
      "Jelaskan objek penelitian (platform/perusahaan/dataset) dan alasan pemilihannya.",
      "Jelaskan lokasi/waktu penelitian bila relevan.",
    ],
    defaultBullets: [
      { step: "Identitas objek penelitian, sistem, atau dataset yang diteliti", querySuffix: "karakteristik objek dataset penelitian" },
      { step: "Lokasi geografis, institusi, atau lingkungan komputasi penelitian", querySuffix: "lokasi waktu observasi penelitian" },
    ],
  },

  paper: {
    rules: {
      citationMode: "OPTIONAL",
      introSentenceRequired: true,
      alignmentRule: "Memberikan kepastian batasan empiris di mana observasi dilakukan",
      formatStyle: "PARAGRAPH",
      badgeText: "Profil Objek • Ruang & Waktu",
      badgeColor: "#D97706",
    },
    jsonSchema: {
      type: "object",
      properties: {
        introSentence: { type: "string" },
        objectProfile: { type: "string" },
        locationTime: { type: "string" },
        combinedDraft: { type: "string" },
      },
    },
    previewExample: {
      introSentence: "Objek dan ruang lingkup tempat pelaksanaan penelitian ini diuraikan sebagai berikut:",
      points: [
        "1. Objek Penelitian: Korpus naskah skripsi mahasiswa dan modul inferensi AI Router.",
        "2. Waktu & Lingkungan: Periode semester ganjil 2024/2025 pada lingkungan server laboratorium komputasi.",
      ],
      renderedDraft: `Objek dalam penelitian ini adalah dokumen proposal skripsi dan modul memori pada platform asisten penulisan ilmiah Zetera. Penelitian ini berfokus pada interaksi data antara input formulir mahasiswa dengan struktur bab resmi.\n\nPengambilan data dan pengujian eksperimental dilakukan pada lingkungan cloud server privat yang dikonfigurasi pada rentang bulan Oktober hingga Desember 2024.`,
    },
  },
};
