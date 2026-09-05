import { prisma } from "../lib/prisma.js";
import { Groq } from "groq-sdk";
import { GROQ_MODELS, parseJsonFromText } from "../lib/groq-config.js";
import { getSecret } from "./config.service.js";
import { executeAiCompletion } from "./ai-router.service.js";

async function getGroqClient() {
  const apiKey =
    (await getSecret("GROQ_API_KEY_FRAMEWORK_CROSS_CHECK_JURNAL")) ||
    (await getSecret("GROQ_API_KEY_FRAMEWORK_RELASI")) ||
    (await getSecret("GROQ_API_KEY_FRAMEWORK_GENARATE_NODE")) ||
    (await getSecret("GROQ_API_KEY"));

  if (!apiKey) {
    console.error("Groq API key not found in Database or .env.");
    return null;
  }
  return new Groq({ apiKey });
}

// ── TIER-0: TITLE-ONLY FAST REJECT ──────────────────────────────────────────
// Cek keselarasan topik berdasarkan kata kunci dan analisis semantik AI.
// Mendukung penelitian multidisiplin (misal: Informatika + Kesehatan Mental / Medis / Pendidikan / Bisnis).
export function localDomainCheck(projectTitle, journalTitle, approachConfig = null) {
  const projLow = (projectTitle || "").toLowerCase();
  const jLow = (journalTitle || "").toLowerCase();

  // Bersihkan kata-kata umum (stop words)
  const stopWords = new Set(["dan", "yang", "di", "dari", "ke", "untuk", "pada", "dengan", "dalam", "tentang", "studi", "analisis", "pengaruh", "penerapan", "implementasi", "berbasis", "terhadap"]);
  let combinedKeywords = projLow;
  if (approachConfig) {
    const extra = [approachConfig.variableX, approachConfig.variableY, approachConfig.variableZ, approachConfig.focusIssue]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (extra) combinedKeywords += ` ${extra}`;
  }

  const projWords = combinedKeywords.split(/[^a-zA-Z0-9]+/).filter((w) => w.length > 2 && !stopWords.has(w));
  const jWords = jLow.split(/[^a-zA-Z0-9]+/).filter((w) => w.length > 2 && !stopWords.has(w));

  // Jika ada irisan kata kunci langsung (misal: "kesehatan", "mental", "remaja", "ai", "sistem" atau variabel X/Y), selalu lolos!
  const hasKeywordOverlap = jWords.some((w) => projWords.some((pw) => pw.includes(w) || w.includes(pw)));
  if (hasKeywordOverlap) {
    return null; // Pasti relevan secara tematik, serahkan ke AI Deep Screening
  }

  // Jika tidak ada irisan langsung, jangan tolak lokal sembarangan — biarkan AI menilai konteks interdisiplin
  return null;
}

// ── TIER-0 LAYER B: AI TITLE RELEVANCE CHECK ─────────────────────────────────
export async function titleLevelFastReject(groqClient, projectTitle, _projectField, journalTitle, approachConfig = null, commonNarrative = null) {
  // Cek lokal kata kunci
  const localResult = localDomainCheck(projectTitle, journalTitle, approachConfig);
  if (localResult) {
    return localResult;
  }

  let extraContext = "";
  if (approachConfig?.variableX || approachConfig?.variableY) {
    const vars = [approachConfig.variableX, approachConfig.variableY, approachConfig.variableZ].filter(Boolean).join(", ");
    extraContext += `\n- Variabel Penelitian: ${vars}`;
  } else if (approachConfig?.focusIssue) {
    extraContext += `\n- Fokus Riset / Fenomena: ${approachConfig.focusIssue}`;
  }
  if (commonNarrative?.scope) {
    extraContext += `\n- Batasan Masalah: ${commonNarrative.scope}`;
  }

  try {
    const prompt = `Kamu adalah penelaah literatur ilmiah akademik profesional.
TUGAS: Tentukan apakah judul artikel jurnal ini RELEVAN atau DAPAT DIGUNAKAN sebagai rujukan literatur untuk judul penelitian skripsi.

FOKUS PENELITIAN SKRIPSI:
- Judul / Topik Skripsi: "${projectTitle}"${extraContext}

ARTIKEL JURNAL:
- Judul Artikel: "${journalTitle}"

PRINSIP PENILAIAN AKADEMIK:
1. FOKUS UTAMA: Relevansi dinilai berdasarkan keselarasan tema dengan Judul Skripsi ("${projectTitle}") dan variabel/fokus riset di atas.
2. Jika artikel membahas topik skripsi, variabel penelitian (${approachConfig?.variableX || "X"} / ${approachConfig?.variableY || "Y"}), konteks fenomena (misal: kesehatan mental, remaja, perilaku, teknologi terkait), atau populasi target, berikan penilaian PASS.
3. Berikan VERDICT:REJECTED HANYA JIKA artikel benar-benar 100% tidak ada kaitannya sama sekali dengan tema dan variabel skripsi.

Jawab HANYA dalam format:
VERDICT:PASS - alasan singkat
atau
VERDICT:REJECTED - alasan singkat`;

    const res = await executeAiCompletion({
      featureCode: "JOURNAL_SCREENING",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.0,
      maxTokens: 120,
    });

    const raw = (res.content || "").trim().toUpperCase();

    if (raw.includes("VERDICT:REJECTED") || raw.startsWith("REJECTED")) {
      const reason = res.content?.split("-").slice(1).join("-").trim() || "Topik tidak bersinggungan dengan fokus riset skripsi.";
      return { verdict: "REJECTED", reason };
    }

    return { verdict: "PASS", reason: "Topik selaras dengan tema penelitian skripsi." };
  } catch (err) {
    console.warn("Title-level AI check error, falling back to deep screening:", err.message);
    return { verdict: "PASS", reason: "Fallback — lanjut ke telaah penuh." };
  }
}

// ── TIER-1: FULL AI DEEP SCREENING (HANYA UNTUK YANG LOLOS TIER-0) ──────────
// Baca abstrak + fullText, hasilkan detailed screening JSON dan simpan ke DB.
export async function fullDeepScreening(groqClient, project, journal) {
  const abstractText =
    journal.abstract ||
    journal.fullText?.slice(0, 3000) ||
    journal.keyFindings?.slice(0, 1500) ||
    "";

  // Ambil konten sub-bab dari rawExtraction jika ada
  let extractedSections = "";
  if (journal.rawExtraction?.sections) {
    const sections = journal.rawExtraction.sections;
    extractedSections = sections
      .slice(0, 10)
      .map((s) => `[${s.title || "Sub-bab"}]\n${(s.content || "").slice(0, 500)}`)
      .join("\n\n");
  }

  const contextForAI = `
Judul: ${journal.title}
Penulis/Tahun: ${journal.authors || "N/A"} (${journal.year || "N/A"})
DOI: ${journal.doi || "N/A"}
Publikasi: ${journal.publication || "N/A"}

ABSTRAK:
${abstractText}

${extractedSections ? `KONTEN SUB-BAB TERPILIH:\n${extractedSections}` : ""}
`.trim();

  // Ekstrak detail pendekatan & narasi umum untuk memfilter tajam
  const approachConfig = project.approachConfig || {};
  const commonNarrative = project.commonNarrative || {};

  let approachDetails = `Pendekatan: ${project.approachType || "Kuantitatif"}`;
  if (project.approachType === "QUANTITATIVE") {
    approachDetails += `
- Variabel X (Bebas / Independen): ${approachConfig.variableX || "-"}
- Variabel Y (Terikat / Dependen): ${approachConfig.variableY || "-"}
- Variabel Z (Moderator/Intervening): ${approachConfig.variableZ || "-"}`;
  } else if (project.approachType === "QUALITATIVE") {
    approachDetails += `
- Model/Desain: ${approachConfig.model || "Deskriptif Fenomenologis"}
- Fokus Masalah / Fenomena: ${approachConfig.focusIssue || "-"}`;
  } else if (project.approachType === "MIXED") {
    approachDetails += `
- Desain: ${approachConfig.design || "Sequential Explanatory"}
- Fokus: ${approachConfig.focusIssue || "-"}`;
  } else if (project.approachType === "RD") {
    approachDetails += `
- Model R&D: ${approachConfig.framework || "ADDIE"}
- Produk/Target: ${approachConfig.focusIssue || "-"}`;
  }

  const narrativeDetails = `
- Tujuan Penelitian: ${commonNarrative.purpose || "-"}
- Batasan Masalah (Scope): ${commonNarrative.scope || "-"}`;

  const prompt = `Anda adalah Penelaah Literatur Ilmiah & Metodologi Penelitian Skripsi Akademik Pakar.
TUGAS: Lakukan penilaian komprehensif terhadap relevansi artikel jurnal ilmiah terhadap fokus topik dan variabel skripsi mahasiswa.

FOKUS PENELITIAN SKRIPSI:
- Judul / Topik Skripsi: "${project.title}"
- Bidang/Program Studi: "${project.field || project.prodi || "-"}"
${approachDetails}
${narrativeDetails}

DATA ARTIKEL JURNAL:
"""
${contextForAI.slice(0, 5000)}
"""

PANDUAN PENILAIAN ILMIAH BERBASIS TOPIK RISET:
1. PENILAIAN DILAKUKAN MURNI BERDASARKAN KESESUAIAN DENGAN TOPIK SKRIPSI ("${project.title}") SERTA VARIABEL DAN BATASAN MASALAH DI ATAS.
2. STATUS "APPROVED" (Skor 80–98):
   - Artikel mengkaji topik skripsi, variabel penelitian (${approachConfig.variableX || "X"} / ${approachConfig.variableY || "Y"}), instrumen evaluasi/kuesioner (misal: MHC-SF, DASS), variabel psikososial, atau fenomena terkait yang berada dalam lingkup batasan masalah.
   - Artikel ini SANGAT RELEVAN sebagai Latar Belakang (Bab I), Tinjauan Pustaka (Bab II), atau Metodologi (Bab III).
3. STATUS "UNDER_REVIEW" (Skor 55–79):
   - Memiliki kaitan kontekstual, metodologis, atau variabel pembanding sekunder.
4. STATUS "REJECTED" (Skor < 40):
   - HANYA untuk artikel yang 100% tidak ada kaitannya sama sekali dengan tema dan variabel skripsi.

Kembalikan JSON LENGKAP tanpa markdown:
{
  "relevanceScore": 88,
  "recommendation": "APPROVED",
  "reasoning": "Uraian akademis lengkap mengapa artikel ini relevan dan bagaimana temuan/variabelnya digunakan dalam Bab I, II, atau III skripsi.",
  "keyTheme": "Tema atau variabel utama artikel",
  "methodology": "Metode penelitian yang digunakan",
  "sampleDescription": "Deskripsi populasi/sampel",
  "keyFindings": "Temuan empiris utama yang relevan",
  "researchGap": "Gap yang ditemukan dalam artikel ini",
  "variableX": "Nama variabel independen utama",
  "variableY": "Nama variabel dependen utama",
  "analysisType": "Jenis analisis statistik (regresi, kualitatif, SEM, dll)",
  "yearPublished": ${journal.year || null},
  "canBeUsedFor": ["Tinjauan Pustaka", "Landasan Teori", "Latar Belakang", "Metodologi"]
}`;

  const res = await executeAiCompletion({
    featureCode: "JOURNAL_SCREENING",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    maxTokens: 1024,
    jsonMode: true,
  });

  return parseJsonFromText(res.content || "{}");
}

// ── 1. AI BATCH SCREENING (TIER-0 + TIER-1) ─────────────────────────────────
export async function screenAbstractsBatch(projectId, userId) {
  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId },
    include: { journals: true },
  });

  if (!project) {
    const err = new Error("Project tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  const journals = project.journals;
  if (journals.length === 0) {
    return { results: [], count: 0 };
  }

  const screeningResults = [];

  for (const journal of journals) {
    let relevanceScore = null;
    let recommendation = "UNDER_REVIEW";
    let reasoning = "Sistem AI sedang sibuk atau mengalami kendala saat menelaah artikel ini. Silakan klik tombol 'Telaah AI' untuk mencoba lagi nanti.";
    let keyTheme = "Telaah Literatur";
    let fullScreeningData = null;

    try {
      // ── TIER-0: Cek Judul Cepat ──────────────────────────────────────────
      const tier0 = await titleLevelFastReject(
        null,
        project.title,
        project.field,
        journal.title,
        project.approachConfig,
        project.commonNarrative
      );

      if (tier0 && tier0.verdict === "REJECTED") {
        relevanceScore = 15.0;
        recommendation = "REJECTED";
        reasoning = `[Ditolak AI] ${tier0.reason}`;
        keyTheme = "Tidak Relevan";
      } else {
        // ── TIER-1: Full Deep Screening AI ───────────────────────────────────
        const deepResult = await fullDeepScreening(null, project, journal);

        if (deepResult && deepResult.reasoning) {
          if (deepResult.relevanceScore !== undefined) relevanceScore = Number(deepResult.relevanceScore);
          if (deepResult.recommendation) recommendation = deepResult.recommendation;
          reasoning = deepResult.reasoning;
          if (deepResult.keyTheme) keyTheme = deepResult.keyTheme;

          if (recommendation !== "REJECTED") {
            fullScreeningData = deepResult;
          }
        }
      }
    } catch (err) {
      console.warn(`Screening AI error for journal ${journal.id}:`, err.message);
      recommendation = "UNDER_REVIEW";
      reasoning = `⚠️ Terjadi kendala saat menghubungkan ke AI (${err.message}). Silakan klik tombol 'Telaah AI' untuk mencoba lagi.`;
    }

    // ── Update database: APPROVED mendapat full JSON, REJECTED cukup status ──
    const updateData = {
      relevanceScore,
      status: recommendation,
      keyFindings: reasoning,
    };

    // Untuk APPROVED/UNDER_REVIEW: simpan seluruh hasil analisis AI ke rawExtraction
    if (fullScreeningData && recommendation !== "REJECTED") {
      const existingRaw = journal.rawExtraction || {};
      updateData.rawExtraction = {
        ...existingRaw,
        aiScreening: fullScreeningData,
        screenedAt: new Date().toISOString(),
      };
    }

    const updatedJournal = await prisma.journal.update({
      where: { id: journal.id },
      data: updateData,
    });

    screeningResults.push({
      journalId: journal.id,
      title: updatedJournal.title,
      authors: updatedJournal.authors,
      year: updatedJournal.year,
      relevanceScore,
      recommendation,
      reasoning,
      keyTheme,
    });
  }

  return {
    projectId,
    totalScreened: screeningResults.length,
    results: screeningResults,
  };
}

function normalizeNodeType(type) {
  const t = String(type || "").toUpperCase().trim();
  if (["VARIABLE", "CONCEPT", "METHOD", "THEORY", "GAP"].includes(t)) return t;
  if (t === "PROBLEM" || t === "MASALAH" || t === "ISSUE") return "CONCEPT";
  if (t === "METODE" || t === "TECHNIQUE") return "METHOD";
  if (t === "TEORI") return "THEORY";
  return "VARIABLE";
}

// ── 2. AUTO-POPULATE FRAMEWORK NODES FROM APPROVED JOURNALS ──────────────────
export async function autoPopulateFramework(projectId, userId, explicitJournalIds = null) {
  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId },
    include: {
      journals: {
        where:
          explicitJournalIds && explicitJournalIds.length > 0
            ? { id: { in: explicitJournalIds } }
            : { status: "APPROVED" },
      },
      frameworkNodes: true,
    },
  });

  if (!project) {
    const err = new Error("Project tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  const approvedJournals = project.journals;
  if (approvedJournals.length === 0) {
    return {
      success: false,
      message: "Tidak ada jurnal yang berstatus APPROVED untuk mengisi kerangka berpikir.",
      totalNodesCreated: 0,
      totalEdgesCreated: 0,
    };
  }

  const existingNodes = project.frameworkNodes;
  const existingLabels = new Set(existingNodes.map((n) => n.label.toLowerCase()));

  const createdNodes = [];
  const createdEdges = [];

  for (const journal of approvedJournals) {
    // Gunakan hasil analisis AI yang sudah disimpan di rawExtraction jika ada
    const aiScreening = journal.rawExtraction?.aiScreening;
    const context = aiScreening
      ? `Judul: ${journal.title}\nVariabel X: ${aiScreening.variableX || ""}\nVariabel Y: ${aiScreening.variableY || ""}\nMetodologi: ${aiScreening.methodology || ""}\nTemuan: ${aiScreening.keyFindings || ""}`
      : `${journal.title}\n${journal.abstract || journal.keyFindings || ""}`;

    const groqClient = getGroqClient();
    if (!groqClient) continue;

    try {
      const prompt = `Anda adalah pakar pemodelan kerangka berpikir penelitian skripsi.
Ekstrak 2 sampai 4 variabel utama dari artikel jurnal berikut untuk dijadikan node konsep dalam kerangka berpikir skripsi.

Judul Skripsi Mahasiswa: "${project.title}"
Artikel Jurnal:
"""
${context.slice(0, 1500)}
"""

Format JSON yang wajib dikembalikan:
{
  "variables": [
    {
      "label": "Nama Variabel (maks 4-5 kata)",
      "type": "VARIABLE",
      "description": "Definisi ringkas variabel",
      "relationship": "Mempengaruhi Positif (+)"
    }
  ]
}
Catatan: Tipe node yang valid HANYA: "VARIABLE", "CONCEPT", "METHOD", "THEORY", "GAP".`;

      const res = await executeAiCompletion({
        featureCode: "ANATOMI_1_JURNAL",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        jsonMode: true,
      });

      const parsed = parseJsonFromText(res.content || "");
      if (Array.isArray(parsed.variables)) {
        let posX = 120 + (existingNodes.length + createdNodes.length) * 160;
        let posY = 150;

        for (const v of parsed.variables) {
          if (!v.label || existingLabels.has(v.label.toLowerCase())) continue;

          const newNode = await prisma.frameworkNode.create({
            data: {
              projectId,
              label: v.label,
              type: normalizeNodeType(v.type),
              description: v.description || `Disarankan dari hasil telaah artikel "${journal.title}" (memerlukan verifikasi bukti empiris & halaman).`,
              status: "NEEDS_REVIEW",
              positionX: posX,
              positionY: posY,
            },
          });

          existingLabels.add(v.label.toLowerCase());
          createdNodes.push(newNode);
          posX += 220;
          // Catatan integritas ilmiah (Blueprint 012):
          // Bukti empiris (quote + pageNumber asli) TIDAK BOLEH dibuat otomatis dengan template sintetis & page=1.
          // Bukti harus dipetakan dari teks nyata oleh pengguna atau ekstraksi koordinat PDF.
        }
      }
    } catch (e) {
      console.warn("Auto-populate framework error:", e.message);
    }
  }

  return {
    success: true,
    message: `Berhasil mengekstrak ${createdNodes.length} variabel baru dari jurnal yang disetujui.`,
    totalNodesCreated: createdNodes.length,
    totalEdgesCreated: createdEdges.length,
    nodes: createdNodes,
  };
}
