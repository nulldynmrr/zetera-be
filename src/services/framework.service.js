import { prisma } from "../lib/prisma.js";
import { Groq } from "groq-sdk";
import { GROQ_MODELS, parseJsonFromText } from "../lib/groq-config.js";
import { getSecret } from "./config.service.js";
import { executeAiCompletion } from "./ai-router.service.js";

async function getGroqNodeClient() {
  const apiKey =
    (await getSecret("GROQ_API_KEY_FRAMEWORK_GENARATE_NODE")) ||
    (await getSecret("GROQ_API_KEY_FRAMEWORK_RELASI")) ||
    (await getSecret("GROQ_API_KEY_FRAMEWORK_CROSS_CHECK_JURNAL")) ||
    (await getSecret("GROQ_API_KEY"));

  if (!apiKey) return null;
  return new Groq({ apiKey });
}

// Helper: Calculate Academic Tree Hierarchy Positions (Flexible DAG + Collision Avoidance)
export function calculateAcademicTreePositions(rawNodes, rawEdges = []) {
  if (!Array.isArray(rawNodes) || rawNodes.length === 0) return rawNodes;

  const NODE_WIDTH = 320;
  const HORIZONTAL_PITCH = 520; // 520px horizontal pitch (200px clear gap between cards)

  // Group nodes by academic category / role
  const roots = []; // Level 0: Concept / Problem / Background
  const varXs = []; // Level 1: Independent Variables / Interventions
  const varYs = []; // Level 1 (Right): Dependent Variables / Outcomes
  const mediators = []; // Level 1 (Center) / Level 2: Mediators / Theories
  const methods = []; // Level 2 (Left): Methodology / Regression / Survey
  const gaps = []; // Level 2 (Right): Research Gaps / Novelty
  const others = [];

  for (const n of rawNodes) {
    const type = normalizeNodeType(n.type);
    const label = (n.label || "").toLowerCase();

    if (type === "CONCEPT" || type === "PROBLEM" || label.includes("masalah") || label.includes("urgensi") || label.includes("latar belakang") || label.includes("isu") || label.includes("transformasi")) {
      roots.push(n);
    } else if (type === "METHOD" || label.includes("metode") || label.includes("analisis") || label.includes("regresi") || label.includes("kuesioner") || label.includes("kualitatif")) {
      methods.push(n);
    } else if (type === "GAP" || label.includes("gap") || label.includes("limitasi") || label.includes("ruang riset") || label.includes("kebaruan")) {
      gaps.push(n);
    } else if (type === "VARIABLE" || type === "THEORY") {
      if (label.includes("(x") || label.includes("independen") || label.includes("faktor x") || label.includes("bebas") || label.includes("pemanfaatan") || label.includes("pengaruh") || label.includes("adopsi")) {
        varXs.push(n);
      } else if (label.includes("(y") || label.includes("dependen") || label.includes("faktor y") || label.includes("terikat") || label.includes("motivasi") || label.includes("capaian") || label.includes("hasil") || label.includes("perkembangan")) {
        varYs.push(n);
      } else if (label.includes("(z") || label.includes("(m") || label.includes("mediasi") || label.includes("intervening") || label.includes("teori")) {
        mediators.push(n);
      } else {
        if (varXs.length <= varYs.length) {
          varXs.push(n);
        } else {
          varYs.push(n);
        }
      }
    } else {
      others.push(n);
    }
  }

  const CENTER_X = 600;

  // ── 1. LEVEL 0: ROOT / CONCEPT / PROBLEM (Puncak Pohon, Y: 60) ──
  if (roots.length === 1) {
    roots[0].positionX = CENTER_X - NODE_WIDTH / 2;
    roots[0].positionY = 60;
  } else if (roots.length > 1) {
    const totalW = (roots.length - 1) * HORIZONTAL_PITCH;
    const startX = CENTER_X - totalW / 2 - NODE_WIDTH / 2;
    roots.forEach((n, idx) => {
      n.positionX = startX + idx * HORIZONTAL_PITCH;
      n.positionY = 60;
    });
  }

  // ── 2. LEVEL 1: CORE VARIABLES (Tengah: Variabel X di Kiri, Mediator di Tengah, Variabel Y di Kanan, Y: 680) ──
  const varLevelNodes = [...varXs, ...mediators, ...varYs];
  if (varLevelNodes.length === 1) {
    varLevelNodes[0].positionX = CENTER_X - NODE_WIDTH / 2;
    varLevelNodes[0].positionY = 680;
  } else if (varLevelNodes.length > 1) {
    if (varXs.length === 1 && varYs.length === 1 && mediators.length === 0) {
      varXs[0].positionX = CENTER_X - HORIZONTAL_PITCH / 2 - NODE_WIDTH / 2;
      varXs[0].positionY = 680;

      varYs[0].positionX = CENTER_X + HORIZONTAL_PITCH / 2 - NODE_WIDTH / 2;
      varYs[0].positionY = 680;
    } else {
      const totalW = (varLevelNodes.length - 1) * HORIZONTAL_PITCH;
      const startX = CENTER_X - totalW / 2 - NODE_WIDTH / 2;
      varLevelNodes.forEach((n, idx) => {
        n.positionX = startX + idx * HORIZONTAL_PITCH;
        n.positionY = 680;
      });
    }
  }

  // ── 3. LEVEL 2: METODOLOGI & RESEARCH GAP (Bawah: Metode di Kiri, Gap di Kanan, Y: 1360) ──
  const bottomLevelNodes = [...methods, ...gaps];
  if (bottomLevelNodes.length === 1) {
    bottomLevelNodes[0].positionX = CENTER_X - NODE_WIDTH / 2;
    bottomLevelNodes[0].positionY = 1360;
  } else if (bottomLevelNodes.length > 1) {
    if (methods.length === 1 && gaps.length === 1) {
      methods[0].positionX = CENTER_X - HORIZONTAL_PITCH / 2 - NODE_WIDTH / 2;
      methods[0].positionY = 1360;

      gaps[0].positionX = CENTER_X + HORIZONTAL_PITCH / 2 - NODE_WIDTH / 2;
      gaps[0].positionY = 1360;
    } else {
      const totalW = (bottomLevelNodes.length - 1) * HORIZONTAL_PITCH;
      const startX = CENTER_X - totalW / 2 - NODE_WIDTH / 2;
      bottomLevelNodes.forEach((n, idx) => {
        n.positionX = startX + idx * HORIZONTAL_PITCH;
        n.positionY = 1360;
      });
    }
  }

  // ── 4. LEVEL 3: OTHER NODES (Y: 2040) ──
  if (others.length > 0) {
    const totalW = (others.length - 1) * HORIZONTAL_PITCH;
    const startX = CENTER_X - totalW / 2 - NODE_WIDTH / 2;
    others.forEach((n, idx) => {
      n.positionX = startX + idx * HORIZONTAL_PITCH;
      n.positionY = 2040;
    });
  }

  // ── 5. FULL COLLISION DETECTION & FORCE RELAXATION ──
  const allPositioned = [...roots, ...varLevelNodes, ...bottomLevelNodes, ...others];

  for (let pass = 0; pass < 10; pass++) {
    for (let i = 0; i < allPositioned.length; i++) {
      for (let j = i + 1; j < allPositioned.length; j++) {
        const a = allPositioned[i];
        const b = allPositioned[j];

        const dx = Math.abs(a.positionX - b.positionX);
        const dy = Math.abs(a.positionY - b.positionY);

        // If nodes overlap within bounding box
        if (dx < 480 && dy < 540) {
          if (dx < 480) {
            if (b.positionX >= a.positionX) {
              b.positionX = a.positionX + HORIZONTAL_PITCH;
            } else {
              a.positionX = b.positionX + HORIZONTAL_PITCH;
            }
          }
        }
      }
    }
  }

  return rawNodes;
}

// Get Project Framework (Nodes + Edges)
export async function getProjectFramework(projectId, userId) {
  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId },
    include: {
      frameworkNodes: {
        include: {
          sourceEdges: true,
          targetEdges: true,
          nodeMappings: {
            include: {
              journal: {
                select: { id: true, title: true, authors: true, year: true, doi: true },
              },
            },
          },
        },
      },
      frameworkEdges: true,
    },
  });

  if (!project) {
    const err = new Error("Project riset tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  return {
    project: {
      id: project.id,
      title: project.title,
      field: project.field,
      status: project.status,
    },
    nodes: project.frameworkNodes,
    edges: project.frameworkEdges,
  };
}

// Create Framework Node
export async function createFrameworkNode(projectId, userId, { label, type, description, positionX, positionY }) {
  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId },
  });

  if (!project) {
    const err = new Error("Project tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  return prisma.frameworkNode.create({
    data: {
      projectId,
      label,
      type: type || "VARIABLE",
      description: description || null,
      positionX: positionX ? parseFloat(positionX) : 100,
      positionY: positionY ? parseFloat(positionY) : 100,
    },
  });
}

// Update Framework Node
export async function updateFrameworkNode(nodeId, userId, updateData) {
  const node = await prisma.frameworkNode.findUnique({
    where: { id: nodeId },
    include: { project: true },
  });

  if (!node || node.project.userId !== userId) {
    const err = new Error("Node tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  const data = {};
  if (updateData.label !== undefined) data.label = updateData.label;
  if (updateData.type !== undefined) data.type = updateData.type;
  if (updateData.description !== undefined) data.description = updateData.description;
  if (updateData.status !== undefined) data.status = updateData.status;
  if (updateData.positionX !== undefined) data.positionX = parseFloat(updateData.positionX);
  if (updateData.positionY !== undefined) data.positionY = parseFloat(updateData.positionY);
  if (updateData.methodCoverage !== undefined) data.methodCoverage = updateData.methodCoverage;

  return prisma.frameworkNode.update({
    where: { id: nodeId },
    data,
  });
}

// Delete Framework Node
export async function deleteFrameworkNode(nodeId, userId) {
  const node = await prisma.frameworkNode.findUnique({
    where: { id: nodeId },
    include: { project: true },
  });

  if (!node || node.project.userId !== userId) {
    const err = new Error("Node tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  return prisma.frameworkNode.delete({
    where: { id: nodeId },
  });
}

// Create Framework Edge
export async function createFrameworkEdge(projectId, userId, { sourceNodeId, targetNodeId, relationshipLabel }) {
  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId },
  });

  if (!project) {
    const err = new Error("Project tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  return prisma.frameworkEdge.create({
    data: {
      projectId,
      sourceNodeId,
      targetNodeId,
      relationshipLabel: relationshipLabel || "Mempengaruhi",
    },
  });
}

// Delete Framework Edge
export async function deleteFrameworkEdge(edgeId, userId) {
  const edge = await prisma.frameworkEdge.findUnique({
    where: { id: edgeId },
    include: { project: true },
  });

  if (!edge || edge.project.userId !== userId) {
    const err = new Error("Koneksi edge tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  return prisma.frameworkEdge.delete({
    where: { id: edgeId },
  });
}

// Batch Sync Nodes positions
export async function batchSyncPositions(projectId, userId, nodes) {
  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId },
  });

  if (!project) {
    const err = new Error("Project tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  if (!Array.isArray(nodes) || nodes.length === 0) {
    return { success: true };
  }

  const updates = nodes.map((n) =>
    prisma.frameworkNode.update({
      where: { id: n.id },
      data: {
        positionX: parseFloat(n.positionX) || 0,
        positionY: parseFloat(n.positionY) || 0,
      },
    })
  );

  await prisma.$transaction(updates);
  return { success: true };
}

function normalizeNodeType(type) {
  const t = String(type || "").toUpperCase().trim();
  if (["VARIABLE", "CONCEPT", "METHOD", "THEORY", "GAP"].includes(t)) return t;
  if (t === "PROBLEM" || t === "MASALAH" || t === "ISSUE") return "CONCEPT";
  if (t === "METODE" || t === "TECHNIQUE") return "METHOD";
  if (t === "TEORI") return "THEORY";
  return "VARIABLE";
}

// ─────────────────────────────────────────────────────────────
// AI Smart Auto-Generation of Research Framework from Journals
// Mendukung 2 Mode:
// 1. "SYNTHESIS" (Multi-Jurnal: Sintesis Skripsi X -> Y -> Method -> Gap)
// 2. "SINGLE_JOURNAL" (Anatomi 1 Jurnal: Masalah -> Variabel -> Metode -> Temuan)
// ─────────────────────────────────────────────────────────────
export async function generateFrameworkFromJournals(projectId, userId, { journalId, mode = "SYNTHESIS" } = {}) {
  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId },
    include: {
      journals: true,
      frameworkNodes: true,
    },
  });

  if (!project) {
    const err = new Error("Project tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  const groq = await getGroqNodeClient();
  let aiNodes = [];
  let aiEdges = [];
  let aiSummary = "";

  if (mode === "SINGLE_JOURNAL" && journalId) {
    const journal = project.journals.find((j) => j.id === journalId);
    if (!journal) {
      const err = new Error("Jurnal spesifik tidak ditemukan");
      err.statusCode = 404;
      throw err;
    }

    // Mode "SINGLE_JOURNAL"
    let sectionsSnippet = "";
    if (journal.rawExtraction?.sections && Array.isArray(journal.rawExtraction.sections)) {
      sectionsSnippet = journal.rawExtraction.sections
        .filter((s) => s.content && s.content.trim().length > 30)
        .slice(0, 8)
        .map((s) => `  * [Sub-bab: ${s.heading || "Bab"} (Halaman ${s.page || 1})]:\n    "${s.content.replace(/\s+/g, " ").slice(0, 320)}"`)
        .join("\n\n");
    }

    const journalContent = `Judul Artikel: "${journal.title}" (${journal.year || "2024"})\nPenulis: ${journal.authors || "Penulis"}\nAbstrak:\n${journal.abstract ? journal.abstract.slice(0, 500) : journal.keyFindings || "-"}\n\nKUTIPAN SUB-BAB ASLI DOKUMEN JURNAL (DARI DATABASE):\n${sectionsSnippet || (journal.fullText ? journal.fullText.slice(0, 1500) : "-")}`;

    const prompt = `Anda adalah Pakar Metodologi Penelitian & Arsitek Kerangka Berpikir Skripsi Ilmiah.
Tugas Anda: Analisis kutipan teks asli dari artikel jurnal rujukan ini dan bangun Kerangka Berpikir Skripsi yang kaya bukti empiris nyata dengan struktur POHON HIRARKI DARI ATAS KE BAWAH (Top-to-Bottom Tree).

TOPIK SKRIPSI MAHASISWA:
- Judul: "${project.title}"
- Bidang: "${project.field || "Informatika / Ilmu Terkait"}"

TEKS LENGKAP SUB-BAB DOKUMEN JURNAL:
"""
${journalContent}
"""

PANDUAN TATA LETAK POHON (TOP-TO-BOTTOM TREE HIERARCHY):
- Level 1 (Atas / Puncak Masalah): Node CONCEPT (Latar Belakang / Urgensi Masalah) -> Posisi X: 520, Y: 50
- Level 2 Kiri (Tengah Kiri): Node VARIABLE X (Variabel Bebas / Independen) -> Posisi X: 160, Y: 360
- Level 2 Kanan (Tengah Kanan - Sejajar Variabel X): Node VARIABLE Y (Variabel Terikat / Dependen) -> Posisi X: 880, Y: 360
- Level 3 Kiri (Bawah Kiri): Node METHOD (Metodologi, Kuesioner, Uji Regresi) -> Posisi X: 160, Y: 700
- Level 3 Kanan (Bawah Kanan): Node GAP (Research Gap, Limitasi, Ruang Riset Lanjutan) -> Posisi X: 880, Y: 700

ATURAN WAJIB KUTIPAN BUKTI (DARI TEKS JURNAL DI ATAS):
1. "evidenceQuotes": Array berisi 1 SAMPAI 3 KUTIPAN ASLI (VERBATIM KALIMAT LENGKAP tanpa terpotong) dari teks sub-bab jurnal di atas. Format per item: { "quote": "...", "pageNumber": 2, "section": "PENDAHULUAN" }.
2. "evidenceQuote": Kutipan utama yang paling representatif kalimat lengkapnya.
3. "pageNumber": Nomor halaman asli tempat kutipan utama berada.
4. "methodCoverage": Nama sub-bab rujukan (misal: "Hasil & Uji Regresi (Hal. 29)").

OUTPUT WAJIB FORMAT JSON MURNI:
{
  "summary": "Ringkasan intisari sintesis bukti empiris dari artikel jurnal terhadap skripsi...",
  "nodes": [
    {
      "tempId": "n1",
      "label": "Nama Masalah / Urgensi Riset",
      "type": "CONCEPT",
      "description": "Penjelasan latar belakang masalah dari teks pendahuluan jurnal",
      "evidenceQuote": "Salinan kalimat asli lengkap dari teks jurnal yang menjelaskan masalah ini",
      "evidenceQuotes": [
        { "quote": "Salinan kalimat asli lengkap masalah dari pendahuluan", "pageNumber": 2, "section": "PENDAHULUAN" }
      ],
      "pageNumber": 2,
      "methodCoverage": "Latar Belakang & Pendahuluan",
      "positionX": 520,
      "positionY": 50
    },
    {
      "tempId": "n2",
      "label": "Pemanfaatan Platform AI (Variabel X)",
      "type": "VARIABLE",
      "description": "Definisi variabel independen dari hasil penelitian",
      "evidenceQuote": "Salinan kalimat asli lengkap temuan empiris mengenai pengaruh variabel X dari teks jurnal",
      "evidenceQuotes": [
        { "quote": "Salinan kalimat lengkap penggunaan platform AI oleh mahasiswa", "pageNumber": 1, "section": "Abstrak" }
      ],
      "pageNumber": 1,
      "methodCoverage": "Variabel Independen (X)",
      "positionX": 160,
      "positionY": 360
    },
    {
      "tempId": "n3",
      "label": "Motivasi Belajar Mahasiswa (Variabel Y)",
      "type": "VARIABLE",
      "description": "Definisi variabel dependen dampak yang diukur dari hasil analisis",
      "evidenceQuote": "Salinan kalimat asli lengkap hasil pengujian regresi / korelasi efek terhadap variabel Y dari teks jurnal",
      "evidenceQuotes": [
        { "quote": "Salinan kalimat lengkap persamaan regresi dan nilai korelasi", "pageNumber": 29, "section": "HASIL DAN PEMBAHASAN" }
      ],
      "pageNumber": 29,
      "methodCoverage": "Variabel Dependen (Y)",
      "positionX": 880,
      "positionY": 360
    },
    {
      "tempId": "n4",
      "label": "Metode Kuantitatif & Uji Regresi",
      "type": "METHOD",
      "description": "Metode penelitian, instrumen kuesioner, atau analisis statistik yang digunakan",
      "evidenceQuote": "Salinan kalimat asli lengkap metodologi penelitian dari teks jurnal",
      "evidenceQuotes": [
        { "quote": "Salinan kalimat lengkap metode penelitian dan teknik sampel", "pageNumber": 7, "section": "METODE PENELITIAN" }
      ],
      "pageNumber": 7,
      "methodCoverage": "Metodologi Penelitian",
      "positionX": 160,
      "positionY": 700
    },
    {
      "tempId": "n5",
      "label": "Research Gap: Limitasi & Efek Lanjutan",
      "type": "GAP",
      "description": "Ruang riset lanjutan atau batasan yang dijawab oleh skripsi ini",
      "evidenceQuote": "Salinan kalimat asli lengkap keterbatasan penelitian atau saran penelitian lanjutan",
      "evidenceQuotes": [
        { "quote": "Salinan kalimat lengkap saran dan batasan penelitian", "pageNumber": 32, "section": "PENUTUP / SARAN" }
      ],
      "pageNumber": 32,
      "methodCoverage": "Research Gap & Limitasi",
      "positionX": 880,
      "positionY": 700
    }
  ],
  "edges": [
    { "sourceTempId": "n1", "targetTempId": "n2", "label": "Mendasari Kebutuhan" },
    { "sourceTempId": "n2", "targetTempId": "n3", "label": "Mempengaruhi Positif (+)" },
    { "sourceTempId": "n4", "targetTempId": "n3", "label": "Diuji Menggunakan Metode" },
    { "sourceTempId": "n3", "targetTempId": "n5", "label": "Mengisi Celah Riset" }
  ]
}
Catatan: Tipe node yang valid HANYA: "VARIABLE", "CONCEPT", "METHOD", "THEORY", "GAP".`;

    try {
      const res = await executeAiCompletion({
        featureCode: "BANGUN_OTOMATIS_AI",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.15,
        jsonMode: true,
        userId: project.userId,
      });
      const parsed = parseJsonFromText(res.content || "");
      aiNodes = parsed.nodes || [];
      aiEdges = parsed.edges || [];
      aiSummary = parsed.summary || "";
    } catch (e) {
      console.warn("Framework generation AI call fallback:", e.message);
    }
  } else {
    // Mode "SYNTHESIS" — Menggabungkan semua jurnal APPROVED & Evidence Research Blueprint
    const outlineItems = await prisma.researchOutlineItem.findMany({
      where: { projectId },
      orderBy: { order: "asc" },
    });

    const targetJournals = [...(project.journals || [])];

    // Gabungkan artikel evidence dari Research Blueprint (Tahap 5)
    outlineItems.forEach((item) => {
      if (Array.isArray(item.evidence)) {
        item.evidence.forEach((ev) => {
          if (ev && ev.title && !targetJournals.some((j) => j.title.toLowerCase() === ev.title.toLowerCase())) {
            targetJournals.push({
              id: ev.id || `ev-${Math.random()}`,
              title: ev.title,
              authors: ev.authors || "Penulis",
              year: ev.year || new Date().getFullYear(),
              doi: ev.doi || "-",
              abstract: ev.abstract || `Bukti rujukan untuk sub-bab ${item.itemId} (${item.title})`,
              keyFindings: ev.abstract?.slice(0, 350) || "",
              status: "APPROVED",
              relevanceScore: 90,
            });
          }
        });
      }
    });

    const journalListText = targetJournals
      .slice(0, 8)
      .map((j, idx) => {
        let secText = "";
        if (j.rawExtraction?.sections && Array.isArray(j.rawExtraction.sections)) {
          secText = j.rawExtraction.sections
            .filter((s) => s.content && s.content.trim().length > 30)
            .slice(0, 6)
            .map((s) => `    * [${s.heading || "Sub-bab"} (Hal. ${s.page || 1})]: "${s.content.replace(/\s+/g, " ").slice(0, 260)}"`)
            .join("\n");
        }
        return `[Jurnal ${idx + 1}] ID:${idx + 1} | Judul: "${j.title}" (${j.year || "2024"})\nPenulis: ${j.authors || "-"}\nAbstrak/Temuan: ${j.abstract ? j.abstract.slice(0, 350) : j.keyFindings || "-"}\nKutipan Sub-bab Asli:\n${secText || (j.fullText ? j.fullText.slice(0, 800) : "-")}`;
      })
      .join("\n\n");

    const prompt = `Anda adalah Pakar Metodologi Penelitian Skripsi & Arsitek Kerangka Berpikir Ilmiah.
Tugas Anda: Analisis judul skripsi dan seluruh bukti empiris nyata dari jurnal rujukan berikut, lalu bangun Peta Kerangka Berpikir Hirarki (Slide Tree Cards) yang komprehensif.

TOPIK SKRIPSI MAHASISWA:
- Judul Skripsi: "${project.title}"
- Bidang Studi: "${project.field || "Informatika / Teknologi"}"

ATURAN WAJIB STRUKTUR NODE KERANGKA (SLIDE CARDS):
1. DEKOMPOSISI JUDUL (PERKATA/KONSEP INTI):
   - Node 1: Domain Masalah / Konsep Utama (misal: "Kesehatan Mental / Domain Isu") dengan penjelasan mendalam latar belakang masalahnya.
   - Node 2: Intervensi / Teknologi yang Dibangun (misal: "Chatbot AI Dukungan Emosional") menjelaskan arsitektur & komponen solusinya.
   - Node 3: Variabel Evaluasi / Capaian (misal: "Pengalaman Pengguna (UX) & Dampak Efektivitas") menjelaskan metrik dan hasil pengukurannya.
2. STATE OF THE ART & KOMPARASI METODE:
   - Node 4: Metode Pembanding Terdahulu vs Usulan Kita (menjelaskan metode apa saja yang pernah dipakai dalam jurnal rujukan sebelumnya vs metode/solusi yang kita bangun dalam skripsi ini).
3. RESEARCH GAP & NOVELTY:
   - Node 5: Gap Riset & Kontribusi Kebaruan (menjelaskan kebaruan penelitian ini dibanding literatur sebelumnya).
4. KUTIPAN BUKTI ASLI:
   - Setiap node WAJIB menyertakan kutipan kalimat asli (verbatim) dari teks jurnal di bawah tanpa diubah.

DATA EKSTRAKSI JURNAL EVIDENCE:
${journalListText}

PANDUAN STRUKTUR POHON ATAS KE BAWAH (TOP-TO-BOTTOM TREE HIERARCHY):
- Level 1 (Atas / Puncak Masalah): Node CONCEPT (Latar Belakang Permasalahan Empiris) -> Posisi X: 520, Y: 50
- Level 2 Kiri (Tengah Kiri): Node VARIABLE X (Faktor Independen / Intervensi AI) -> Posisi X: 160, Y: 360
- Level 2 Kanan (Tengah Kanan - Sejajar Variabel X): Node VARIABLE Y (Variabel Terikat / Capaian) -> Posisi X: 880, Y: 360
- Level 3 Kiri (Bawah Kiri): Node METHOD (Metode Analisis & Pengujian Statistik) -> Posisi X: 160, Y: 700
- Level 3 Kanan (Bawah Kanan): Node GAP (Research Gap, Limitasi & Ruang Riset Lanjutan) -> Posisi X: 880, Y: 700

ATURAN KETAT KUTIPAN BUKTI & HALAMAN:
1. "evidenceQuotes": Array berisi 1 SAMPAI 3 KUTIPAN ASLI (VERBATIM KALIMAT LENGKAP tanpa terpotong) dari teks sub-bab jurnal di atas. Format per item: { "quote": "...", "pageNumber": 2, "section": "PENDAHULUAN" }.
2. "evidenceQuote": Wajib berupa SALINAN KUTIPAN ASLI KALIMAT LENGKAP dari teks sub-bab jurnal di atas yang membuktikan node ini.
3. "pageNumber": Cantumkan nomor halaman asli dari sub-bab tempat kutipan tersebut berada.
4. "sourceJournalIndex": Nomor ID Jurnal sumber rujukan (misal 1, 2, dst).
5. "methodCoverage": Nama sub-bab tempat kutipan ditemukan (misal: "Hasil & Regresi (Hal. 29)", "Metodologi Kuantitatif (Hal. 7)").

OUTPUT WAJIB FORMAT JSON MURNI:
{
  "summary": "Ringkasan sintesis komprehensif kerangka berpikir skripsi dari literatur rujukan...",
  "nodes": [
    {
      "tempId": "n1",
      "label": "Tantangan / Masalah Riset",
      "type": "CONCEPT",
      "description": "Latar belakang permasalahan empiris spesifik dari telaah literatur",
      "evidenceQuote": "Salinan kalimat asli lengkap dari teks jurnal yang menjelaskan masalah ini",
      "evidenceQuotes": [
        { "quote": "Salinan kalimat asli lengkap masalah dari pendahuluan", "pageNumber": 2, "section": "PENDAHULUAN" }
      ],
      "pageNumber": 2,
      "methodCoverage": "Latar Belakang & Pendahuluan",
      "sourceJournalIndex": 1,
      "positionX": 520,
      "positionY": 50
    },
    {
      "tempId": "n2",
      "label": "Penerapan AI / Faktor X",
      "type": "VARIABLE",
      "description": "Definisi operasional variabel bebas yang diambil dari jurnal",
      "evidenceQuote": "Salinan kalimat asli lengkap temuan empiris mengenai pengaruh variabel X dari teks jurnal",
      "evidenceQuotes": [
        { "quote": "Salinan kalimat lengkap temuan empiris faktor X", "pageNumber": 7, "section": "HASIL DAN PEMBAHASAN" }
      ],
      "pageNumber": 7,
      "methodCoverage": "Variabel Independen (X)",
      "sourceJournalIndex": 1,
      "positionX": 160,
      "positionY": 360
    },
    {
      "tempId": "n3",
      "label": "Motivasi / Capaian Y",
      "type": "VARIABLE",
      "description": "Definisi operasional variabel terikat dampak yang diukur",
      "evidenceQuote": "Salinan kalimat asli lengkap bukti empiris pengaruh signifikan terhadap variabel Y dari teks jurnal",
      "evidenceQuotes": [
        { "quote": "Salinan kalimat lengkap bukti pengaruh terhadap variabel Y", "pageNumber": 29, "section": "HASIL DAN PEMBAHASAN" }
      ],
      "pageNumber": 29,
      "methodCoverage": "Hasil & Uji Regresi",
      "sourceJournalIndex": 1,
      "positionX": 880,
      "positionY": 360
    },
    {
      "tempId": "n4",
      "label": "Metode Analisis & Survei",
      "type": "METHOD",
      "description": "Teknik analisis data statistik dan instrumen yang digunakan pada literatur rujukan",
      "evidenceQuote": "Salinan kalimat asli lengkap metodologi penelitian kuantitatif/kualitatif dari teks jurnal",
      "evidenceQuotes": [
        { "quote": "Salinan kalimat lengkap teknik pengujian dan analisis data", "pageNumber": 7, "section": "METODE PENELITIAN" }
      ],
      "pageNumber": 7,
      "methodCoverage": "Metodologi Pengujian",
      "sourceJournalIndex": 1,
      "positionX": 160,
      "positionY": 700
    },
    {
      "tempId": "n5",
      "label": "Gap Riset: Efek Jangka Panjang",
      "type": "GAP",
      "description": "Celah kebaruan riset yang belum diteliti oleh literatur rujukan dan dijawab oleh skripsi ini",
      "evidenceQuote": "Salinan kalimat asli lengkap batasan penelitian atau saran riset lanjutan dari teks jurnal",
      "evidenceQuotes": [
        { "quote": "Salinan kalimat lengkap batasan riset atau saran pengembangan lanjutan", "pageNumber": 32, "section": "PENUTUP" }
      ],
      "pageNumber": 32,
      "methodCoverage": "Research Gap & Kebaruan",
      "sourceJournalIndex": 1,
      "positionX": 880,
      "positionY": 700
    }
  ],
  "edges": [
    { "sourceTempId": "n1", "targetTempId": "n2", "label": "Mendasari Kebutuhan" },
    { "sourceTempId": "n2", "targetTempId": "n3", "label": "Mempengaruhi Positif (+)" },
    { "sourceTempId": "n4", "targetTempId": "n3", "label": "Diuji Menggunakan Metode" },
    { "sourceTempId": "n3", "targetTempId": "n5", "label": "Mengisi Celah Riset" }
  ]
}
Catatan: Tipe node yang valid HANYA: "VARIABLE", "CONCEPT", "METHOD", "THEORY", "GAP". Pastikan label dan kutipan bukti sangat spesifik dan relevan dengan topik "${project.title}".`;

    try {
      const res = await executeAiCompletion({
        featureCode: "BANGUN_OTOMATIS_AI",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.15,
        jsonMode: true,
        userId: project.userId,
      });
      const parsed = parseJsonFromText(res.content || "");
      aiNodes = parsed.nodes || [];
      aiEdges = parsed.edges || [];
      aiSummary = parsed.summary || "";
    } catch (e) {
      console.warn("Synthesis framework generation AI call fallback:", e.message);
    }
  }

  // Fallback jika API gagal atau kosong
  if (!Array.isArray(aiNodes) || aiNodes.length === 0) {
    const mainTitle = project.title || "Penelitian Skripsi";
    aiNodes = [
      {
        tempId: "n1",
        label: `Masalah Empiris: ${mainTitle.slice(0, 30)}`,
        type: "CONCEPT",
        description: `Latar belakang permasalahan empiris dan urgensi riset terkait ${mainTitle}`,
        evidenceQuote: `Ditemukan tantangan empiris pada implementasi topik ${mainTitle}.`,
        pageNumber: 1,
        methodCoverage: "Latar Belakang",
        positionX: 520,
        positionY: 50,
      },
      {
        tempId: "n2",
        label: `Variabel Bebas (X)`,
        type: "VARIABLE",
        description: `Faktor pendorong atau intervensi utama yang diteliti`,
        evidenceQuote: `Pengaruh variabel independen terhadap proses riset.`,
        pageNumber: 1,
        methodCoverage: "Variabel Independen",
        positionX: 160,
        positionY: 360,
      },
      {
        tempId: "n3",
        label: `Variabel Terikat (Y)`,
        type: "VARIABLE",
        description: `Hasil atau dampak yang diukur dalam penelitian`,
        evidenceQuote: `Variabel dependen menunjukkan signifikansi korelasi.`,
        pageNumber: 1,
        methodCoverage: "Variabel Dependen",
        positionX: 880,
        positionY: 360,
      },
      {
        tempId: "n4",
        label: `Metode: Analisis Regresi / Kuantitatif`,
        type: "METHOD",
        description: `Metodologi analisis data dan pengujian hipotesis`,
        evidenceQuote: `Pengujian hipotesis menggunakan analisis inferensial.`,
        pageNumber: 1,
        methodCoverage: "Metode Penelitian",
        positionX: 160,
        positionY: 700,
      },
      {
        tempId: "n5",
        label: `Research Gap & Kebaruan`,
        type: "GAP",
        description: `Celah riset yang dijawab dan dikembangkan oleh skripsi ini`,
        evidenceQuote: `Perlu penelitian lebih lanjut pada domain ini.`,
        pageNumber: 1,
        methodCoverage: "Research Gap",
        positionX: 880,
        positionY: 700,
      },
    ];
    aiEdges = [
      { sourceTempId: "n1", targetTempId: "n2", label: "Mendasari Kebutuhan" },
      { sourceTempId: "n2", targetTempId: "n3", label: "Mempengaruhi Positif (+)" },
      { sourceTempId: "n4", targetTempId: "n3", label: "Diuji Menggunakan Metode" },
      { sourceTempId: "n3", targetTempId: "n5", label: "Mengisi Celah Riset" },
    ];
    aiSummary = `Kerangka berpikir disusun secara otomatis dari sintesis literatur riset ${project.title}.`;
  }

  // Hitung posisi pohon hirarki akademis yang rapi (Top-to-Bottom Tree, anti-tabrakan)
  aiNodes = calculateAcademicTreePositions(aiNodes);

  // Periksa apakah sudah ada node di database sebelumnya (Incremental Smart Merge)
  const existingNodes = await prisma.frameworkNode.findMany({
    where: { projectId },
    include: {
      nodeMappings: true,
      sourceEdges: true,
      targetEdges: true,
    },
  });

  const tempIdToDbId = new Map();
  const createdNodes = [];

  if (existingNodes.length > 0) {
    // ── SMART MERGE MODE (Pertahankan Node Lama & Tambahkan Bukti/Node Baru) ──
    for (const n of aiNodes) {
      const validNodeType = normalizeNodeType(n.type);
      const nLabel = (n.label || "").toLowerCase();

      // Cari kecocokan di node yang sudah ada
      const existingMatch = existingNodes.find((ex) => {
        if (ex.type === validNodeType) {
          const exLabel = (ex.label || "").toLowerCase();
          if (exLabel === nLabel) return true;
          if (ex.type === "CONCEPT" && (nLabel.includes("masalah") || nLabel.includes("urgensi") || nLabel.includes("tantangan") || nLabel.includes("latar"))) return true;
          if (ex.type === "VARIABLE") {
            if ((exLabel.includes("(x") || exLabel.includes("bebas") || exLabel.includes("independen")) && (nLabel.includes("(x") || nLabel.includes("bebas") || nLabel.includes("independen"))) return true;
            if ((exLabel.includes("(y") || exLabel.includes("terikat") || exLabel.includes("dependen") || exLabel.includes("capaian") || exLabel.includes("motivasi")) && (nLabel.includes("(y") || nLabel.includes("terikat") || nLabel.includes("dependen") || nLabel.includes("capaian") || nLabel.includes("motivasi"))) return true;
          }
          if (ex.type === "METHOD" && (nLabel.includes("metode") || nLabel.includes("regresi") || nLabel.includes("analisis") || nLabel.includes("kuantitatif"))) return true;
          if (ex.type === "GAP" && (nLabel.includes("gap") || nLabel.includes("limitasi") || nLabel.includes("kebaruan"))) return true;
        }
        return false;
      });

      let targetDbNodeId;

      if (existingMatch) {
        // Gunakan node yang sudah ada
        targetDbNodeId = existingMatch.id;
        tempIdToDbId.set(n.tempId, targetDbNodeId);
      } else {
        // Buat node baru tambahan
        const created = await prisma.frameworkNode.create({
          data: {
            projectId,
            label: n.label,
            type: validNodeType,
            description: n.description || null,
            methodCoverage: n.methodCoverage || null,
            status: "SUPPORTED",
            positionX: parseFloat(n.positionX) || 100,
            positionY: parseFloat(n.positionY) || 100,
          },
        });
        targetDbNodeId = created.id;
        tempIdToDbId.set(n.tempId, targetDbNodeId);
        createdNodes.push(created);
      }

      // Kumpulkan kutipan baru dari AI
      const jIdx = (n.sourceJournalIndex && n.sourceJournalIndex > 0) ? n.sourceJournalIndex - 1 : 0;
      const targetJournal = (journalId ? project.journals.find((j) => j.id === journalId) : null) || project.journals[jIdx] || project.journals[0];

      if (targetJournal && targetDbNodeId) {
        const quoteList = [];
        if (Array.isArray(n.evidenceQuotes) && n.evidenceQuotes.length > 0) {
          for (const eq of n.evidenceQuotes) {
            if (eq.quote && String(eq.quote).trim().length > 10) {
              quoteList.push({
                quote: String(eq.quote).trim(),
                page: parseInt(eq.pageNumber) > 0 ? parseInt(eq.pageNumber) : (parseInt(n.pageNumber) || 1),
              });
            }
          }
        }

        if (n.evidenceQuote && String(n.evidenceQuote).trim().length > 10) {
          const singleQuote = String(n.evidenceQuote).trim();
          if (!quoteList.some((q) => q.quote === singleQuote)) {
            quoteList.push({
              quote: singleQuote,
              page: parseInt(n.pageNumber) > 0 ? parseInt(n.pageNumber) : 1,
            });
          }
        }

        // Simpan ke JournalNodeMapping tanpa duplikasi
        for (const qItem of quoteList) {
          const existingMapping = await prisma.journalNodeMapping.findFirst({
            where: {
              journalId: targetJournal.id,
              nodeId: targetDbNodeId,
              quote: qItem.quote,
            },
          });

          if (!existingMapping) {
            await prisma.journalNodeMapping.create({
              data: {
                journalId: targetJournal.id,
                nodeId: targetDbNodeId,
                evidenceType: "SUPPORTS",
                quote: qItem.quote,
                sourcePage: qItem.page,
                sourceDoi: targetJournal.doi || null,
                confidence: 0.95,
              },
            });
          }
        }
      }
    }
  } else {
    // ── INITIAL CREATION MODE (Kanvas Masih Kosong) ──
    for (const n of aiNodes) {
      const validNodeType = normalizeNodeType(n.type);
      const created = await prisma.frameworkNode.create({
        data: {
          projectId,
          label: n.label,
          type: validNodeType,
          description: n.description || null,
          methodCoverage: n.methodCoverage || null,
          status: "SUPPORTED",
          positionX: parseFloat(n.positionX) || 100,
          positionY: parseFloat(n.positionY) || 100,
        },
      });
      tempIdToDbId.set(n.tempId, created.id);
      createdNodes.push(created);

      const jIdx = (n.sourceJournalIndex && n.sourceJournalIndex > 0) ? n.sourceJournalIndex - 1 : 0;
      const targetJournal = (journalId ? project.journals.find((j) => j.id === journalId) : null) || project.journals[jIdx] || project.journals[0];

      if (targetJournal) {
        const quoteList = [];
        if (Array.isArray(n.evidenceQuotes) && n.evidenceQuotes.length > 0) {
          for (const eq of n.evidenceQuotes) {
            if (eq.quote && String(eq.quote).trim().length > 10) {
              quoteList.push({
                quote: String(eq.quote).trim(),
                page: parseInt(eq.pageNumber) > 0 ? parseInt(eq.pageNumber) : (parseInt(n.pageNumber) || 1),
              });
            }
          }
        }

        if (n.evidenceQuote && String(n.evidenceQuote).trim().length > 10) {
          const singleQuote = String(n.evidenceQuote).trim();
          if (!quoteList.some((q) => q.quote === singleQuote)) {
            quoteList.push({
              quote: singleQuote,
              page: parseInt(n.pageNumber) > 0 ? parseInt(n.pageNumber) : 1,
            });
          }
        }

        if (quoteList.length === 0) {
          quoteList.push({
            quote: `Bukti empiris artikel "${targetJournal.title}" mendukung variabel ${n.label}.`,
            page: 1,
          });
        }

        for (const qItem of quoteList) {
          await prisma.journalNodeMapping.create({
            data: {
              journalId: targetJournal.id,
              nodeId: created.id,
              evidenceType: "SUPPORTS",
              quote: qItem.quote,
              sourcePage: qItem.page,
              sourceDoi: targetJournal.doi || null,
              confidence: 0.95,
            },
          });
        }
      }
    }
  }

  // Buat relasi edge (jika belum ada relasi antar kedua node tersebut)
  const createdEdges = [];
  for (const e of aiEdges) {
    const sourceId = tempIdToDbId.get(e.sourceTempId);
    const targetId = tempIdToDbId.get(e.targetTempId);

    if (sourceId && targetId && sourceId !== targetId) {
      const existingEdge = await prisma.frameworkEdge.findFirst({
        where: {
          projectId,
          sourceNodeId: sourceId,
          targetNodeId: targetId,
        },
      });

      if (!existingEdge) {
        const createdEdge = await prisma.frameworkEdge.create({
          data: {
            projectId,
            sourceNodeId: sourceId,
            targetNodeId: targetId,
            relationshipLabel: e.label || "Mempengaruhi",
          },
        });
        createdEdges.push(createdEdge);
      }
    }
  }

  // ── SINKRONISASI TATA LETAK POHON AKADEMIS BEBAS TABRAKAN KE SEMUA NODE ──
  const allProjectNodes = await prisma.frameworkNode.findMany({ where: { projectId } });
  const allProjectEdges = await prisma.frameworkEdge.findMany({ where: { projectId } });

  const repositionedNodes = calculateAcademicTreePositions(allProjectNodes, allProjectEdges);

  const positionUpdates = repositionedNodes.map((n) =>
    prisma.frameworkNode.update({
      where: { id: n.id },
      data: {
        positionX: parseFloat(n.positionX) || 100,
        positionY: parseFloat(n.positionY) || 100,
      },
    })
  );
  await prisma.$transaction(positionUpdates);

  // Ambil data node lengkap dengan relasi nodeMappings & journal untuk dikembalikan langsung
  const fullNodes = await prisma.frameworkNode.findMany({
    where: { projectId },
    include: {
      sourceEdges: true,
      targetEdges: true,
      nodeMappings: {
        include: {
          journal: {
            select: { id: true, title: true, authors: true, year: true, doi: true },
          },
        },
      },
    },
  });

  return {
    success: true,
    mode,
    summary: aiSummary,
    totalNodes: fullNodes.length,
    totalEdges: allProjectEdges.length,
    nodes: fullNodes,
    edges: allProjectEdges,
  };
}

/**
 * Generate Draft Paragraf Naskah Skripsi (Bab 1, Bab 2, Bab 3)
 * Berbasis diagram kerangka dan bukti kutipan verbatim nyata dari database.
 */
export async function generateSkripsiDraftNarrative(projectId, userId) {
  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId },
    include: {
      frameworkNodes: {
        include: {
          nodeMappings: {
            include: {
              journal: true,
            },
          },
        },
      },
      frameworkEdges: true,
      journals: {
        where: { status: "APPROVED" },
      },
    },
  });

  if (!project) {
    throw new NotFoundError("Project penelitian tidak ditemukan");
  }

  if (!project.frameworkNodes || project.frameworkNodes.length === 0) {
    throw new BadRequestError("Kanvas kerangka masih kosong. Silakan bangun kerangka berpikir terlebih dahulu.");
  }

  // Ringkas data node dan relasi untuk AI Prompt
  const nodesSummary = project.frameworkNodes.map((n, idx) => {
    const quotes = (n.nodeMappings || []).map((m) => ({
      journal: m.journal?.title,
      author: m.journal?.authors || "Penulis",
      year: m.journal?.year || 2024,
      page: m.sourcePage || 1,
      quote: m.quote,
    }));

    return {
      urutan: idx + 1,
      label: n.label,
      tipe: n.type,
      definisi: n.description || "",
      metode: n.methodCoverage || "",
      buktiKutipan: quotes,
    };
  });

  const edgesSummary = project.frameworkEdges.map((e) => {
    const src = project.frameworkNodes.find((n) => n.id === e.sourceNodeId)?.label || "Node A";
    const tgt = project.frameworkNodes.find((n) => n.id === e.targetNodeId)?.label || "Node B";
    return `${src} ──[ ${e.relationshipLabel || "Mempengaruhi"} ]──> ${tgt}`;
  });

  const prompt = `Anda adalah Dosen Pembimbing Skripsi & Peneliti Akademik Senior Indonesia.
Tugas Anda adalah menyusun DRAF NARASI NASKAH SKRIPSI LENGKAP & FORMAL (Bahasa Indonesia Baku Akademik) berdasarkan Kerangka Berpikir dan Bukti Jurnal Empiris berikut:

JUDUL PENELITIAN: "${project.title}"
BIDANG ILMU: "${project.field || 'Pendidikan / Ilmu Komputer / Sosial'}"

DATA NODE KERANGKA & BUKTI EMPIRIS:
${JSON.stringify(nodesSummary, null, 2)}

HUBUNGAN ANTAR VARIABEL (ALUR KERANGKA):
${edgesSummary.join("\n")}

INSTRUKSI PENULISAN:
1. Susun narasi akademis berkualitas tinggi yang siap disalin oleh mahasiswa ke dokumen skripsi (Microsoft Word).
2. Setiap kali menyebutkan fakta/temuan empiris dari jurnal, WAJIB menyertakan sitasi dalam teks format standar APA: (Nama Belakang Penulis, Tahun, hlm. Nomor Halaman) — contoh: (Nelliraharti, 2024, hlm. 2).
3. Buat narasi mengalir secara logis, ilmiah, dan tidak terkesan seperti template kaku.

OUTPUT WAJIB FORMAT JSON VALID (tanpa markdown pembuka/penutup):
{
  "judul": "${project.title}",
  "bab1LatarBelakang": {
    "judulBagian": "BAB I: Latar Belakang Masalah & Urgensi Penelitian",
    "paragraf": [
      "Paragraf 1: Fenomena umum kemajuan teknologi dan urgensi masalah nyata di lapangan...",
      "Paragraf 2: Fakta empiris yang didukung rujukan jurnal ilmiah dengan sitasi baku...",
      "Paragraf 3: Research gap dan alasan mengapa penelitian ini krusial untuk dilakukan..."
    ]
  },
  "bab2KerangkaPemikiran": {
    "judulBagian": "BAB II: Tinjauan Teoretis & Kerangka Pemikiran",
    "paragraf": [
      "Paragraf 1: Definisi konseptual variabel utama berdasarkan landasan teori...",
      "Paragraf 2: Penjelasan alur keterkaitan dan pengaruh antar variabel (X terhadap Y)...",
      "Paragraf 3: Sintesis kerangka berpikir terpadu yang memayungi penelitian ini..."
    ]
  },
  "bab3HipotesisMetode": {
    "judulBagian": "BAB III: Rumusan Hipotesis & Pendekatan Metodologi",
    "hipotesis": [
      "H1: Terdapat pengaruh positif dan signifikan...",
      "H2: ..."
    ],
    "justifikasiMetode": "Penjelasan mengenai pendekatan kuantitatif/kualitatif, populasi/sampel, serta teknik analisis data yang relevan..."
  },
  "daftarPustakaRujukan": [
    "Format APA 7th edition untuk setiap jurnal yang dirujuk..."
  ]
}`;

  try {
    const res = await executeAiCompletion({
      featureCode: "DRAFT_SKRIPSI",
      messages: [
        {
          role: "system",
          content: "Anda adalah pakar penulisan skripsi akademik. Kembalikan HANYA JSON murni yang valid tanpa awalan atau akhiran teks penjelasan.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.25,
      jsonMode: true,
      userId: project.userId,
    });

    const parsedDraft = parseJsonFromText(res.content || "");
    return {
      success: true,
      data: parsedDraft,
      modelUsed: res.modelUsed,
    };
  } catch (err) {
    console.error("Gagal menyusun draf narasi skripsi:", err);
    throw new Error("Gagal menyusun draf naskah skripsi: " + err.message);
  }
}

