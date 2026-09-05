import prisma from "../lib/prisma.js";

// ─────────────────────────────────────────────────────────────
// Project Memory Service
// Menyimpan & membaca konteks persisten per-project untuk AI Writer.
// Memory SELALU dibaca sebelum generate outline/proposal/chat.
// Disimpan terstruktur (bukan transcript mentah) agar hemat token.
// ─────────────────────────────────────────────────────────────

/**
 * Ambil atau buat record memory untuk sebuah project.
 * Jika belum ada, dibuat kosong (upsert pattern).
 */
export async function getProjectMemory(projectId) {
  return prisma.projectMemory.upsert({
    where: { projectId },
    update: {},
    create: { projectId },
  });
}

/**
 * Update TOC Snapshot — dipanggil setelah user finalisasi Custom BAB
 * atau setelah outline blueprint di-generate.
 * @param {string} projectId
 * @param {Array}  tocItems  — array item outline [{itemId, title, bab, depth}]
 */
export async function updateTocSnapshot(projectId, tocItems) {
  return prisma.projectMemory.upsert({
    where: { projectId },
    update: { tocSnapshot: tocItems },
    create: { projectId, tocSnapshot: tocItems },
  });
}

/**
 * Update Citation Map — dipanggil saat user attach evidence ke outline item.
 * @param {string} projectId
 * @param {string} sectionId  — itemId outline (e.g. "1.1")
 * @param {Array}  citations  — [{journalId, doi, page, title, quote}]
 */
export async function updateCitationMap(projectId, sectionId, citations) {
  const mem = await getProjectMemory(projectId);
  const existing = (mem.citationMap && typeof mem.citationMap === 'object' && !Array.isArray(mem.citationMap)) ? mem.citationMap : {};
  existing[sectionId] = citations;

  return prisma.projectMemory.update({
    where: { projectId },
    data: { citationMap: existing },
  });
}

/**
 * Update Writer Decisions — dipanggil setelah AI menulis atau merevisi section.
 * Simpan ringkasan, bukan transcript mentah.
 * @param {string} projectId
 * @param {Object} decision — { sectionId, action, summary, style }
 */
export async function updateWriterDecisions(projectId, decision) {
  const mem = await getProjectMemory(projectId);
  const existing = Array.isArray(mem.writerDecisions) ? mem.writerDecisions : [];

  // Batasi history ke 20 keputusan terakhir (hemat token)
  const updated = [...existing, { ...decision, ts: new Date().toISOString() }].slice(-20);

  return prisma.projectMemory.update({
    where: { projectId },
    data: { writerDecisions: updated },
  });
}

/**
 * Update Framework Snapshot — dipanggil saat node/edge framework berubah signifikan.
 * Hanya simpan delta terkompresi (label + type + edge count), bukan posisi pixel.
 * @param {string} projectId
 * @param {Array}  nodes — FrameworkNode[]
 * @param {Array}  edges — FrameworkEdge[]
 */
export async function updateFrameworkSnap(projectId, nodes = [], edges = []) {
  const snap = {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodes: nodes.map((n) => ({ id: n.id, label: n.label, type: n.type, status: n.status })),
    edgeSummary: edges.map((e) => `${e.sourceNode?.label || e.sourceNodeId} → ${e.targetNode?.label || e.targetNodeId}`).slice(0, 20),
    snappedAt: new Date().toISOString(),
  };

  return prisma.projectMemory.upsert({
    where: { projectId },
    update: { frameworkSnap: snap },
    create: { projectId, frameworkSnap: snap },
  });
}

/**
 * Update Literature Landscape — menghubungkan jurnal hasil ekstraksi MinerU ke Memory Project
 * @param {string} projectId
 * @param {Object} journalData — data jurnal yang diekstrak
 */
export async function syncJournalToLiteratureLandscape(projectId, journalData) {
  const mem = await getProjectMemory(projectId);
  const existing = Array.isArray(mem.literatureLandscape) ? mem.literatureLandscape : [];

  const entry = {
    id: journalData.id,
    title: journalData.title,
    authors: journalData.authors,
    year: journalData.year,
    doi: journalData.doi,
    method: journalData.extractionMethod || "MINERU_PIPELINE",
    sectionsCount: Array.isArray(journalData.rawExtraction?.sections) ? journalData.rawExtraction.sections.length : 0,
    relevanceScore: journalData.relevanceScore || 0,
    abstractSnippet: (journalData.abstract || "").slice(0, 300),
    syncedAt: new Date().toISOString(),
  };

  const filtered = existing.filter((j) => j.id !== journalData.id);
  const updated = [entry, ...filtered].slice(0, 15); // Simpan 15 jurnal teratas

  return prisma.projectMemory.update({
    where: { projectId },
    data: { literatureLandscape: updated },
  });
}

/**
 * Build Memory Context String untuk inject ke system prompt AI.
 * Output dibatasi ~1500 token agar tidak membengkak biaya.
 * @param {string} projectId
 * @returns {string} konteks terstruktur siap inject ke prompt
 */
export async function buildMemoryContext(projectId) {
  const mem = await getProjectMemory(projectId);
  const parts = [];

  // 1. Literature Landscape & Bukti Kutipan Terverifikasi (Strict Provenance)
  try {
    const verifiedEvidences = await prisma.journalCitationEvidence.findMany({
      where: { projectId, isApproved: true },
      take: 8,
      orderBy: [{ year: "desc" }, { pageNumber: "asc" }],
    });

    if (verifiedEvidences && verifiedEvidences.length > 0) {
      const evLines = verifiedEvidences.map((ev) => {
        const authYear = `${ev.authors ? ev.authors.split(",")[0] : "Penulis"} (${ev.year || "N/A"})`;
        const doiStr = ev.doi ? ` [DOI: ${ev.doi}]` : "";
        const pubStr = ev.journalName ? ` | ${ev.journalName}` : "";
        return `  - [Hal. ${ev.pageNumber}${doiStr}${pubStr}] ${authYear}: "${ev.paraphrasedQuote}" (Kategori: ${ev.citationCategory}) [Relevansi: ${ev.topicRelevance}]`;
      }).join("\n");
      parts.push(`BANK KUTIPAN TERVERIFIKASI (Verified Citations - Hal & DOI Asli):\n${evLines}`);
    } else if (mem.literatureLandscape && Array.isArray(mem.literatureLandscape) && mem.literatureLandscape.length > 0) {
      const paperLines = mem.literatureLandscape
        .slice(0, 5)
        .map((j) => `  - [${j.year || "N/A"}] "${j.title}" (${j.authors || "Penulis"}) [Relevansi: ${j.relevanceScore || 0}%]`)
        .join("\n");
      parts.push(`LITERATURE LANDSCAPE (Jurnal Terekstraksi):\n${paperLines}`);
    }
  } catch (err) {
    console.warn("Gagal memuat verified citation evidences di memory:", err.message);
  }

  // 2. TOC Snapshot
  if (mem.tocSnapshot && Array.isArray(mem.tocSnapshot) && mem.tocSnapshot.length > 0) {
    const tocLines = mem.tocSnapshot
      .slice(0, 30) // max 30 item
      .map((i) => `  ${i.itemId || i.id}. ${i.title || i.label}`)
      .join("\n");
    parts.push(`STRUKTUR BAB (Daftar Isi yang sudah difinalisasi user):\n${tocLines}`);
  }

  // 3. Citation Map (ringkasan per section)
  if (mem.citationMap && typeof mem.citationMap === 'object' && Object.keys(mem.citationMap).length > 0) {
    const citLines = Object.entries(mem.citationMap)
      .slice(0, 15)
      .map(([secId, cits]) => {
        const citArr = Array.isArray(cits) ? cits : [];
        return `  ${secId}: ${citArr.map((c) => c.title || c.doi || c.journalId).slice(0, 3).join(", ")}`;
      })
      .join("\n");
    parts.push(`PETA SITASI (jurnal yang sudah dipakai per section):\n${citLines}`);
  }

  // 4. Framework Snapshot
  if (mem.frameworkSnap && mem.frameworkSnap.nodes) {
    const snap = mem.frameworkSnap;
    const nodeList = (snap.nodes || []).slice(0, 10).map((n) => `${n.label} (${n.type})`).join(", ");
    parts.push(`FRAMEWORK RISET: ${snap.nodeCount} variabel — ${nodeList}`);
    if (snap.edgeSummary?.length > 0) {
      parts.push(`Relasi: ${snap.edgeSummary.slice(0, 5).join(" | ")}`);
    }
  }

  // 5. Writer Decisions (5 terakhir)
  if (mem.writerDecisions && Array.isArray(mem.writerDecisions) && mem.writerDecisions.length > 0) {
    const recent = mem.writerDecisions.slice(-5);
    const decLines = recent.map((d) => `  [${d.sectionId || "?"}] ${d.action || "revisi"}: ${d.summary || ""}`).join("\n");
    parts.push(`KEPUTUSAN AI WRITER SEBELUMNYA:\n${decLines}`);
  }

  if (parts.length === 0) return "";

  return [
    "=== KONTEKS PROJECT (Memory Persisten) ===",
    ...parts,
    "=== AKHIR KONTEKS ===",
  ].join("\n\n");
}
