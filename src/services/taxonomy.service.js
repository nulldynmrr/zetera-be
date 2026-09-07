/**
 * Zetera Academic Taxonomy Service
 * Mendefinisikan identitas semantik (19 taksonomi tag) yang independen dari posisi/nomor bab.
 */

export const SUBCHAPTER_TAXONOMY = {
  latar_belakang: {
    bab: 1,
    defaultTitle: "Latar Belakang",
    aliases: [
      "latar belakang",
      "latar belakang masalah",
      "background",
      "1.1",
      "subchapter_1_1",
    ],
    defaultRecipeSteps: [
      "Definisikan konsep/variabel utama topik dari sumber akademik/resmi.",
      "Jelaskan fenomena/kondisi terkini terkait topik (data, tren, urgensi).",
      "Jelaskan dampak/pentingnya isu ini bila tidak diteliti/ditangani.",
      "Jelaskan konteks objek penelitian (platform, lokasi, populasi yang relevan dengan topik).",
      "Jelaskan metode/pendekatan yang dipakai dan alasan relevansinya untuk topik ini.",
      "Ulas singkat 2–4 penelitian terdahulu sejenis beserta temuannya.",
      "Identifikasi research gap dari penelitian terdahulu tersebut.",
      "Tutup dengan kalimat pengarah ke fokus penelitian (jembatan ke 1.3 Rumusan Masalah)."
    ]
  },
  identifikasi_masalah: {
    bab: 1,
    defaultTitle: "Identifikasi Masalah",
    aliases: [
      "identifikasi masalah",
      "masalah potensial",
      "1.2",
      "subchapter_1_2",
    ],
    defaultRecipeSteps: [
      "Daftar masalah yang muncul dari isu di Latar Belakang (poin bernomor).",
      "Pisahkan masalah dari sisi objek penelitian, metode yang digunakan, dan karakteristik data.",
      "Pastikan tiap poin bisa dipetakan ke minimal satu Rumusan Masalah."
    ]
  },
  rumusan_masalah: {
    bab: 1,
    defaultTitle: "Rumusan Masalah",
    aliases: [
      "rumusan masalah",
      "pertanyaan penelitian",
      "research questions",
      "1.3",
      "subchapter_1_3",
    ],
    defaultRecipeSteps: [
      "Tulis dalam kalimat tanya ('Bagaimana...', 'Apakah...', 'Sejauh mana...').",
      "Jumlah rumusan masalah selaras 1:1 dengan Tujuan Penelitian.",
      "Pastikan tiap rumusan bisa dijawab dengan metode yang dipilih di BAB III."
    ]
  },
  batasan_masalah: {
    bab: 1,
    defaultTitle: "Batasan Masalah",
    aliases: [
      "batasan masalah",
      "ruang lingkup",
      "scope",
      "limitations",
      "1.4",
      "subchapter_1_4",
    ],
    defaultRecipeSteps: [
      "Batasi dari sisi data (rentang waktu, jumlah sampel, sumber data).",
      "Batasi dari sisi variabel atau dimensi utama yang diteliti.",
      "Batasi dari sisi metode, algoritma, atau tools yang dipakai."
    ]
  },
  tujuan_penelitian: {
    bab: 1,
    defaultTitle: "Tujuan Penelitian",
    aliases: [
      "tujuan penelitian",
      "research objective",
      "1.5",
      "subchapter_1_5",
    ],
    defaultRecipeSteps: [
      "Satu tujuan untuk tiap Rumusan Masalah, kalimat pernyataan ('Untuk mengetahui...', 'Untuk menganalisis...').",
      "Pastikan measurable dan konsisten dengan Batasan Masalah."
    ]
  },
  manfaat_penelitian: {
    bab: 1,
    defaultTitle: "Manfaat Penelitian",
    aliases: [
      "manfaat penelitian",
      "signifikansi penelitian",
      "1.6",
      "subchapter_1_6",
    ],
    defaultRecipeSteps: [
      "Manfaat Teoritis: kontribusi ke ilmu pengetahuan/bidang studi.",
      "Manfaat Praktis: kegunaan bagi objek penelitian, institusi, atau masyarakat."
    ]
  },
  sistematika_penulisan: {
    bab: 1,
    defaultTitle: "Sistematika Penulisan",
    aliases: [
      "sistematika penulisan",
      "sistematika skripsi",
      "struktur penulisan",
      "1.7",
      "subchapter_1_7",
    ],
    defaultRecipeSteps: [
      "Ringkasan 1–2 kalimat per BAB (BAB I–III untuk proposal, BAB I–V untuk skripsi penuh)."
    ]
  },
  landasan_teori: {
    bab: 2,
    defaultTitle: "Landasan Teori",
    aliases: [
      "landasan teori",
      "tinjauan pustaka",
      "kajian pustaka",
      "kajian teori",
      "teori dasar",
      "2.1",
      "subchapter_2_1",
    ],
    defaultRecipeSteps: [
      "Definisi konsep dari minimal 2 sumber (buku/jurnal), bandingkan, lalu simpulkan definisi kerja yang dipakai penelitian ini.",
      "Karakteristik/dimensi/indikator dari konsep tersebut.",
      "Jika topik memakai metode/algoritma spesifik → jelaskan cara kerjanya secara konseptual, rujuk sumber aslinya."
    ]
  },
  penelitian_terdahulu: {
    bab: 2,
    defaultTitle: "Penelitian Terdahulu",
    aliases: [
      "penelitian terdahulu",
      "studi terdahulu",
      "literature review",
      "kajian literatur terdahulu",
      "2.2",
      "subchapter_2_2",
    ],
    defaultRecipeSteps: [
      "Tabel/daftar penelitian terdahulu: peneliti, tahun, topik, metode, hasil.",
      "Analisis persamaan & perbedaan dengan penelitian ini.",
      "Simpulkan gap/kontribusi baru penelitian ini secara eksplisit."
    ]
  },
  kerangka_berpikir: {
    bab: 2,
    defaultTitle: "Kerangka Berpikir",
    aliases: [
      "kerangka berpikir",
      "kerangka konseptual",
      "kerangka konsep",
      "2.3",
      "subchapter_2_3",
    ],
    defaultRecipeSteps: [
      "Gambarkan alur input → proses/metode → output yang diharapkan (diagram kerangka berpikir).",
      "Hubungkan tiap elemen kerangka berpikir ke teori di 2.1 dan gap di 2.2."
    ]
  },
  hipotesis_penelitian: {
    bab: 2,
    defaultTitle: "Hipotesis Penelitian",
    aliases: [
      "hipotesis",
      "hipotesis penelitian",
      "dugaan sementara",
      "2.4",
      "subchapter_2_4",
    ],
    defaultRecipeSteps: [
      "Tulis H0/H1 untuk tiap hubungan variabel yang diuji.",
      "Harus konsisten dengan Rumusan Masalah & Kerangka Berpikir."
    ]
  },
  jenis_pendekatan_penelitian: {
    bab: 3,
    defaultTitle: "Jenis/Pendekatan Penelitian",
    aliases: [
      "jenis pendekatan",
      "pendekatan penelitian",
      "jenis penelitian",
      "desain penelitian",
      "metode penelitian",
      "3.1",
      "subchapter_3_1",
    ],
    defaultRecipeSteps: [
      "Nyatakan pendekatan (kuantitatif/kualitatif) dan alasan pemilihan, dikaitkan ke Rumusan Masalah.",
      "Rujuk definisi pendekatan dari sumber metodologi (mis. Sugiyono, Creswell)."
    ]
  },
  objek_lokasi_penelitian: {
    bab: 3,
    defaultTitle: "Objek/Subjek dan Lokasi Penelitian",
    aliases: [
      "objek penelitian",
      "subjek penelitian",
      "lokasi penelitian",
      "tempat dan waktu penelitian",
      "3.2",
      "subchapter_3_2",
    ],
    defaultRecipeSteps: [
      "Jelaskan objek penelitian (platform/perusahaan/dataset) dan alasan pemilihannya.",
      "Jelaskan lokasi/waktu penelitian bila relevan."
    ]
  },
  populasi_sampel: {
    bab: 3,
    defaultTitle: "Populasi & Sampel / Informan",
    aliases: [
      "populasi sampel",
      "populasi dan sampel",
      "informan penelitian",
      "teknik sampling",
      "3.3",
      "subchapter_3_3",
    ],
    defaultRecipeSteps: [
      "Kuantitatif: Definisikan populasi, teknik sampling, justifikasi ukuran sampel (rumus Slovin/Krejcie).",
      "Kualitatif: Kriteria informan/subjek dan teknik penentuannya (purposive/snowball)."
    ]
  },
  teknik_pengumpulan_data: {
    bab: 3,
    defaultTitle: "Teknik Pengumpulan Data",
    aliases: [
      "teknik pengumpulan data",
      "pengumpulan data",
      "sumber data",
      "3.4",
      "subchapter_3_4",
    ],
    defaultRecipeSteps: [
      "Jelaskan sumber data (primer/sekunder).",
      "Jelaskan metode pengumpulan (kuesioner/wawancara/scraping/API) beserta prosedurnya."
    ]
  },
  instrumen_penelitian: {
    bab: 3,
    defaultTitle: "Instrumen Penelitian",
    aliases: [
      "instrumen penelitian",
      "alat ukur",
      "kisi kisi instrumen",
      "pedoman wawancara",
      "3.5",
      "subchapter_3_5",
    ],
    defaultRecipeSteps: [
      "Jelaskan alat/instrumen yang dipakai (kuesioner, pedoman wawancara, tools/software).",
      "Sertakan tabel kisi-kisi instrumen (variabel, indikator, butir ukur)."
    ]
  },
  definisi_operasional_variabel: {
    bab: 3,
    defaultTitle: "Definisi Operasional Variabel",
    aliases: [
      "definisi operasional",
      "operasionalisasi variabel",
      "definisi variabel",
      "3.6",
      "subchapter_3_6",
    ],
    defaultRecipeSteps: [
      "Untuk tiap variabel: definisi operasional, indikator, skala pengukuran (Likert/Nominal/Interval/Rasio)."
    ]
  },
  teknik_analisis_data: {
    bab: 3,
    defaultTitle: "Teknik Analisis Data",
    aliases: [
      "teknik analisis data",
      "analisis data",
      "metode analisis",
      "analisis statistik",
      "3.7",
      "subchapter_3_7",
    ],
    defaultRecipeSteps: [
      "Jelaskan tahapan analisis berurutan (preprocessing → metode inti → evaluasi).",
      "Kuantitatif: Uji statistik yang dipakai & alasannya.",
      "Kualitatif: Teknik analisis (Miles & Huberman: reduksi, penyajian, verifikasi data)."
    ]
  },
  uji_keabsahan_data: {
    bab: 3,
    defaultTitle: "Uji Validitas & Reliabilitas / Keabsahan Data",
    aliases: [
      "uji validitas",
      "validitas dan reliabilitas",
      "uji keabsahan data",
      "triangulasi",
      "3.8",
      "subchapter_3_8",
    ],
    defaultRecipeSteps: [
      "Kuantitatif: Uji instrumen (validitas Pearson/CFA, reliabilitas Cronbach Alpha > 0.70).",
      "Kualitatif: Teknik triangulasi (sumber, metode, waktu) dan member checking untuk menjamin keabsahan data."
    ]
  },
  cover: {
    bab: 0,
    defaultTitle: "Sampul Depan (Cover Skripsi)",
    aliases: [
      "cover",
      "sampul",
      "sampul depan",
      "halaman judul",
      "cover skripsi",
      "section_cover",
    ],
    defaultRecipeSteps: [
      "Formulasikan judul skripsi yang lugas, padat, dan mencerminkan variabel/metode utama.",
      "Sertakan identitas lengkap peneliti (Nama, NIM) dan pernyataan pengajuan tugas akhir.",
      "Sertakan hierarki Program Studi, Fakultas, Universitas, dan tahun penyusunan."
    ]
  },
  persetujuan: {
    bab: 0,
    defaultTitle: "Lembar Persetujuan / Pengesahan Pembimbing",
    aliases: [
      "lembar persetujuan",
      "lembar pengesahan",
      "persetujuan pembimbing",
      "pengesahan",
      "section_approval",
    ],
    defaultRecipeSteps: [
      "Verifikasi keselarasan judul bahasa Indonesia dan bahasa Inggris.",
      "Susun format kolom tanda tangan Dosen Pembimbing I dan Pembimbing II lengkap dengan NIP/NIDN.",
      "Sediakan kolom mengetahui Ketua Program Studi beserta tempat dan tanggal persetujuan."
    ]
  },
  abstrak: {
    bab: 0,
    defaultTitle: "Abstrak Dwibahasa & Kata Kunci",
    aliases: [
      "abstrak",
      "abstract",
      "intisari",
      "dwibahasa",
      "section_abstract",
    ],
    defaultRecipeSteps: [
      "Tuliskan abstrak Bahasa Indonesia (200-250 kata) struktur IMRAD dalam 1 paragraf padat.",
      "Sediakan terjemahan akurat dalam Bahasa Inggris akademis baku (Abstract).",
      "Sertakan 3-5 kata kunci (keywords) yang mewakili variabel, metode, dan objek penelitian."
    ]
  },
  daftar_pustaka: {
    bab: 4,
    defaultTitle: "Daftar Pustaka (Standar IEEE & APA 7th)",
    aliases: [
      "daftar pustaka",
      "bibliografi",
      "referensi",
      "references",
      "pustaka",
      "section_references",
    ],
    defaultRecipeSteps: [
      "Urutkan daftar pustaka sesuai gaya sitasi terpilih (numerik IEEE atau abjad APA 7th).",
      "Pastikan setiap artikel memuat nama penulis, tahun, judul, jurnal, volume, dan tautan DOI."
    ]
  },
  lampiran: {
    bab: 5,
    defaultTitle: "Lampiran & Instrumen Riset",
    aliases: [
      "lampiran",
      "appendix",
      "instrumen kuesioner",
      "pedoman wawancara",
      "section_appendix",
    ],
    defaultRecipeSteps: [
      "Susun instrumen pengumpulan data primer (kuesioner terstruktur atau pedoman wawancara).",
      "Sertakan tabel kisi-kisi instrumen penghubung variabel ke butir ukur."
    ]
  },
};

/**
 * Normalisasi string untuk pencocokan taksonomi & alias
 */
export function normalizeText(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * In-memory cache prompt (TTL 30 detik)
 */
const promptCache = new Map();
const PROMPT_CACHE_TTL = 30 * 1000;

export function invalidatePromptDbCache() {
  promptCache.clear();
}

import { resolveSubchapterSpec, ALL_SUBCHAPTER_SPECS } from "../subchapters/index.js";

/**
 * Smart Tag & Alias Resolver: Mencari Prompt dari Database `ai_skill_prompts`
 * Menyelaraskan variasi penamaan mahasiswa (e.g. "Latar Belakang", "Fenomena", "Latar Belakar")
 * secara langsung ke prompt dinamis di Database dengan fallback ke spesifikasi modular!
 */
export async function resolveSubchapterSkillPrompt({ itemId = "", title = "", tag = "" } = {}, prismaClient) {
  const normTitle = normalizeText(title);
  const normItemId = normalizeText(itemId);
  const normTag = normalizeText(tag);

  const cacheKey = `${normItemId}:${normTag}:${normTitle}`;
  const now = Date.now();
  if (promptCache.has(cacheKey)) {
    const cached = promptCache.get(cacheKey);
    if (now - cached.timestamp < PROMPT_CACHE_TTL) {
      return cached.data;
    }
  }

  // 0. Coba resolve via modul spesifikasi modular terlebih dahulu
  const modularSpec = resolveSubchapterSpec({ itemId, title, tag });
  let targetCode = modularSpec ? modularSpec.code : "";

  // 1. Cek Dokumen Struktural
  if (normTag.includes("cover") || normTitle.includes("cover") || normTitle.includes("sampul") || normTitle.includes("halaman judul")) {
    targetCode = "SECTION_COVER";
  } else if (normTag.includes("persetujuan") || normTag.includes("pengesahan") || normTitle.includes("persetujuan") || normTitle.includes("pengesahan")) {
    targetCode = "SECTION_APPROVAL";
  } else if (normTag.includes("abstrak") || normTitle.includes("abstrak") || normTitle.includes("abstract") || normTitle.includes("intisari")) {
    targetCode = "SECTION_ABSTRACT";
  } else if (normTag.includes("pustaka") || normTitle.includes("daftar pustaka") || normTitle.includes("bibliografi") || normTitle.includes("referensi") || normTitle.includes("references")) {
    targetCode = "SECTION_REFERENCES";
  } else if (normTag.includes("lampiran") || normTitle.includes("lampiran") || normTitle.includes("appendix")) {
    targetCode = "SECTION_APPENDIX";
  }

  // 2. Cek Bab 1
  else if (normTag.includes("latar") || normTitle.includes("latar") || normTitle.includes("fenomena") || normItemId === "1 1" || itemId === "1.1") {
    targetCode = "SUBCHAPTER_1_1";
  } else if (normTag.includes("identifikasi") || normTitle.includes("identifikasi") || normTitle.includes("masalah potensial") || normItemId === "1 2" || itemId === "1.2") {
    targetCode = "SUBCHAPTER_1_2";
  } else if (normTag.includes("rumusan") || normTitle.includes("rumusan") || normTitle.includes("pertanyaan penelitian") || normItemId === "1 3" || itemId === "1.3") {
    targetCode = "SUBCHAPTER_1_3";
  } else if (normTag.includes("batasan") || normTitle.includes("batasan") || normTitle.includes("ruang lingkup") || normTitle.includes("scope") || normItemId === "1 4" || itemId === "1.4") {
    targetCode = "SUBCHAPTER_1_4";
  } else if (normTag.includes("tujuan") || normTitle.includes("tujuan") || normTitle.includes("objective") || normItemId === "1 5" || itemId === "1.5") {
    targetCode = "SUBCHAPTER_1_5";
  } else if (normTag.includes("manfaat") || normTitle.includes("manfaat") || normTitle.includes("signifikansi") || normTitle.includes("kontribusi") || normItemId === "1 6" || itemId === "1.6") {
    targetCode = "SUBCHAPTER_1_6";
  } else if (normTag.includes("sistematika") || normTitle.includes("sistematika") || normItemId === "1 7" || itemId === "1.7") {
    targetCode = "SUBCHAPTER_1_7";
  }

  // 3. Cek Bab 2
  else if (normTag.includes("landasan") || (normTitle.includes("teori") && !normTitle.includes("kerangka")) || normTitle.includes("kajian pustaka") || normItemId === "2 1" || itemId === "2.1") {
    targetCode = "SUBCHAPTER_2_1";
  } else if (normTag.includes("terdahulu") || normTitle.includes("terdahulu") || normTitle.includes("matriks") || normItemId === "2 2" || itemId === "2.2") {
    targetCode = "SUBCHAPTER_2_2";
  } else if (normTag.includes("kerangka") || normTitle.includes("kerangka") || normTitle.includes("alur pikir") || normItemId === "2 3" || itemId === "2.3") {
    targetCode = "SUBCHAPTER_2_3";
  } else if (normTag.includes("hipotesis") || normTitle.includes("hipotesis") || normItemId === "2 4" || itemId === "2.4") {
    targetCode = "SUBCHAPTER_2_4";
  }

  // 4. Cek Bab 3
  else if (normTag.includes("pendekatan") || normTitle.includes("pendekatan") || normTitle.includes("jenis penelitian") || normItemId === "3 1" || itemId === "3.1") {
    targetCode = "SUBCHAPTER_3_1";
  } else if (normTag.includes("objek") || normTitle.includes("objek") || normTitle.includes("subjek") || normTitle.includes("lokasi") || normItemId === "3 2" || itemId === "3.2") {
    targetCode = "SUBCHAPTER_3_2";
  } else if (normTag.includes("populasi") || normTitle.includes("populasi") || normTitle.includes("sampel") || normTitle.includes("informan") || normItemId === "3 3" || itemId === "3.3") {
    targetCode = "SUBCHAPTER_3_3";
  } else if (normTag.includes("pengumpulan") || normTitle.includes("pengumpulan") || normItemId === "3 4" || itemId === "3.4") {
    targetCode = "SUBCHAPTER_3_4";
  } else if (normTag.includes("instrumen") || normTitle.includes("instrumen") || normTitle.includes("kisi") || normItemId === "3 5" || itemId === "3.5") {
    targetCode = "SUBCHAPTER_3_5";
  } else if (normTag.includes("operasional") || normTitle.includes("operasional") || normItemId === "3 6" || itemId === "3.6") {
    targetCode = "SUBCHAPTER_3_6";
  } else if (normTag.includes("analisis") || normTitle.includes("analisis data") || normItemId === "3 7" || itemId === "3.7") {
    targetCode = "SUBCHAPTER_3_7";
  } else if (normTag.includes("validitas") || normTitle.includes("validitas") || normTitle.includes("reliabilitas") || normTitle.includes("keabsahan") || normItemId === "3 8" || itemId === "3.8") {
    targetCode = "SUBCHAPTER_3_8";
  }

  // 5. Jika ada target code, cari di tabel `aiSkillPrompt`
  let dbPrompt = null;
  const prisma = prismaClient || (await import("../lib/prisma.js")).default;

  if (targetCode && prisma?.aiSkillPrompt) {
    try {
      dbPrompt = await prisma.aiSkillPrompt.findFirst({
        where: { code: targetCode, isActive: true },
      });
    } catch (err) {
      console.warn(`[resolveSubchapterSkillPrompt] DB query error for ${targetCode}:`, err.message);
    }
  }

  // 6. Fallback: Cari berdasarkan tags jika targetCode belum dapat
  if (!dbPrompt && tag && prisma?.aiSkillPrompt) {
    try {
      dbPrompt = await prisma.aiSkillPrompt.findFirst({
        where: {
          isActive: true,
          tags: { has: tag.toLowerCase() },
        },
      });
    } catch (_) {}
  }

  const result = {
    code: targetCode || (itemId ? `SUBCHAPTER_${itemId.replace(".", "_")}` : "SUBCHAPTER_GENERIC"),
    prompt: dbPrompt,
    targetCode,
    spec: modularSpec,
    paperRules: modularSpec?.paper?.rules || {},
    previewExample: modularSpec?.paper?.previewExample || null,
    isSistematika: targetCode === "SUBCHAPTER_1_7",
    isCitationFree: modularSpec?.paper?.rules?.citationMode === "NONE" || (targetCode.startsWith("SUBCHAPTER_1_") && targetCode !== "SUBCHAPTER_1_1"),
    isDocumentSection: targetCode.startsWith("SECTION_"),
  };

  promptCache.set(cacheKey, { data: result, timestamp: now });
  return result;
}

/**
 * Resolve semantic tag dari title dan/atau itemId
 * Mengembalikan: { tag: string | null, isCustom: boolean, needsReview: boolean }
 */
export function resolveSubchapterTag(title, itemId) {
  const normTitle = normalizeText(title);
  const normItemId = normalizeText(itemId);

  // 1. Cek langsung kecocokan exact atau alias pada taksonomi
  for (const [tag, data] of Object.entries(SUBCHAPTER_TAXONOMY)) {
    if (tag === normTitle || tag === normItemId) {
      return { tag, isCustom: false, needsReview: false };
    }

    for (const alias of data.aliases) {
      const normAlias = normalizeText(alias);
      if (
        normTitle === normAlias ||
        normItemId === normAlias ||
        normTitle.includes(normAlias) ||
        normAlias.includes(normTitle)
      ) {
        return { tag, isCustom: false, needsReview: false };
      }
    }
  }

  // 2. Jika itemId adalah nomor bab standar (misal "1.1", "2.3")
  const standardMatch = String(itemId || "").match(/^([1-3])\.(\d+)$/);
  if (standardMatch) {
    const bab = parseInt(standardMatch[1], 10);
    const num = parseInt(standardMatch[2], 10);
    // Cari tag berdasarkan bab dan urutan default bila ada
    const tagEntries = Object.entries(SUBCHAPTER_TAXONOMY).filter(
      ([_, data]) => data.bab === bab
    );
    if (tagEntries[num - 1]) {
      return { tag: tagEntries[num - 1][0], isCustom: false, needsReview: false };
    }
  }

  // 3. Fallback: Custom sub-chapter yang tidak masuk taksonomi 19 baku
  return {
    tag: null,
    isCustom: true,
    needsReview: true,
  };
}
