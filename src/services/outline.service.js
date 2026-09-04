import prisma from "../lib/prisma.js";
import Groq from "groq-sdk";
import { parseJsonFromText } from "../lib/groq-config.js";
import { executeAiCompletion } from "./ai-router.service.js";
import { buildMemoryContext, updateCitationMap, updateTocSnapshot } from "./memory.service.js";
import { getAllSubchapterGuides, getSkillPrompt } from "./prompt.service.js";

function getGroqClient() {
  const apiKey =
    process.env.GROQ_API_KEY_SCREENING ||
    process.env.GROQ_API_KEY_FRAMEWORK_RELASI ||
    process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.startsWith("gsk_demo") || apiKey === "gsk_your_groq_api_key_here") return null;
  return new Groq({ apiKey });
}

/**
 * Dependency map: itemId → array of itemIds yang harus COMPLETED dulu
 */
const DEPENDENCY_MAP = {
  "1.1.4": ["1.1.1", "1.1.2", "1.1.3"],
  "1.1.5": ["1.1.4"],
  "1.2": ["1.1"],
  "1.3": ["1.2"],
  "1.4": ["1.3"],
  "2.2": [],
  "2.3": [],
  "2.4": ["2.2", "2.3"],
  "3.2": ["3.1"],
  "3.3": ["3.1"],
  "3.4": ["3.3"],
  "3.5": ["3.4"],
};

/**
 * Modeling Akademik Terpisah per Sub-bab (Fallback Baseline if DB is offline)
 */
export const SUBCHAPTER_MODELING_GUIDES = {
  "1.1": {
    name: "Latar Belakang (Piramida Terbalik)",
    steps: [
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
  "1.2": {
    name: "Identifikasi Masalah",
    steps: [
      "Daftar masalah yang muncul dari isu di Latar Belakang (poin bernomor).",
      "Pisahkan masalah dari sisi objek penelitian, metode yang digunakan, dan karakteristik data.",
      "Pastikan tiap poin bisa dipetakan ke minimal satu Rumusan Masalah."
    ]
  },
  "1.3": {
    name: "Rumusan Masalah",
    steps: [
      "Tulis dalam kalimat tanya ('Bagaimana...', 'Apakah...', 'Sejauh mana...').",
      "Jumlah rumusan masalah selaras 1:1 dengan Tujuan Penelitian.",
      "Pastikan tiap rumusan bisa dijawab dengan metode yang dipilih di BAB III."
    ]
  },
  "1.4": {
    name: "Batasan Masalah",
    steps: [
      "Batasi dari sisi data (rentang waktu, jumlah sampel, sumber data).",
      "Batasi dari sisi variabel atau dimensi utama yang diteliti.",
      "Batasi dari sisi metode, algoritma, atau tools yang dipakai."
    ]
  },
  "1.5": {
    name: "Tujuan Penelitian",
    steps: [
      "Satu tujuan untuk tiap Rumusan Masalah, kalimat pernyataan ('Untuk mengetahui...', 'Untuk menganalisis...').",
      "Pastikan measurable dan konsisten dengan Batasan Masalah."
    ]
  },
  "1.6": {
    name: "Manfaat Penelitian",
    steps: [
      "Manfaat Teoritis: kontribusi ke ilmu pengetahuan/bidang studi.",
      "Manfaat Praktis: kegunaan bagi objek penelitian, institusi, atau masyarakat."
    ]
  },
  "1.7": {
    name: "Sistematika Penulisan",
    steps: [
      "Ringkasan 1–2 kalimat per BAB (BAB I–III untuk proposal, BAB I–V untuk skripsi penuh)."
    ]
  },
  "2.1": {
    name: "Landasan Teori",
    steps: [
      "Definisi konsep dari minimal 2 sumber (buku/jurnal), bandingkan, lalu simpulkan definisi kerja yang dipakai penelitian ini.",
      "Karakteristik/dimensi/indikator dari konsep tersebut.",
      "Jika topik memakai metode/algoritma spesifik → jelaskan cara kerjanya secara konseptual, rujuk sumber aslinya."
    ]
  },
  "2.2": {
    name: "Penelitian Terdahulu",
    steps: [
      "Tabel/daftar penelitian terdahulu: peneliti, tahun, topik, metode, hasil.",
      "Analisis persamaan & perbedaan dengan penelitian ini.",
      "Simpulkan gap/kontribusi baru penelitian ini secara eksplisit."
    ]
  },
  "2.3": {
    name: "Kerangka Berpikir",
    steps: [
      "Gambarkan alur input → proses/metode → output yang diharapkan (diagram kerangka berpikir).",
      "Hubungkan tiap elemen kerangka berpikir ke teori di 2.1 dan gap di 2.2."
    ]
  },
  "2.4": {
    name: "Hipotesis Penelitian [Kuantitatif]",
    steps: [
      "Tulis H0/H1 untuk tiap hubungan variabel yang diuji.",
      "Harus konsisten dengan Rumusan Masalah & Kerangka Berpikir."
    ]
  },
  "3.1": {
    name: "Jenis/Pendekatan Penelitian",
    steps: [
      "Nyatakan pendekatan (kuantitatif/kualitatif) dan alasan pemilihan, dikaitkan ke Rumusan Masalah.",
      "Rujuk definisi pendekatan dari sumber metodologi (mis. Sugiyono, Creswell)."
    ]
  },
  "3.2": {
    name: "Objek/Subjek dan Lokasi Penelitian",
    steps: [
      "Jelaskan objek penelitian (platform/perusahaan/dataset) dan alasan pemilihannya.",
      "Jelaskan lokasi/waktu penelitian bila relevan."
    ]
  },
  "3.3": {
    name: "Populasi & Sampel / Informan",
    steps: [
      "Kuantitatif: Definisikan populasi, teknik sampling, justifikasi ukuran sampel (rumus Slovin/Krejcie).",
      "Kualitatif: Kriteria informan/subjek dan teknik penentuannya (purposive/snowball)."
    ]
  },
  "3.4": {
    name: "Teknik Pengumpulan Data",
    steps: [
      "Jelaskan sumber data (primer/sekunder).",
      "Jelaskan metode pengumpulan (kuesioner/wawancara/scraping/API) beserta prosedurnya."
    ]
  },
  "3.5": {
    name: "Instrumen Penelitian",
    steps: [
      "Jelaskan alat/instrumen yang dipakai (kuesioner, pedoman wawancara, tools/software).",
      "Sertakan tabel kisi-kisi instrumen (variabel, indikator, butir ukur)."
    ]
  },
  "3.6": {
    name: "Definisi Operasional Variabel [Kuantitatif]",
    steps: [
      "Untuk tiap variabel: definisi operasional, indikator, skala pengukuran (Likert/Nominal/Interval/Rasio)."
    ]
  },
  "3.7": {
    name: "Teknik Analisis Data",
    steps: [
      "Jelaskan tahapan analisis berurutan (preprocessing → metode inti → evaluasi).",
      "Kuantitatif: Uji statistik yang dipakai & alasannya.",
      "Kualitatif: Teknik analisis (Miles & Huberman: reduksi, penyajian, verifikasi data)."
    ]
  },
  "3.8": {
    name: "Uji Validitas & Reliabilitas / Keabsahan Data",
    steps: [
      "Kuantitatif: Uji instrumen (validitas Pearson/CFA, reliabilitas Cronbach Alpha > 0.70).",
      "Kualitatif: Teknik triangulasi (sumber, metode, waktu) dan member checking untuk menjamin keabsahan data."
    ]
  }
};

/**
 * 1. Generate Research Blueprint
 */
export async function generateResearchBlueprint({ projectId, userId }) {
  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId },
  });

  if (!project) throw new Error("Project tidak ditemukan");

  const approachConfig = project.approachConfig || {};
  const commonNarrative = project.commonNarrative || {};
  const memoryContext = await buildMemoryContext(projectId).catch(() => "");
  const customOutline = project.customOutline;

  // Baca active guides dari Database / Prompt Library (bisa diupdate Admin)
  const dbGuides = await getAllSubchapterGuides();
  const activeGuides = dbGuides || SUBCHAPTER_MODELING_GUIDES;

  const systemPrompt = `Anda adalah Research Blueprint Architect & Metodolog Skripsi Ahli (Zetera AI).
Tugas Anda adalah merancang RESEARCH BLUEPRINT komprehensif & instruksi riset yang SANGAT KONKRET, DETAIL, MUDAH DIPAHAMI MAHASISWA, dan TERIKAT 100% KETAT PADA TOPIK RISET (STRICT TOPIC-BOUND).

ATURAN WAJIB (STRICT CONSTRAINTS - DILARANG NGACO/GENERIK):
1. MODELING BERBEDA UNTUK TIAP SUB-BAB (DILARANG DISAMAKAN):
   Setiap sub-bab memiliki peran akademis yang unik. Gunakan resep pemodelan berikut:
${Object.entries(activeGuides)
  .map(([code, g]) => `   - Sub-bab ${code} (${g.name}):\n` + (g.steps || []).map((s, idx) => `     ${idx + 1}. ${s}`).join("\n"))
  .join("\n\n")}

2. KETERIKATAN TOPIK MUTLAK:
   - Setiap kalimat instruksi WAJIB secara nyata menyebut nama variabel, konsep, objek, platform, atau metode dari judul: "${project.title}".
   - Dilarang keras mengarang nama orang asing fiktif di luar konteks topik.

3. KATA KUNCI JURNAL PRESISI:
   - Tentukan rekomendasi kata kunci pencarian jurnal ilmiah ("searchQuery") yang sangat spesifik dan akurat untuk tiap butir instruksi.

${memoryContext ? memoryContext + "\n" : ""}

Format output WAJIB JSON murni:
{
  "items": [
    {
      "itemId": "1.1",
      "title": "Latar Belakang",
      "bab": 1,
      "depth": 2,
      "order": 1,
      "isLocked": false,
      "dependsOn": [],
      "researchTask": {
        "what": "Uraian ringkas apa yang harus dikaji pada sub-bab ini (sebutkan variabel/objek spesifik)",
        "why": "Kenapa bagian ini penting dalam proposal ini",
        "how": "Langkah konkret mencari literatur/data rujukan",
        "bulletInstructions": [
          {
            "step": "Instruksi konkret butir 1 terkait topik...",
            "searchQuery": "kata kunci pencarian jurnal butir 1"
          },
          {
            "step": "Instruksi konkret butir 2 terkait topik...",
            "searchQuery": "kata kunci pencarian jurnal butir 2"
          }
        ],
        "searchQueries": ["query 1 english", "query 2 spesifik"],
        "targetEvidence": 3,
        "evidenceType": ["jurnal terindeks", "laporan resmi"]
      }
    }
  ]
}`;

  let userPrompt = `Rancang Research Blueprint Proposal Skripsi Spesifik Topik:
- Judul Skripsi: "${project.title}"
- Bidang Kajian: "${project.field || project.prodi || "Informatika / Ilmu Komputer"}"
- Pendekatan Riset: "${project.approachType || "QUANTITATIVE"}"
- Konfigurasi Variabel/Fokus: ${JSON.stringify(approachConfig)}
- Narasi Awal: ${JSON.stringify(commonNarrative)}
- Program Studi: "${project.prodi || "Teknik Informatika"}"`;

  if (customOutline && Array.isArray(customOutline) && customOutline.length > 0) {
    userPrompt += `\n\nKERANGKA DAFTAR ISI YANG SUDAH DISETUJUI USER (Gunakan struktur ini sebagai scaffold/kerangka pasti dan isi tiap instruksinya terikat pada topik di atas):\n${JSON.stringify(customOutline)}`;
  } else {
    userPrompt += `\n\nGunakan struktur baku proposal Indonesia sesuai pendekatan ${project.approachType || "QUANTITATIVE"} dan isi setiap butir instruksinya dengan nama variabel dan konteks spesifik dari "${project.title}".`;
  }

  let items = null;

  try {
    const aiResponse = await executeAiCompletion({
      featureCode: "OUTLINE_BLUEPRINT",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.35,
      maxTokens: 5000,
      jsonMode: true,
      userId,
    }).catch(() => null);

    if (aiResponse?.content) {
      const parsed = parseJsonFromText(aiResponse.content);
      if (parsed?.items?.length > 0) items = parsed.items;
    }
  } catch (_) { }

  // Fallback ke Groq
  if (!items) {
    const groq = getGroqClient();
    if (groq) {
      const chat = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.35,
        max_tokens: 5000,
        response_format: { type: "json_object" },
      });
      const parsed = parseJsonFromText(chat.choices[0]?.message?.content || "");
      if (parsed?.items?.length > 0) items = parsed.items;
    }
  }

  // Fallback default jika AI gagal total
  if (!items) {
    items = buildDefaultBlueprint(project.title, project.approachType || "QUANTITATIVE");
  }

  // Hapus outline lama project ini jika ada
  await prisma.researchOutlineItem.deleteMany({ where: { projectId } });

  // Simpan ke DB
  const created = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const dependsOn = DEPENDENCY_MAP[item.itemId] || item.dependsOn || [];
    const isLocked = dependsOn.length > 0;

    const record = await prisma.researchOutlineItem.create({
      data: {
        projectId,
        itemId: item.itemId,
        title: item.title || "Sub-bab",
        bab: item.bab || parseInt(item.itemId?.[0]) || 1,
        depth: item.depth || 2,
        order: item.order || i,
        status: "EMPTY",
        researchTask: item.researchTask || null,
        evidence: [],
        userNotes: null,
        isLocked,
        dependsOn,
      },
    });
    created.push(record);
  }

  // Update TOC snapshot in ProjectMemory
  await updateTocSnapshot(projectId, created.map((c) => ({
    itemId: c.itemId,
    title: c.title,
    bab: c.bab,
    depth: c.depth,
  }))).catch(() => { });

  return { itemsCreated: created.length, items: created };
}

/**
 * 1.b Generate Blueprint untuk SATU item / sub-bab spesifik (Per-subbab generator)
 */
export async function generateItemBlueprint({ projectId, userId, itemId }) {
  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId },
  });
  if (!project) throw new Error("Project tidak ditemukan");

  const item = await prisma.researchOutlineItem.findFirst({
    where: { projectId, itemId },
  });
  if (!item) throw new Error(`Sub-bab ${itemId} tidak ditemukan`);

  const memoryContext = await buildMemoryContext(projectId).catch(() => "");
  
  // Ambil resep modeling dari database (atau fallback ke default)
  const dbGuides = await getAllSubchapterGuides();
  const activeGuides = dbGuides || SUBCHAPTER_MODELING_GUIDES;
  const directGuide = activeGuides[item.itemId];
  const parentCode = item.itemId.split(".").slice(0, 2).join(".");
  const parentGuide = activeGuides[parentCode] || activeGuides["2.1"];
  const guideToUse = directGuide || {
    name: item.title,
    steps: [
      `Kaji konsep fundamental, definisi teoretis, dan ruang lingkup mengenai "${item.title}" dalam konteks "${project.title}".`,
      `Jelaskan karakteristik, dimensi indikator, atau mekanisme teknis dari "${item.title}".`,
      `Bahas temuan empiris atau implementasi dari penelitian terdahulu yang berfokus pada "${item.title}".`,
      `Tautkan hasil analisis "${item.title}" ini ke dalam penyelesaian masalah utama skripsi.`,
    ],
  };

  const defaultBlueprint = buildDefaultBlueprint(project.title, project.approachType || "QUANTITATIVE");
  const canonicalItem = defaultBlueprint.find((b) => b.itemId === item.itemId);
  const fallbackTask = canonicalItem?.researchTask || {
    what: `Kaji secara mendalam mengenai "${item.title}" yang terikat pada topik skripsi "${project.title}"`,
    why: `Memberikan fondasi ilmiah dan kejelasan metodologis untuk aspek "${item.title}"`,
    how: `Kumpulkan literatur jurnal ilmiah terindeks 5 tahun terakhir dan rujukan teoretis terpercaya`,
    bulletInstructions: guideToUse.steps.map((s, idx) => ({
      step: s.replace(/\{TOPIC\}/g, project.title),
      searchQuery: `${project.title} ${item.title} penelitian jurnal`,
    })),
    searchQueries: [`${project.title} ${item.title}`, `${item.title} empirical study`],
    targetEvidence: 3,
    evidenceType: ["jurnal terindeks", "buku akademik"],
  };

  const prompt = `Anda adalah Research Blueprint Architect Ahli (Zetera AI).
Tugas: Rancang instruksi riset & researchTask yang SANGAT KONKRET, MENDALAM, MUDAH DIPAHAMI, dan TERIKAT 100% KETAT KE TOPIK SKRIPSI untuk sub-bab ${item.itemId} (${item.title}):
- Judul Skripsi: "${project.title}"
- Program Studi: "${project.prodi || "Informatika"}"
- Metodologi: "${project.approachType || "QUANTITATIVE"}"
- Fokus Sub-bab: "${item.title}" (Tingkat Depth: ${item.depth || 2})

PEDOMAN STRUKTUR ACUAN DASAR:
${JSON.stringify(guideToUse.steps, null, 2)}

${memoryContext ? memoryContext + "\n" : ""}

ATURAN WAJIB (STRICT TOPIC BOUND - CERDAS & SPESIFIK):
1. Sambungkan kata-kata instruksi secara dinamis dan natural ke topik: "${project.title}" dan fokus sub-bab: "${item.title}".
2. Sebutkan nama konsep, variabel, algoritma, atau objek riset secara nyata di setiap butir instruksi.
3. Hasilkan 3-8 butir instruksi langkah demi langkah konkret ("bulletInstructions") beserta rekomendasi kata kunci pencarian jurnal ("searchQuery") yang sangat presisi dan relevan (prioritas jurnal 5 tahun terakhir).

Output HANYA JSON:
{
  "what": "Instruksi ringkas apa yang harus dikaji pada sub-bab ini (sebutkan variabel/objek spesifik)",
  "why": "Alasan urgensi sub-bab ini dalam konteks topik skripsi",
  "how": "Langkah konkret mencari bukti empiris & data rujukan",
  "bulletInstructions": [
    {
      "step": "Instruksi konkret langkah 1 terkait topik dan sub-bab...",
      "searchQuery": "keyword pencarian jurnal 1"
    },
    {
      "step": "Instruksi konkret langkah 2 terkait topik dan sub-bab...",
      "searchQuery": "keyword pencarian jurnal 2"
    }
  ],
  "searchQueries": ["query 1 spesifik", "query 2 spesifik"],
  "targetEvidence": 3,
  "evidenceType": ["jurnal terindeks", "buku teks"]
}`;

  try {
    const res = await executeAiCompletion({
      featureCode: "OUTLINE_BLUEPRINT",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      maxTokens: 1200,
      jsonMode: true,
      userId,
    });

    const parsed = parseJsonFromText(res.content || "");
    if (parsed && parsed.what && Array.isArray(parsed.bulletInstructions) && parsed.bulletInstructions.length > 0) {
      const updated = await prisma.researchOutlineItem.update({
        where: { id: item.id },
        data: { researchTask: parsed },
      });
      return updated;
    }
  } catch (err) {
    console.warn("Item AI generation failed, using intelligent fallback:", err.message);
  }

  // Fallback cerdas terikat topik
  const updated = await prisma.researchOutlineItem.update({
    where: { id: item.id },
    data: { researchTask: fallbackTask },
  });
  return updated;
}

/**
 * 1.c Get Pool Journals untuk Outline Item — membaca dari Single Pool Terpusat
 * Menghindari pencarian berulang dan memanfaatkan tiering serta relevanceScore
 */
export async function getPoolJournalsForItem(projectId, userId, itemId) {
  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId },
    include: {
      journals: {
        where: {
          status: { in: ["APPROVED", "CANDIDATE", "UNDER_REVIEW"] },
          tier: { not: "EXCLUDED" },
        },
        orderBy: [
          { tier: "asc" },          // PRIMARY first
          { relevanceScore: "desc" }, // Highest score first
        ],
      },
    },
  });

  if (!project) throw new Error("Project tidak ditemukan");

  const item = await prisma.researchOutlineItem.findFirst({
    where: { projectId, itemId },
  });

  const attachedEvidenceIds = new Set(
    (Array.isArray(item?.evidence) ? item.evidence : []).map((e) => e.doi || e.id)
  );

  return project.journals.map((j) => {
    const isAttached = attachedEvidenceIds.has(j.doi) || attachedEvidenceIds.has(j.id);
    return {
      id: j.id,
      title: j.title,
      authors: j.authors,
      year: j.year,
      publication: j.publication,
      doi: j.doi,
      url: j.url,
      abstract: j.abstract,
      relevanceScore: j.relevanceScore || 0,
      tier: j.tier,
      verifiedAt: j.verifiedAt,
      pdfStoragePath: j.pdfStoragePath || j.filePath,
      status: j.status,
      isAttached,
    };
  });
}


/**
 * 2. Get Outline — ambil semua outline items project ini
 */
export async function getOutline(projectId, userId) {
  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId },
  });
  if (!project) throw new Error("Project tidak ditemukan");

  const items = await prisma.researchOutlineItem.findMany({
    where: { projectId },
    orderBy: [{ bab: "asc" }, { order: "asc" }],
  });

  return {
    project: {
      id: project.id,
      title: project.title,
      approachType: project.approachType,
      citationStyle: project.citationStyle,
    },
    items,
  };
}

/**
 * 3. Update item status + user notes
 */
export async function updateOutlineItem(projectId, userId, itemId, { status, userNotes }) {
  const project = await prisma.researchProject.findFirst({ where: { id: projectId, userId } });
  if (!project) throw new Error("Project tidak ditemukan");

  const item = await prisma.researchOutlineItem.findFirst({ where: { projectId, itemId } });
  if (!item) throw new Error("Outline item tidak ditemukan");

  const updated = await prisma.researchOutlineItem.update({
    where: { id: item.id },
    data: {
      ...(status !== undefined && { status }),
      ...(userNotes !== undefined && { userNotes }),
    },
  });

  // Auto-unlock dependencies setelah item ini COMPLETED
  if (status === "COMPLETED") {
    await checkAndUnlockDependents(projectId, itemId);
  }

  return updated;
}

/**
 * 4. Add Evidence ke outline item
 */
export async function addEvidenceToItem(projectId, userId, itemId, evidenceData) {
  const project = await prisma.researchProject.findFirst({ where: { id: projectId, userId } });
  if (!project) throw new Error("Project tidak ditemukan");

  const item = await prisma.researchOutlineItem.findFirst({ where: { projectId, itemId } });
  if (!item) throw new Error("Outline item tidak ditemukan");

  const existingEvidence = Array.isArray(item.evidence) ? item.evidence : [];
  const newEvidence = {
    id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: evidenceData.title || "Judul tidak tersedia",
    authors: evidenceData.authors || "",
    year: evidenceData.year || null,
    doi: evidenceData.doi || null,
    url: evidenceData.url || null,
    abstract: evidenceData.abstract || null,
    addedAt: new Date().toISOString(),
    sourceType: evidenceData.sourceType || "MANUAL", // MANUAL | OPENALEX | SEMANTIC_SCHOLAR
    pageNumber: evidenceData.pageNumber || evidenceData.page || null,
    quote: evidenceData.quote || null,
    journalId: evidenceData.journalId || null,
  };

  const updatedEvidence = [...existingEvidence, newEvidence];
  const task = item.researchTask || {};
  const targetEvidence = task.targetEvidence || 3;

  // Auto-update status
  let newStatus = item.status;
  if (updatedEvidence.length === 0) newStatus = "EMPTY";
  else if (updatedEvidence.length < targetEvidence) newStatus = "IN_PROGRESS";
  else newStatus = "COMPLETED";

  const updated = await prisma.researchOutlineItem.update({
    where: { id: item.id },
    data: {
      evidence: updatedEvidence,
      status: newStatus,
    },
  });

  if (newStatus === "COMPLETED") {
    await checkAndUnlockDependents(projectId, itemId);
  }

  // Sync citation map ke ProjectMemory
  await updateCitationMap(projectId, itemId, updatedEvidence.map((e) => ({
    journalId: e.id,
    doi: e.doi,
    title: e.title,
    page: e.page || 1,
  }))).catch(() => { });

  return { item: updated, evidenceAdded: newEvidence };
}

/**
 * 5. Remove evidence dari item
 */
export async function removeEvidenceFromItem(projectId, userId, itemId, evidenceId) {
  const project = await prisma.researchProject.findFirst({ where: { id: projectId, userId } });
  if (!project) throw new Error("Project tidak ditemukan");

  const item = await prisma.researchOutlineItem.findFirst({ where: { projectId, itemId } });
  if (!item) throw new Error("Outline item tidak ditemukan");

  const existingEvidence = Array.isArray(item.evidence) ? item.evidence : [];
  const updatedEvidence = existingEvidence.filter((ev) => ev.id !== evidenceId);

  const task = item.researchTask || {};
  const targetEvidence = task.targetEvidence || 3;
  let newStatus = item.status;
  if (updatedEvidence.length === 0) newStatus = "EMPTY";
  else if (updatedEvidence.length < targetEvidence) newStatus = "IN_PROGRESS";
  else newStatus = "COMPLETED";

  const updated = await prisma.researchOutlineItem.update({
    where: { id: item.id },
    data: { evidence: updatedEvidence, status: newStatus },
  });

  // Sync citation map ke ProjectMemory
  await updateCitationMap(projectId, itemId, updatedEvidence.map((e) => ({
    journalId: e.id,
    doi: e.doi,
    title: e.title,
    page: e.page || 1,
  }))).catch(() => { });

  return updated;
}

import { getMaiarouterChatCompletion } from "./maiarouter.service.js";

/**
 * Fallback cerdas: Sintesis pencarian literatur akademis menggunakan xAI Grok Fast-Reasoning
 */
async function searchPapersWithAiFallback(query, limit = 6) {
  const currentYear = new Date().getFullYear(); // e.g. 2026
  const minYear = currentYear - 5;

  const prompt = `Anda adalah Mesin Pencari Literatur Akademis & Knowledge Engine Riset Tingkat Lanjut (xAI Grok Fast-Reasoning).
Pengguna sedang mencari referensi jurnal ilmiah terkait topik: "${query}".

Tugas Anda:
Sintesis dan rekomendasikan ${limit} artikel jurnal ilmiah nyata / telaah empiris yang relevan, bermutu, dan kredibel mengenai "${query}".

KRITERIA WAKTU TERBITAN (SANGAT PENTING):
1. WAJIB publikasi mutakhir 5 tahun terakhir (rentang tahun ${minYear} - ${currentYear}), SANGAT DIUTAMAKAN 2-4 tahun terakhir (tahun ${currentYear - 4}, ${currentYear - 3}, ${currentYear - 2}, ${currentYear - 1}, ${currentYear}).
2. JANGAN menghasilkan jurnal usang sebelum tahun ${minYear}.
3. PENTING: Jangan membuat nomor DOI fiktif/palsu. Jika Anda tidak 100% yakin dengan nomor DOI aslinya, isi field "doi": null.

FORMAT WAJIB JSON MURNI:
{
  "papers": [
    {
      "id": "xai-paper-1",
      "title": "Judul Artikel Ilmiah Terkait ${query} (Spesifik dan Bernas)",
      "authors": "Nama Penulis 1, Nama Penulis 2",
      "year": ${currentYear - 2},
      "publication": "Nama Jurnal Ilmiah Terakreditasi (misal: Jurnal Ilmiah Kesehatan / JTIK / Jurnal Sistem Informasi)",
      "venue": "Nama Jurnal Ilmiah Terakreditasi",
      "doi": null,
      "url": "https://scholar.google.com/scholar?q=${encodeURIComponent(query)}",
      "abstract": "Ringkasan komprehensif latar belakang masalah, metodologi (kualitatif/kuantitatif), dan temuan empiris artikel...",
      "sourceType": "AI_SYNTHESIS"
    }
  ]
}`;

  try {
    const res = await getMaiarouterChatCompletion({
      model: "xai/grok-4-1-fast-reasoning",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      jsonMode: true,
      maxTokens: 2500,
    });

    const contentText = res.choices?.[0]?.message?.content;
    if (contentText) {
      const parsed = parseJsonFromText(contentText);
      if (Array.isArray(parsed.papers) && parsed.papers.length > 0) {
        return parsed.papers.map((p, idx) => {
          const paperTitle = p.title || `Studi Empiris ${query}`;
          const safeScholarUrl = `https://scholar.google.com/scholar?q=${encodeURIComponent(paperTitle)}`;
          return {
            id: p.id || `xai-${Date.now()}-${idx}`,
            title: paperTitle,
            authors: p.authors || "Peneliti Akademik",
            year: p.year || (currentYear - 1),
            publication: p.publication || p.venue || "Jurnal Ilmiah Nasional Terakreditasi",
            venue: p.venue || p.publication || "Jurnal Ilmiah",
            doi: p.doi && p.doi.startsWith("10.") ? p.doi : null,
            url: p.url && !p.url.includes("undefined") ? p.url : safeScholarUrl,
            abstract: p.abstract || `Telaah literatur dan analisis empiris komprehensif mengenai ${query}.`,
            sourceType: "AI_SYNTHESIS",
          };
        });
      }
    }
  } catch (err) {
    console.warn("[outline.service] xAI fallback failed, trying Groq fallback:", err.message);
  }

  // Fallback ke Groq jika Maiarouter / xAI gagal
  try {
    const groq = getGroqClient();
    if (groq) {
      const groqRes = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.3-70b-versatile",
        temperature: 0.2,
        response_format: { type: "json_object" },
      });
      const parsed = parseJsonFromText(groqRes.choices[0]?.message?.content || "");
      if (Array.isArray(parsed.papers) && parsed.papers.length > 0) {
        return parsed.papers.map((p, idx) => ({
          id: p.id || `ai-${Date.now()}-${idx}`,
          title: p.title,
          authors: p.authors || "Peneliti Akademik",
          year: p.year || (currentYear - 1),
          publication: p.publication || "Jurnal Ilmiah Nasional Terakreditasi",
          venue: p.venue || "Jurnal Ilmiah",
          doi: p.doi || null,
          url: p.url || (p.doi ? `https://doi.org/${p.doi}` : null),
          abstract: p.abstract || `Analisis empiris mengenai ${query}`,
          sourceType: "AI_SYNTHESIS",
        }));
      }
    }
  } catch (gErr) {
    console.warn("[outline.service] Groq fallback failed:", gErr.message);
  }

  return [];
}

/**
 * Kamus Terjemahan & Normalisasi Kata Kunci Riset (Indonesia -> English Academic Keywords)
 */
const ACADEMIC_ID_EN_MAP = [
  { id: /pengalaman\s+pengguna/gi, en: "user experience UX" },
  { id: /kesehatan\s+mental/gi, en: "mental health psychological" },
  { id: /pendamping/gi, en: "companion assistant" },
  { id: /kecerdasan\s+buatan/gi, en: "artificial intelligence AI" },
  { id: /pembelajaran\s+mesin/gi, en: "machine learning" },
  { id: /pemrosesan\s+bahasa\s+alami/gi, en: "natural language processing NLP" },
  { id: /analisis\s+sentimen/gi, en: "sentiment analysis" },
  { id: /kepuasan\s+pelanggan|kepuasan\s+pengguna/gi, en: "user satisfaction" },
  { id: /kualitas\s+layanan/gi, en: "service quality" },
  { id: /keputusan\s+pembelian/gi, en: "purchase decision" },
  { id: /keamanan\s+siber|keamanan\s+informasi/gi, en: "cybersecurity information security" },
  { id: /sistem\s+informasi/gi, en: "information system" },
  { id: /rekayasa\s+perangkat\s+lunak/gi, en: "software engineering" },
  { id: /jaringan\s+komputer/gi, en: "computer network" },
  { id: /komputasi\s+awan/gi, en: "cloud computing" },
  { id: /tinjauan\s+literatur|studi\s+literatur/gi, en: "literature review systematic review" },
  { id: /metode\s+penelitian/gi, en: "research methodology" },
  { id: /studi\s+kasus/gi, en: "case study" },
  { id: /pengaruh/gi, en: "impact effect" },
  { id: /penerapan|implementasi/gi, en: "implementation adoption" },
  { id: /efektivitas/gi, en: "effectiveness" },
];

/**
 * Normalisasi dan ekspansi query pencarian jurnal
 */
function expandAcademicSearchQuery(rawQuery) {
  if (!rawQuery) return { idQuery: "", enQuery: "" };

  // Bersihkan teks instruksi/noise
  let cleaned = rawQuery
    .replace(/^poin\s*\d+[:\s]*/gi, "")
    .replace(/^(bab|sub-bab|latar belakang|rumusan masalah|tujuan|definisi|jelaskan|uraikan)[:\s]*/gi, "")
    .replace(/["“”'’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  let enQuery = cleaned;
  for (const item of ACADEMIC_ID_EN_MAP) {
    enQuery = enQuery.replace(item.id, item.en);
  }

  // Bersihkan karakter khusus untuk API search
  const sanitize = (str) =>
    str
      .replace(/[^a-zA-Z0-9\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  return {
    idQuery: sanitize(cleaned),
    enQuery: sanitize(enQuery),
  };
}

/**
 * Validasi ketat format DOI resmi (misal: 10.1007/s41233-021-00046-5)
 */
function isValidDoiFormat(doi) {
  if (!doi || typeof doi !== "string") return false;
  const clean = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").trim();
  return /^10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+$/i.test(clean);
}

/**
 * 6. Search paper untuk outline item — Multi-Source (OpenAlex + Crossref) dengan Strict DOI Verification
 * Memfilter jurnal terkini 5 tahun terakhir (NOW - 5 s/d NOW) dengan fallback query cerdas
 */
export async function searchPapersForItem(query, limit = 8) {
  if (!query?.trim()) return [];

  const currentYear = new Date().getFullYear();
  const fromYear = currentYear - 5; // e.g. 2021 untuk 2026
  const { idQuery, enQuery } = expandAcademicSearchQuery(query);
  const primarySearchQuery = enQuery.length >= 4 ? enQuery : idQuery;

  const results = [];
  const seenDois = new Set();
  const seenTitles = new Set();

  const addPaper = (paper) => {
    if (!paper || !paper.title) return;
    const normTitle = paper.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 45);
    const cleanDoi = paper.doi ? paper.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").trim() : null;

    if (cleanDoi && seenDois.has(cleanDoi.toLowerCase())) return;
    if (seenTitles.has(normTitle)) return;

    if (cleanDoi) seenDois.add(cleanDoi.toLowerCase());
    seenTitles.add(normTitle);

    results.push({
      ...paper,
      doi: cleanDoi,
      url: cleanDoi ? `https://doi.org/${cleanDoi}` : paper.url || null,
      isDoiVerified: isValidDoiFormat(cleanDoi),
    });
  };

  // ── Source 1: OpenAlex Works API (Filter 5 Tahun Terakhir) ──
  try {
    const oaUrl = `https://api.openalex.org/works?search=${encodeURIComponent(primarySearchQuery)}&filter=from_publication_date:${fromYear}-01-01&per-page=${limit}&select=id,title,authorships,publication_year,doi,open_access,abstract_inverted_index,primary_location,host_venue&sort=publication_year:desc,cited_by_count:desc`;
    const res = await fetch(oaUrl, {
      headers: { "User-Agent": "Zetera Research Platform (mailto:admin@zetera.id)" },
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const data = await res.json();
      (data.results || []).forEach((work) => {
        const venue =
          work.primary_location?.source?.display_name ||
          work.host_venue?.display_name ||
          work.primary_location?.raw_source_name ||
          (work.doi ? "Jurnal Ilmiah Terindeks" : "Publikasi Akademik");

        addPaper({
          id: work.id,
          title: work.title || "Judul tidak tersedia",
          authors: (work.authorships || [])
            .slice(0, 3)
            .map((a) => a.author?.display_name || "")
            .filter(Boolean)
            .join(", ") || "Tim Peneliti",
          year: work.publication_year || currentYear,
          publication: venue,
          venue: venue,
          doi: work.doi || null,
          url: work.doi || work.id || null,
          abstract: reconstructAbstract(work.abstract_inverted_index),
          sourceType: "OPENALEX",
        });
      });
    }
  } catch (err) {
    console.warn(`[searchPapersForItem] OpenAlex error:`, err.message);
  }

  // ── Source 2: Crossref API (Official Worldwide DOI Registry) ──
  if (results.length < limit) {
    try {
      const crUrl = `https://api.crossref.org/works?query=${encodeURIComponent(primarySearchQuery)}&rows=${limit}&filter=from-pub-date:${fromYear}`;
      const res = await fetch(crUrl, {
        headers: { "User-Agent": "Zetera Research Platform (mailto:admin@zetera.id)" },
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        const data = await res.json();
        const items = data.message?.items || [];
        items.forEach((item) => {
          const rawTitle = Array.isArray(item.title) ? item.title[0] : item.title;
          const rawYear =
            item.issued?.["date-parts"]?.[0]?.[0] ||
            item.created?.["date-parts"]?.[0]?.[0] ||
            item["published-print"]?.["date-parts"]?.[0]?.[0] ||
            currentYear;
          const rawVenue = Array.isArray(item["container-title"]) ? item["container-title"][0] : item["container-title"];
          const venue = rawVenue || "Jurnal Ilmiah Internasional";

          const authors = (item.author || [])
            .slice(0, 3)
            .map((a) => `${a.given || ""} ${a.family || ""}`.trim())
            .filter(Boolean)
            .join(", ") || "Peneliti Akademik";

          if (item.DOI && isValidDoiFormat(item.DOI)) {
            addPaper({
              id: `cr-${item.DOI}`,
              title: rawTitle || "Studi Empiris Terindeks",
              authors,
              year: Number(rawYear) || currentYear,
              publication: venue,
              venue: venue,
              doi: item.DOI,
              url: `https://doi.org/${item.DOI}`,
              abstract: item.abstract ? item.abstract.replace(/<[^>]+>/g, "").slice(0, 500) : null,
              sourceType: "CROSSREF",
            });
          }
        });
      }
    } catch (err) {
      console.warn(`[searchPapersForItem] Crossref error:`, err.message);
    }
  }

  // ── Fallback 3: Broaden Search jika hasil masih kosong ──
  if (results.length === 0 && (idQuery !== primarySearchQuery || enQuery.split(" ").length > 3)) {
    try {
      const broadQuery = enQuery.split(" ").slice(0, 3).join(" ") || idQuery;
      const crBroadUrl = `https://api.crossref.org/works?query=${encodeURIComponent(broadQuery)}&rows=${limit}`;
      const res = await fetch(crBroadUrl, {
        headers: { "User-Agent": "Zetera Research Platform (mailto:admin@zetera.id)" },
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const data = await res.json();
        const items = data.message?.items || [];
        items.forEach((item) => {
          const rawTitle = Array.isArray(item.title) ? item.title[0] : item.title;
          const rawYear = item.issued?.["date-parts"]?.[0]?.[0] || currentYear;
          const venue = (Array.isArray(item["container-title"]) ? item["container-title"][0] : item["container-title"]) || "Jurnal Ilmiah Terindeks";
          const authors = (item.author || []).slice(0, 3).map((a) => `${a.given || ""} ${a.family || ""}`.trim()).filter(Boolean).join(", ") || "Peneliti";

          if (item.DOI && isValidDoiFormat(item.DOI)) {
            addPaper({
              id: `cr-broad-${item.DOI}`,
              title: rawTitle,
              authors,
              year: Number(rawYear) || currentYear,
              publication: venue,
              venue: venue,
              doi: item.DOI,
              url: `https://doi.org/${item.DOI}`,
              abstract: item.abstract ? item.abstract.replace(/<[^>]+>/g, "").slice(0, 500) : null,
              sourceType: "CROSSREF",
            });
          }
        });
      }
    } catch (err) {
      console.warn(`[searchPapersForItem] Fallback broad search error:`, err.message);
    }
  }

  // Urutkan: Jurnal dengan DOI valid & tahun terbaru berada di atas
  return results
    .sort((a, b) => {
      if (a.isDoiVerified && !b.isDoiVerified) return -1;
      if (!a.isDoiVerified && b.isDoiVerified) return 1;
      return (b.year || 0) - (a.year || 0);
    })
    .slice(0, limit);
}


// ── Helper: unlock dependents ─────────────────────────────
async function checkAndUnlockDependents(projectId, completedItemId) {
  const allItems = await prisma.researchOutlineItem.findMany({
    where: { projectId },
  });

  for (const item of allItems) {
    if (!item.isLocked) continue;
    const deps = Array.isArray(item.dependsOn) ? item.dependsOn : [];
    if (!deps.includes(completedItemId)) continue;

    // Cek apakah semua dependency item sudah COMPLETED
    const allDepsCompleted = await Promise.all(
      deps.map(async (depId) => {
        // Handle partial match: "1.1" bisa berarti semua child item "1.1.x" harus completed
        const depItems = allItems.filter(
          (i) => i.itemId === depId || i.itemId.startsWith(depId + ".")
        );
        if (depItems.length === 0) return true;
        return depItems.every((i) => i.status === "COMPLETED");
      })
    );

    if (allDepsCompleted.every(Boolean)) {
      await prisma.researchOutlineItem.update({
        where: { id: item.id },
        data: { isLocked: false },
      });
    }
  }
}

// ── Helper: reconstruct abstract dari inverted index OpenAlex ──
function reconstructAbstract(invertedIndex) {
  if (!invertedIndex || typeof invertedIndex !== "object") return null;
  const words = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words[pos] = word;
    }
  }
  return words.filter(Boolean).join(" ").slice(0, 600);
}

// ── Fallback Blueprint jika AI gagal ──────────────────────
// ── Fallback Blueprint jika AI gagal (Canonical Indonesian Thesis Standard) ──
function buildDefaultBlueprint(title, approachType) {
  const isQual = approachType === "QUALITATIVE";
  const cleanTitle = title || "Topik Penelitian Skripsi";

  const bab1 = [
    {
      itemId: "1.1",
      title: "Latar Belakang",
      bab: 1,
      depth: 2,
      order: 1,
      isLocked: false,
      dependsOn: [],
      researchTask: {
        what: `Bangun argumen piramida terbalik dari umum ke spesifik dan identifikasi celah penelitian (research gap) pada topik "${cleanTitle}"`,
        why: "Membentuk pondasi urgensi riset, data tren fenomena, dan justifikasi metodologi yang kokoh",
        how: "Kumpulkan data statistik resmi, laporan tren industri, dan artikel jurnal terindeks 5 tahun terakhir",
        bulletInstructions: [
          {
            step: `Definisikan konsep/variabel utama topik "${cleanTitle}" dari sumber akademik/resmi terindeks.`,
            searchQuery: `${cleanTitle} definisi konsep fundamental`,
          },
          {
            step: `Jelaskan fenomena/kondisi terkini terkait topik (data, tren, statistik, urgensi permasalahan di lapangan).`,
            searchQuery: `${cleanTitle} fenomena tren data statistik urgensi`,
          },
          {
            step: `Jelaskan dampak/pentingnya isu ini bila tidak diteliti/ditangani secara ilmiah.`,
            searchQuery: `${cleanTitle} dampak tantangan implikasi`,
          },
          {
            step: `Jelaskan konteks objek penelitian (platform, lokasi, atau populasi yang relevan dengan topik).`,
            searchQuery: `${cleanTitle} konteks platform objek studi`,
          },
          {
            step: `Jelaskan metode/pendekatan yang dipakai dan alasan relevansinya untuk topik ini.`,
            searchQuery: `${cleanTitle} metode pendekatan justifikasi`,
          },
          {
            step: `Ulas singkat 2–4 penelitian terdahulu sejenis beserta temuannya.`,
            searchQuery: `"${cleanTitle}" empirical research prior studies`,
          },
          {
            step: `Identifikasi research gap dari penelitian terdahulu tersebut.`,
            searchQuery: `${cleanTitle} research gap novelty`,
          },
          {
            step: `Tutup dengan kalimat pengarah ke fokus penelitian (jembatan ke Rumusan Masalah).`,
            searchQuery: `${cleanTitle} fokus penelitian arah riset`,
          },
        ],
        searchQueries: [cleanTitle, `${cleanTitle} research gap`, `${cleanTitle} state of the art`],
        targetEvidence: 4,
        evidenceType: ["jurnal terindeks", "laporan resmi", "data statistik"],
      },
    },
    {
      itemId: "1.2",
      title: "Identifikasi Masalah",
      bab: 1,
      depth: 2,
      order: 2,
      isLocked: false,
      dependsOn: ["1.1"],
      researchTask: {
        what: `Memetakan semua masalah potensial yang muncul sebelum dipersempit`,
        why: "Memberikan inventarisasi masalah yang komprehensif dari berbagai sudut pandang",
        how: "Pisahkan masalah dari sisi objek/pengguna, metode/algoritma, dan ketersediaan data",
        bulletInstructions: [
          {
            step: `Daftar masalah yang muncul dari isu di Latar Belakang (poin bernomor).`,
            searchQuery: `${cleanTitle} identifikasi masalah lapangan`,
          },
          {
            step: `Pisahkan masalah dari sisi objek penelitian, metode yang digunakan, dan karakteristik data.`,
            searchQuery: `${cleanTitle} masalah objek metode data`,
          },
          {
            step: `Pastikan tiap poin masalah bisa dipetakan ke minimal satu Rumusan Masalah.`,
            searchQuery: `${cleanTitle} pemetaan masalah solusi`,
          },
        ],
        searchQueries: [],
        targetEvidence: 0,
        evidenceType: [],
      },
    },
    {
      itemId: "1.3",
      title: "Rumusan Masalah",
      bab: 1,
      depth: 2,
      order: 3,
      isLocked: false,
      dependsOn: ["1.2"],
      researchTask: {
        what: `Mempersempit masalah menjadi pertanyaan penelitian eksplisit yang terjawab lewat penelitian ini`,
        why: "Menjadi panduan utama arah pengumpulan dan analisis data",
        how: "Tulis dalam kalimat tanya operasional yang selaras 1:1 dengan Tujuan Penelitian",
        bulletInstructions: [
          {
            step: `Tulis dalam kalimat tanya yang jelas ("Bagaimana...", "Apakah...", "Sejauh mana...").`,
            searchQuery: `${cleanTitle} rumusan masalah pertanyaan penelitian`,
          },
          {
            step: `Pastikan jumlah rumusan masalah selaras 1:1 dengan Tujuan Penelitian.`,
            searchQuery: `${cleanTitle} tujuan rumusan keselarasan`,
          },
          {
            step: `Pastikan tiap rumusan masalah dapat dijawab secara empiris dengan metode di BAB III.`,
            searchQuery: `${cleanTitle} ketercapaian metodologi`,
          },
        ],
        searchQueries: [],
        targetEvidence: 0,
        evidenceType: [],
      },
    },
    {
      itemId: "1.4",
      title: "Batasan Masalah",
      bab: 1,
      depth: 2,
      order: 4,
      isLocked: false,
      dependsOn: ["1.3"],
      researchTask: {
        what: `Mempersempit ruang lingkup agar penelitian feasible, fokus, dan mendalam`,
        why: "Menghindari pelebaran topik di luar kemampuan teknis dan jangka waktu riset",
        how: "Batasi dari sisi rentang data/sampel, variabel/aspek yang diteliti, dan tools yang dipakai",
        bulletInstructions: [
          {
            step: `Batasi dari sisi data (rentang waktu observasi, jumlah sampel/dataset, sumber data).`,
            searchQuery: `${cleanTitle} batasan data periode sampel`,
          },
          {
            step: `Batasi dari sisi variabel atau dimensi yang diteliti (fokus utama riset).`,
            searchQuery: `${cleanTitle} batasan variabel fokus`,
          },
          {
            step: `Batasi dari sisi metode, algoritma, framework, atau tools perangkat lunak yang dipakai.`,
            searchQuery: `${cleanTitle} batasan teknis software tools`,
          },
        ],
        searchQueries: [],
        targetEvidence: 0,
        evidenceType: [],
      },
    },
    {
      itemId: "1.5",
      title: "Tujuan Penelitian",
      bab: 1,
      depth: 2,
      order: 5,
      isLocked: false,
      dependsOn: ["1.3"],
      researchTask: {
        what: `Menyatakan hasil akhir dan capaian konkret yang mau diperoleh dari penelitian`,
        why: "Menjawab rumusan masalah dan menjadi tolok ukur penarikan kesimpulan akhir",
        how: "Gunakan kalimat pernyataan deklaratif ('Untuk mengetahui...', 'Untuk menganalisis...')",
        bulletInstructions: [
          {
            step: `Tulis satu tujuan untuk tiap Rumusan Masalah dalam kalimat pernyataan deklaratif ("Untuk mengetahui...", "Untuk menganalisis...", "Untuk merancang...").`,
            searchQuery: `${cleanTitle} tujuan penelitian target capaian`,
          },
          {
            step: `Pastikan tujuan bersifat terukur (measurable) dan konsisten dengan Batasan Masalah.`,
            searchQuery: `${cleanTitle} keterukuran evaluasi tujuan`,
          },
        ],
        searchQueries: [],
        targetEvidence: 0,
        evidenceType: [],
      },
    },
    {
      itemId: "1.6",
      title: "Manfaat Penelitian",
      bab: 1,
      depth: 2,
      order: 6,
      isLocked: false,
      dependsOn: ["1.5"],
      researchTask: {
        what: `Uraikan kontribusi teoretis dan aplikatif bagi dunia keilmuan maupun praktisi`,
        why: "Menunjukkan nilai tambah (value added) dan signifikansi hasil penelitian",
        how: "Bagi ke dalam Manfaat Teoretis/Akademis dan Manfaat Praktis/Aplikatif",
        bulletInstructions: [
          {
            step: `Manfaat Teoritis: jelaskan kontribusi nyata bagi khazanah ilmu pengetahuan dan pengembangan bidang studi.`,
            searchQuery: `${cleanTitle} manfaat teoritis kontribusi ilmiah`,
          },
          {
            step: `Manfaat Praktis: jelaskan kegunaan langsung bagi objek penelitian, industri, institusi, atau masyarakat.`,
            searchQuery: `${cleanTitle} manfaat praktis stakeholder`,
          },
        ],
        searchQueries: [],
        targetEvidence: 0,
        evidenceType: [],
      },
    },
    {
      itemId: "1.7",
      title: "Sistematika Penulisan",
      bab: 1,
      depth: 2,
      order: 7,
      isLocked: false,
      dependsOn: ["1.6"],
      researchTask: {
        what: `Ringkasan alur struktur bab per bab yang tersaji dalam dokumen ini`,
        why: "Memberikan roadmap penulisan yang runtut bagi dosen penguji dan pembaca",
        how: "Tuliskan 1–2 kalimat ringkasan per bab (BAB I sampai BAB III/V)",
        bulletInstructions: [
          {
            step: `Tulis ringkasan isi 1–2 kalimat per BAB (BAB I–III untuk proposal, BAB I–V untuk skripsi penuh).`,
            searchQuery: `${cleanTitle} sistematika penulisan bab`,
          },
        ],
        searchQueries: [],
        targetEvidence: 0,
        evidenceType: [],
      },
    },
  ];

  const bab2 = [
    {
      itemId: "2.1",
      title: "Landasan Teori",
      bab: 2,
      depth: 2,
      order: 8,
      isLocked: false,
      dependsOn: [],
      researchTask: {
        what: `Kaji teori dasar, definisi konsep, model teoretis, dan algoritma/metode yang dipakai pada "${cleanTitle}"`,
        why: "Memberikan fondasi ilmiah dan kerangka konseptual yang kokoh untuk analisis penelitian",
        how: "Bandingkan minimal 2 sumber referensi (buku/jurnal) per konsep, lalu simpulkan definisi kerja operasional",
        bulletInstructions: [
          {
            step: `Definisi konsep dari minimal 2 sumber kredibel (buku/jurnal), bandingkan, lalu simpulkan definisi kerja yang dipakai penelitian ini.`,
            searchQuery: `${cleanTitle} theoretical definition foundation`,
          },
          {
            step: `Uraikan karakteristik, dimensi, atau indikator pembentuk dari konsep/variabel tersebut.`,
            searchQuery: `${cleanTitle} dimensions indicators characteristics`,
          },
          {
            step: `Jika topik memakai metode/algoritma spesifik → jelaskan cara kerjanya secara konseptual dan rujuk sumber aslinya.`,
            searchQuery: `${cleanTitle} algorithm method conceptual framework`,
          },
        ],
        searchQueries: [`${cleanTitle} theoretical framework`, `${cleanTitle} fundamental concepts`],
        targetEvidence: 4,
        evidenceType: ["buku teks", "jurnal fundamental"],
      },
    },
    {
      itemId: "2.2",
      title: "Penelitian Terdahulu",
      bab: 2,
      depth: 2,
      order: 9,
      isLocked: false,
      dependsOn: ["2.1"],
      researchTask: {
        what: `Tabel dan sintesis komparasi penelitian terdahulu yang relevan dengan "${cleanTitle}"`,
        why: "Membuktikan kebaruan (novelty) dan mempertegas posisi riset terhadap khazanah ilmiah terkini",
        how: "Kaji jurnal terindeks 5 tahun terakhir, analisis persamaan dan perbedaan, lalu rumuskan gap penelitian",
        bulletInstructions: [
          {
            step: `Susun tabel/daftar penelitian terdahulu yang mencakup: nama peneliti, tahun, topik riset, metode, dan hasil temuan.`,
            searchQuery: `"${cleanTitle}" empirical research literature`,
          },
          {
            step: `Lakukan analisis mendalam terhadap persamaan dan perbedaan antara penelitian terdahulu dengan penelitian ini.`,
            searchQuery: `${cleanTitle} comparative analysis prior studies`,
          },
          {
            step: `Simpulkan research gap dan kontribusi kebaruan (novelty) penelitian ini secara eksplisit.`,
            searchQuery: `${cleanTitle} research gap novelty contribution`,
          },
        ],
        searchQueries: [`"${cleanTitle}" literature review`, `${cleanTitle} state of the art`],
        targetEvidence: 5,
        evidenceType: ["jurnal internasional", "jurnal nasional terakreditasi"],
      },
    },
    {
      itemId: "2.3",
      title: "Kerangka Berpikir",
      bab: 2,
      depth: 2,
      order: 10,
      isLocked: false,
      dependsOn: ["2.2"],
      researchTask: {
        what: `Visualisasikan alur pemikiran penelitian dari masalah, landasan teori, proses/metode, hingga solusi/output yang diharapkan`,
        why: "Memudahkan pemahaman alur logis riset secara komprehensif dan sistematis",
        how: "Gambarkan diagram alur input-proses-output dan hubungkan ke teori di 2.1 serta gap di 2.2",
        bulletInstructions: [
          {
            step: `Gambarkan alur input (masalah & data) → proses/metode → output yang diharapkan (boleh dalam bentuk diagram).`,
            searchQuery: `${cleanTitle} conceptual framework diagram`,
          },
          {
            step: `Hubungkan tiap elemen kerangka berpikir ke teori di 2.1 dan gap penelitian di 2.2.`,
            searchQuery: `${cleanTitle} kerangka pemikiran hubungan variabel`,
          },
        ],
        searchQueries: [`${cleanTitle} conceptual model`],
        targetEvidence: 1,
        evidenceType: ["diagram model", "jurnal rujukan"],
      },
    },
  ];

  // Tambahkan Hipotesis hanya jika KUANTITATIF
  if (!isQual) {
    bab2.push({
      itemId: "2.4",
      title: "Hipotesis Penelitian",
      bab: 2,
      depth: 2,
      order: 11,
      isLocked: false,
      dependsOn: ["2.3"],
      researchTask: {
        what: `Rumuskan dugaan sementara (H0/H1) mengenai hubungan antarvariabel atau perbandingan performa pada "${cleanTitle}"`,
        why: "Menjadi dasar pengujian statistik inferensial di BAB III dan BAB IV",
        how: "Tulis hipotesis terarah (directional) yang diturunkan dari kerangka berpikir",
        bulletInstructions: [
          {
            step: `Tulis H0 dan H1 secara eksplisit untuk tiap hubungan antarvariabel yang diuji.`,
            searchQuery: `${cleanTitle} hipotesis statistik penelitian kuantitatif`,
          },
          {
            step: `Pastikan hipotesis konsisten dengan Rumusan Masalah dan Kerangka Berpikir di 2.3.`,
            searchQuery: `${cleanTitle} pengujian hipotesis variabel`,
          },
        ],
        searchQueries: [],
        targetEvidence: 0,
        evidenceType: [],
      },
    });
  }

  const bab3 = [
    {
      itemId: "3.1",
      title: "Jenis/Pendekatan Penelitian",
      bab: 3,
      depth: 2,
      order: isQual ? 11 : 12,
      isLocked: false,
      dependsOn: [],
      researchTask: {
        what: `Deklarasikan pendekatan riset (${isQual ? "Kualitatif" : "Kuantitatif"}) dan desain penelitian yang digunakan`,
        why: "Menentukan paradigma epistemologis dan protokol ilmiah yang mengikat seluruh tahapan kerja",
        how: "Sertakan alasan pemilihan metode dan rujuk buku metodologi standar (Sugiyono, Creswell, dsb.)",
        bulletInstructions: [
          {
            step: `Nyatakan pendekatan (${isQual ? "kualitatif" : "kuantitatif"}) dan alasan pemilihannya yang dikaitkan ke Rumusan Masalah.`,
            searchQuery: `${cleanTitle} pendekatan desain penelitian metodologi`,
          },
          {
            step: `Rujuk definisi pendekatan dari sumber metodologi resmi/buku referensi (mis. Sugiyono, Creswell).`,
            searchQuery: `metodologi penelitian ${isQual ? "kualitatif" : "kuantitatif"} creswell sugiyono`,
          },
        ],
        searchQueries: [],
        targetEvidence: 2,
        evidenceType: ["buku metodologi", "jurnal metode"],
      },
    },
    {
      itemId: "3.2",
      title: "Objek/Subjek dan Lokasi Penelitian",
      bab: 3,
      depth: 2,
      order: isQual ? 12 : 13,
      isLocked: false,
      dependsOn: ["3.1"],
      researchTask: {
        what: `Jelaskan entitas objek riset (dataset/sistem/platform) dan subjek/lokasi pengambilan data`,
        why: "Memastikan ruang lingkup spasial dan kontekstual data terdefinisi secara jelas",
        how: "Rinci profil objek, batasan lokasi, dan jadwal waktu penelitian",
        bulletInstructions: [
          {
            step: `Jelaskan objek penelitian (platform/perusahaan/dataset/sistem) dan alasan pemilihannya.`,
            searchQuery: `${cleanTitle} objek penelitian pemilihan dataset`,
          },
          {
            step: `Jelaskan lokasi dan waktu pelaksanaan penelitian bila relevan.`,
            searchQuery: `${cleanTitle} lokasi waktu observasi penelitian`,
          },
        ],
        searchQueries: [],
        targetEvidence: 0,
        evidenceType: [],
      },
    },
    {
      itemId: "3.3",
      title: isQual ? "Subjek Penelitian atau Informan" : "Populasi dan Sampel",
      bab: 3,
      depth: 2,
      order: isQual ? 13 : 14,
      isLocked: false,
      dependsOn: ["3.2"],
      researchTask: {
        what: isQual ? "Menentukan kriteria informan kunci dan teknik penetapan subjek wawancara" : "Menentukan populasi target, teknik sampling, dan ukuran sampel representatif",
        why: "Menjamin keterwakilan (representativeness) data atau kekayaan informasi (data richness)",
        how: isQual ? "Gunakan purposive / snowball sampling dengan kriteria inklusi & eksklusi" : "Gunakan rumus Slovin / teknik probability/non-probability sampling",
        bulletInstructions: isQual
          ? [
              {
                step: `Tentukan kriteria inklusi dan eksklusi informan/subjek penelitian yang kompeten.`,
                searchQuery: `${cleanTitle} kriteria informan kualitatif`,
              },
              {
                step: `Jelaskan teknik penentuan informan (mis. purposive sampling atau snowball sampling) beserta justifikasinya.`,
                searchQuery: `${cleanTitle} teknik purposive sampling informan`,
              },
            ]
          : [
              {
                step: `Definisikan populasi target penelitian secara spesifik.`,
                searchQuery: `${cleanTitle} populasi penelitian kuantitatif`,
              },
              {
                step: `Jelaskan teknik sampling yang digunakan beserta rumus perhitungan ukuran sampel (mis. Slovin/Krejcie).`,
                searchQuery: `${cleanTitle} teknik sampling rumus ukuran sampel`,
              },
            ],
        searchQueries: [],
        targetEvidence: 0,
        evidenceType: [],
      },
    },
    {
      itemId: "3.4",
      title: "Teknik Pengumpulan Data",
      bab: 3,
      depth: 2,
      order: isQual ? 14 : 15,
      isLocked: false,
      dependsOn: ["3.3"],
      researchTask: {
        what: `Rinci prosedur pengumpulan data baik primer maupun sekunder`,
        why: "Memastikan data yang diperoleh valid, reliabel, dan sesuai kaidah etika riset",
        how: "Uraikan langkah operasional wawancara, kuesioner, scraping API, atau studi dokumentasi",
        bulletInstructions: [
          {
            step: `Jelaskan sumber data yang digunakan (data primer dan/atau data sekunder).`,
            searchQuery: `${cleanTitle} sumber data primer sekunder`,
          },
          {
            step: `Jelaskan metode pengumpulan data (${isQual ? "wawancara mendalam, observasi, FGD, studi dokumen" : "kuesioner, pengukuran sistem, API scraping, eksperimen"}) beserta prosedurnya.`,
            searchQuery: `${cleanTitle} metode pengumpulan data protokol`,
          },
        ],
        searchQueries: [],
        targetEvidence: 0,
        evidenceType: [],
      },
    },
    {
      itemId: "3.5",
      title: "Instrumen Penelitian",
      bab: 3,
      depth: 2,
      order: isQual ? 15 : 16,
      isLocked: false,
      dependsOn: ["3.4"],
      researchTask: {
        what: `Dokumentasikan alat ukur, pedoman pengumpulan data, dan perangkat lunak yang dipakai`,
        why: "Menjamin objektivitas dan replikabilitas pengumpulan data penelitian",
        how: "Sertakan kisi-kisi instrumen, spesifikasi software/hardware, atau pedoman wawancara",
        bulletInstructions: isQual
          ? [
              {
                step: `Jelaskan instrumen penelitian (pedoman wawancara, panduan observasi, field notes, dan peneliti sebagai human instrument).`,
                searchQuery: `${cleanTitle} pedoman wawancara instrumen kualitatif`,
              },
              {
                step: `Sebutkan software bantu pengolahan data kualitatif (mis. NVivo, ATLAS.ti) atau perangkat perekam.`,
                searchQuery: `${cleanTitle} tools software analisis kualitatif`,
              },
            ]
          : [
              {
                step: `Jelaskan alat/instrumen yang dipakai (lembar kuesioner berskala Likert, software logging, sensor, dsb.).`,
                searchQuery: `${cleanTitle} instrumen kuesioner skala pengukuran`,
              },
              {
                step: `Sertakan tabel kisi-kisi instrumen (variabel, indikator, nomor butir pertanyaan/item).`,
                searchQuery: `${cleanTitle} kisi-kisi instrumen variabel`,
              },
            ],
        searchQueries: [],
        targetEvidence: 0,
        evidenceType: [],
      },
    },
  ];

  // 3.6 Definisi Operasional Variabel (HANYA KUANTITATIF)
  if (!isQual) {
    bab3.push({
      itemId: "3.6",
      title: "Definisi Operasional Variabel",
      bab: 3,
      depth: 2,
      order: 17,
      isLocked: false,
      dependsOn: ["3.5"],
      researchTask: {
        what: `Tentukan definisi operasional, indikator terukur, dan skala pengukuran untuk tiap variabel riset`,
        why: "Menghubungkan konsep teoretis ke nilai kuantitatif yang dapat diuji secara empiris",
        how: "Susun tabel definisi operasional mencakup Variabel, Definisi, Indikator, dan Skala (Nominal/Ordinal/Interval/Rasio)",
        bulletInstructions: [
          {
            step: `Untuk tiap variabel penelitian: rumuskan definisi operasional yang jelas, indikator empiris, dan skala pengukurannya (Likert, Rasio, Interval, dsb.).`,
            searchQuery: `${cleanTitle} tabel definisi operasional variabel indikator`,
          },
        ],
        searchQueries: [],
        targetEvidence: 0,
        evidenceType: [],
      },
    });
  }

  // 3.7 / 3.6 Teknik Analisis Data
  bab3.push({
    itemId: isQual ? "3.6" : "3.7",
    title: "Teknik Analisis Data",
    bab: 3,
    depth: 2,
    order: isQual ? 16 : 18,
    isLocked: false,
    dependsOn: [isQual ? "3.5" : "3.6"],
    researchTask: {
      what: isQual ? "Uraikan tahapan analisis kualitatif (reduksi data, penyajian data, dan penarikan kesimpulan)" : "Uraikan tahapan analisis statistik deskriptif dan inferensial serta evaluasi performa model",
      why: "Menjelaskan mekanisme transformasi data mentah menjadi temuan ilmiah yang valid",
      how: isQual ? "Gunakan kerangka Miles & Huberman atau Analisis Tematik Braun & Clarke" : "Gunakan uji hipotesis (t-test/ANOVA/regresi/SEM) atau metrik evaluasi (akurasi/F1-score)",
      bulletInstructions: isQual
        ? [
            {
              step: `Jelaskan tahapan analisis berurutan (mis. model interaktif Miles & Huberman: reduksi data → penyajian data → penarikan kesimpulan/verifikasi).`,
              searchQuery: `${cleanTitle} teknik analisis data miles huberman tematik`,
            },
            {
              step: `Jelaskan proses pengkodean (coding) awal, kategorisasi tema, dan sintesis makna temuan.`,
              searchQuery: `${cleanTitle} tahapan coding analisis kualitatif`,
            },
          ]
        : [
            {
              step: `Jelaskan tahapan analisis berurutan (preprocessing data → analisis deskriptif → uji asumsi klasik → pengujian hipotesis).`,
              searchQuery: `${cleanTitle} tahapan analisis statistik kuantitatif`,
            },
            {
              step: `Jelaskan uji statistik atau algoritma komputasi yang dipakai beserta alasan pemilihannya.`,
              searchQuery: `${cleanTitle} uji statistik regresi sem model`,
            },
          ],
      searchQueries: [],
      targetEvidence: 0,
      evidenceType: [],
    },
  });

  // 3.8 / 3.7 Uji Validitas & Reliabilitas / Keabsahan Data
  bab3.push({
    itemId: isQual ? "3.7" : "3.8",
    title: isQual ? "Uji Keabsahan Data" : "Uji Validitas dan Reliabilitas",
    bab: 3,
    depth: 2,
    order: isQual ? 17 : 19,
    isLocked: false,
    dependsOn: [isQual ? "3.6" : "3.7"],
    researchTask: {
      what: isQual ? "Penerapan teknik triangulasi dan member checking untuk menjamin derajat kepercayaan (trustworthiness)" : "Pengujian validitas butir instrumen (Pearson/CFA) dan reliabilitas (Cronbach's Alpha/CR)",
      why: "Menjamin temuan riset tidak bias dan memenuhi standar integritas ilmiah",
      how: isQual ? "Triangulasi sumber, teknik, dan waktu" : "Uji r-hitung vs r-tabel dan threshold Cronbach's Alpha > 0.70",
      bulletInstructions: isQual
        ? [
            {
              step: `Jelaskan teknik triangulasi yang digunakan (triangulasi sumber, triangulasi teknik pengumpulan, triangulasi waktu).`,
              searchQuery: `${cleanTitle} uji keabsahan data triangulasi kualitatif`,
            },
            {
              step: `Jelaskan prosedur member checking atau perpanjangan pengamatan untuk menjamin kredibilitas data.`,
              searchQuery: `${cleanTitle} member checking kredibilitas data kualitatif`,
            },
          ]
        : [
            {
              step: `Jelaskan uji validitas instrumen (validitas isi, validitas konstruk, rumus korelasi Product Moment / CFA).`,
              searchQuery: `${cleanTitle} uji validitas instrumen pearson cfa`,
            },
            {
              step: `Jelaskan uji reliabilitas instrumen (rumus Cronbach's Alpha / Composite Reliability) beserta nilai batas kriteria minimum.`,
              searchQuery: `${cleanTitle} uji reliabilitas cronbach alpha`,
            },
          ],
      searchQueries: [],
      targetEvidence: 0,
      evidenceType: [],
    },
  });

  return [...bab1, ...bab2, ...bab3];
}
