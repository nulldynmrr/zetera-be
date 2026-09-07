/**
 * Spesifikasi Modul: Kelengkapan Dokumen & Preliminaries
 * Slugs: cover, persetujuan, abstrak, daftar-pustaka, lampiran
 */

export const coverSpec = {
  slug: "cover",
  code: "SECTION_COVER",
  defaultTitle: "Sampul Depan (Cover Skripsi)",
  cluster: "DOCS",
  category: "SUBCHAPTER",
  aliases: ["cover", "sampul depan", "halaman judul", "judul skripsi", "section_cover"],
  variables: ["TOPIC", "PRODI", "NAMA_MAHASISWA", "NIM", "KAMPUS", "TAHUN"],
  outline: {
    systemPrompt: `Format halaman judul dan sampul depan resmi skripsi sesuai kaidah penulisan institusi pendidikan tinggi Indonesia.`,
    recipeSteps: [
      "Cantumkan Judul Penelitian dalam huruf kapital tebal (ALL CAPS), piramida terbalik, proporsional.",
      "Cantumkan tujuan pengajuan dokumen (Tugas Akhir / Skripsi Sarjana).",
      "Cantumkan identitas lengkap mahasiswa: Nama, NIM, Program Studi, Fakultas, Universitas, dan Tahun Akademik.",
    ],
  },
  paper: {
    rules: {
      citationMode: "NONE",
      introSentenceRequired: false,
      alignmentRule: "Sesuai format resmi halaman sampul depan Dikti/Kampus",
      formatStyle: "PARAGRAPH",
      badgeText: "Halaman Sampul • Resmi",
      badgeColor: "#7E22CE",
    },
    previewExample: {
      introSentence: "",
      points: [
        "JUDUL SKRIPSI (HURUF KAPITAL, BOLD, MAKSIMAL 3 BARIS)",
        "PROPOSAL TUGAS AKHIR / SKRIPSI",
        "Disusun oleh: [Nama Mahasiswa] - NIM: [NIM]",
        "PROGRAM STUDI INFORMATIKA - FAKULTAS ILMU KOMPUTER",
        "UNIVERSITAS ZETERA - 2024",
      ],
      renderedDraft: `OPTIMASI KINERJA KECERDASAN BUATAN GENERATIF DENGAN ARSITEKTUR MEMORI DINAMIS PADA PENYUSUNAN PROPOSAL TUGAS AKHIR\n\nPROPOSAL SKRIPSI\n\nDisusun oleh:\nNAMA MAHASISWA\nNIM. 1301210000\n\nPROGRAM STUDI TEKNIK INFORMATIKA\nFAKULTAS INFORMATIKA\nUNIVERSITAS ZETERA\n2024`,
    },
  },
};

export const approvalSpec = {
  slug: "persetujuan",
  code: "SECTION_APPROVAL",
  defaultTitle: "Lembar Persetujuan / Pengesahan",
  cluster: "DOCS",
  category: "SUBCHAPTER",
  aliases: ["lembar pengesahan", "lembar persetujuan", "persetujuan pembimbing", "pengesahan kaprodi", "section_approval"],
  variables: ["TOPIC", "PRODI", "NAMA_MAHASISWA", "NIM", "PEMBIMBING"],
  outline: {
    systemPrompt: `Format lembar pengesahan pembimbing dan ketua program studi dengan formulasi kalimat baku berita acara persetujuan proposal.`,
    recipeSteps: [
      "Nyatakan judul, nama mahasiswa, dan NIM yang disetujui.",
      "Sediakan kolom tanda tangan Dosen Pembimbing Utama dan Pembimbing Pendamping.",
      "Sediakan kolom pengesahan Ketua Program Studi beserta NIP/NIDN.",
    ],
  },
  paper: {
    rules: {
      citationMode: "NONE",
      introSentenceRequired: false,
      alignmentRule: "Format kolom tanda tangan resmi berita acara",
      formatStyle: "PARAGRAPH",
      badgeText: "Berita Acara • Tanda Tangan",
      badgeColor: "#7E22CE",
    },
    previewExample: {
      introSentence: "",
      points: [
        "LEMBAR PERSETUJUAN PROPOSAL SKRIPSI",
        "Menyatakan bahwa proposal skripsi ini telah diperiksa dan disetujui untuk diseminarkan.",
        "Dosen Pembimbing I & II, serta Ketua Program Studi.",
      ],
      renderedDraft: `LEMBAR PERSETUJUAN PROPOSAL SKRIPSI\n\nJudul: OPTIMASI KINERJA KECERDASAN BUATAN GENERATIF DENGAN ARSITEKTUR MEMORI DINAMIS\nNama: NAMA MAHASISWA\nNIM: 1301210000\n\nTelah disetujui untuk diajukan pada Seminar Proposal Tugas Akhir Program Studi Informatika.\n\nBandung, 10 Desember 2024\n\nMenyetujui,\n\n(Pembimbing I)                      (Pembimbing II)\nNIDN. 0401018501                     NIDN. 0402028802\n\nMengetahui,\nKetua Program Studi Informatika\nNIP. 198001012005011001`,
    },
  },
};

export const abstractSpec = {
  slug: "abstrak",
  code: "SECTION_ABSTRACT",
  defaultTitle: "Abstrak Dwibahasa & Kata Kunci",
  cluster: "DOCS",
  category: "SUBCHAPTER",
  aliases: ["abstrak", "abstract", "intisari", "dwibahasa", "kata kunci", "keywords", "section_abstract"],
  variables: ["TOPIC", "PRODI", "METODE", "OBJEK"],
  outline: {
    systemPrompt: `Susun ringkasan abstrak dwibahasa (Bahasa Indonesia & English) mencakup Latar Belakang singkat, Tujuan, Metode, dan Hasil yang diharapkan (IMRAD) dalam 200-250 kata, dilengkapi 3-5 kata kunci relevan.`,
    recipeSteps: [
      "Tuliskan abstrak Bahasa Indonesia (200-250 kata) struktur IMRAD dalam 1 paragraf padat.",
      "Sediakan terjemahan akurat dalam Bahasa Inggris akademis baku (Abstract).",
      "Sertakan 3-5 kata kunci (keywords) yang mewakili variabel, metode, dan objek penelitian.",
    ],
  },
  paper: {
    rules: {
      citationMode: "NONE", // Abstrak dilarang menggunakan sitasi
      introSentenceRequired: false,
      alignmentRule: "Struktur IMRAD, 1 paragraf padat (200-250 kata), dwibahasa",
      formatStyle: "PARAGRAPH",
      badgeText: "Dwibahasa • Struktur IMRAD",
      badgeColor: "#7E22CE",
    },
    previewExample: {
      introSentence: "",
      points: [
        "ABSTRAK (Bahasa Indonesia): Latar belakang, tujuan, metode yang diusulkan, dan luaran yang diharapkan.",
        "Kata Kunci: 3-5 istilah kunci.",
        "ABSTRACT (English): Accurate translation.",
        "Keywords: 3-5 terms.",
      ],
      renderedDraft: `ABSTRAK\n\nPenyusunan proposal skripsi sering kali menghadapi kendala diskoneksi konteks logika antar-subbab ketika menggunakan alat bantu kecerdasan buatan konvensional. Penelitian ini bertujuan untuk merancang dan menguji arsitektur dynamic context memory berbasis taksonomi akademis untuk menyelaraskan narasi proposal secara otomatis. Metode yang digunakan adalah applied experimental research dengan membandingkan model baseline terhadap arsitektur memori terstruktur. Hasil pengujian menunjukkan peningkatan konsistensi logika antar-subbab dengan tingkat keselarasan mencapai 94%. Penelitian ini berkontribusi dalam menyediakan kerangka kerja rekayasa prompt adaptif untuk penulisan ilmiah.\n\nKata Kunci: Kecerdasan Buatan, Memori Dinamis, Proposal Skripsi, Konsistensi Konteks.\n\nABSTRACT\n\nThe synthesis of undergraduate research proposals frequently suffers from cross-subchapter contextual disconnection when employing conventional AI assistants. This research aims to design and evaluate a dynamic context memory architecture based on academic taxonomy to automatically align proposal narratives. The applied experimental method was utilized by evaluating baseline models against the structured memory architecture. The experimental results indicate an improvement in logical consistency reaching 94%. This study contributes an adaptive prompt engineering framework for scholarly writing.\n\nKeywords: Artificial Intelligence, Dynamic Memory, Research Proposal, Context Consistency.`,
    },
  },
};

export const referencesSpec = {
  slug: "daftar-pustaka",
  code: "SECTION_REFERENCES",
  defaultTitle: "Daftar Pustaka (Standar IEEE & APA 7th)",
  cluster: "DOCS",
  category: "SUBCHAPTER",
  aliases: ["daftar pustaka", "bibliografi", "referensi", "references", "pustaka", "section_references"],
  variables: ["TOPIC", "PRODI", "CITATIONS_LIST"],
  outline: {
    systemPrompt: `Format daftar pustaka akademis lengkap berstandar internasional IEEE (numerik kurung siku) atau APA 7th (alfabetis). Pastikan setiap entri memuat nama penulis, tahun, judul, publikasi, dan DOI/URL yang valid.`,
    recipeSteps: [
      "Urutkan daftar pustaka sesuai gaya sitasi terpilih (numerik IEEE atau abjad APA 7th).",
      "Pastikan setiap artikel memuat nama penulis, tahun, judul, jurnal, volume, dan tautan DOI.",
    ],
  },
  paper: {
    rules: {
      citationMode: "REQUIRED",
      introSentenceRequired: false,
      alignmentRule: "Hanya memuat pustaka yang disitir dalam teks dokumen (tidak boleh ada phantom citation)",
      formatStyle: "NUMBERED_LIST",
      badgeText: "Standar IEEE / APA 7th • Valid DOI",
      badgeColor: "#7E22CE",
    },
    previewExample: {
      introSentence: "",
      points: [
        "[1] A. Vaswani et al., 'Attention is all you need,' in Proc. NeurIPS, 2017, pp. 5998–6008.",
        "[2] Sugiyono, Metode Penelitian Kuantitatif, Kualitatif, dan R&D. Bandung: Alfabeta, 2019.",
        "[3] J. W. Creswell and J. D. Creswell, Research Design: Qualitative, Quantitative, and Mixed Methods Approaches, 5th ed. SAGE, 2018.",
      ],
      renderedDraft: `DAFTAR PUSTAKA\n\n[1] A. Vaswani, N. Shazeer, N. Parmar, J. Uszkoreit, L. Jones, A. N. Gomez, L. Kaiser, and I. Polosukhin, "Attention is all you need," in Advances in Neural Information Processing Systems (NeurIPS), vol. 30, 2017, pp. 5998–6008.\n\n[2] Sugiyono, Metode Penelitian Kuantitatif, Kualitatif, dan R&D. Bandung: CV. Alfabeta, 2019.\n\n[3] J. W. Creswell and J. D. Creswell, Research Design: Qualitative, Quantitative, and Mixed Methods Approaches, 5th ed. Thousand Oaks, CA: SAGE Publications, 2018.\n\n[4] H. Pratama, R. A. Wibowo, dan S. Hidayat, "Implementasi Retrieval-Augmented Generation pada Dokumen Akademik," Jurnal RESTI (Rekayasa Sistem dan Teknologi Informasi), vol. 7, no. 4, pp. 810–818, 2023. https://doi.org/10.29207/resti.v7i4.5120`,
    },
  },
};

export const appendixSpec = {
  slug: "lampiran",
  code: "SECTION_APPENDIX",
  defaultTitle: "Lampiran & Instrumen Riset",
  cluster: "DOCS",
  category: "SUBCHAPTER",
  aliases: ["lampiran", "appendix", "instrumen kuesioner", "pedoman wawancara", "raw data", "section_appendix"],
  variables: ["TOPIC", "PRODI"],
  outline: {
    systemPrompt: `Dokumentasikan lampiran instrumen pengumpulan data, pedoman observasi, kuesioner lengkap, dan contoh transkrip wawancara yang mendukung verifikasi penelitian.`,
    recipeSteps: [
      "Susun instrumen pengumpulan data primer (kuesioner terstruktur atau pedoman wawancara).",
      "Sertakan tabel kisi-kisi instrumen penghubung variabel ke butir ukur.",
    ],
  },
  paper: {
    rules: {
      citationMode: "NONE",
      introSentenceRequired: false,
      alignmentRule: "Mendukung pembuktian instrumen yang dijabarkan di Bab 3",
      formatStyle: "PARAGRAPH",
      badgeText: "Instrumen Lengkap • Lampiran Bukti",
      badgeColor: "#7E22CE",
    },
    previewExample: {
      introSentence: "",
      points: [
        "Lampiran 1: Kuesioner Evaluasi Usability Sistem (Skala Likert 1-5).",
        "Lampiran 2: Lembar Validasi Instrumen Ahli (Expert Judgment).",
        "Lampiran 3: Log Telemetri dan Kode Sumber Modul Routing.",
      ],
      renderedDraft: `LAMPIRAN 1: KUESIONER EVALUASI SISTEM\n\nPetunjuk Pengisian: Berikan tanda centang (✓) pada kolom yang paling sesuai dengan penilaian Anda (1 = Sangat Tidak Setuju s/d 5 = Sangat Setuju).\n\nNo. | Pernyataan | 1 | 2 | 3 | 4 | 5 |\n1. Antarmuka membantu penyusunan latar belakang secara terstruktur.\n2. Rumusan masalah yang dihasilkan selaras dengan tujuan penelitian.\n3. Waktu respons inferensi sistem terasa cepat dan andal.`,
    },
  },
};
