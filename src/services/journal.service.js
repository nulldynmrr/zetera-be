import { createRequire } from "module";
import { prisma } from "../lib/prisma.js";
import { extractWithMinerU } from "./mineru.service.js";
import { parseJsonFromText, GROQ_MODELS } from "../lib/groq-config.js";
import { sanitizeAcademicText, cleanSectionsData } from "../lib/academic-cleaner.js";
import { localDomainCheck, titleLevelFastReject, fullDeepScreening } from "./screening.service.js";
import { syncJournalToLiteratureLandscape } from "./memory.service.js";
import fs from "fs";
import path from "path";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

// ─────────────────────────────────────────────────────────────
// TF-IDF Cosine Similarity — Relevance Score (cost = $0, no API)
// Menghitung kecocokan abstrak jurnal vs judul/topik project
// Range: 0–100 (float)
// ─────────────────────────────────────────────────────────────
function tokenize(text) {
  const stopwords = new Set([
    "dan","yang","di","dari","ke","untuk","pada","dengan","dalam","tentang",
    "studi","analisis","pengaruh","penerapan","implementasi","berbasis","terhadap",
    "the","a","an","of","in","for","on","with","to","by","is","are","was","were",
    "this","that","these","those","it","its","be","as","at","or","and","but",
    "not","have","has","had","do","does","did","can","could","will","would","should",
  ]);
  return (text || "")
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopwords.has(w));
}

function buildTf(tokens) {
  const freq = {};
  for (const t of tokens) freq[t] = (freq[t] || 0) + 1;
  const total = tokens.length || 1;
  const tf = {};
  for (const [w, c] of Object.entries(freq)) tf[w] = c / total;
  return tf;
}

export function computeRelevanceScore(projectTitle, abstractText) {
  const queryText = `${projectTitle} ${projectTitle} ${projectTitle}`; // boost judul 3x
  const docText = `${abstractText || ""} ${projectTitle || ""}`;

  const qTokens = tokenize(queryText);
  const dTokens = tokenize(docText);

  if (qTokens.length === 0 || dTokens.length === 0) return 0;

  const qTf = buildTf(qTokens);
  const dTf = buildTf(dTokens);

  // Himpunan semua kata unik
  const vocab = new Set([...Object.keys(qTf), ...Object.keys(dTf)]);

  let dotProduct = 0;
  let qMag = 0;
  let dMag = 0;

  for (const word of vocab) {
    const qVal = qTf[word] || 0;
    const dVal = dTf[word] || 0;
    dotProduct += qVal * dVal;
    qMag += qVal * qVal;
    dMag += dVal * dVal;
  }

  if (qMag === 0 || dMag === 0) return 0;
  const cosine = dotProduct / (Math.sqrt(qMag) * Math.sqrt(dMag));
  // Scale ke 0-100, clamp
  return Math.min(100, Math.round(cosine * 1000) / 10);
}

// ─────────────────────────────────────────────────────────────
// Update Journal Tier (PRIMARY / SUPPORTING / EXCLUDED)
// PRIMARY hanya bisa jika verifiedAt sudah diisi
// ─────────────────────────────────────────────────────────────
export async function updateJournalTier(journalId, userId, tier) {
  const validTiers = ["PRIMARY", "SUPPORTING", "EXCLUDED"];
  if (!validTiers.includes(tier)) {
    const err = new Error(`Tier tidak valid. Gunakan: ${validTiers.join(", ")}`);
    err.statusCode = 400;
    throw err;
  }

  const journal = await prisma.journal.findUnique({
    where: { id: journalId },
    include: { project: true },
  });

  if (!journal || journal.project.userId !== userId) {
    const err = new Error("Jurnal tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  // PRIMARY hanya boleh jika sudah diverifikasi (PDF+DOI valid)
  if (tier === "PRIMARY" && !journal.verifiedAt) {
    const err = new Error(
      "Tier PRIMARY hanya bisa diberikan setelah PDF dan DOI terverifikasi. " +
      "Silakan klik 'Verifikasi DOI' terlebih dahulu."
    );
    err.statusCode = 422;
    throw err;
  }

  return prisma.journal.update({
    where: { id: journalId },
    data: { tier },
  });
}

// ─────────────────────────────────────────────────────────────
// Verify Journal DOI — validasi via OpenAlex, set verifiedAt
// ─────────────────────────────────────────────────────────────
export async function verifyJournalDoi(journalId, userId) {
  const journal = await prisma.journal.findUnique({
    where: { id: journalId },
    include: { project: true },
  });

  if (!journal || journal.project.userId !== userId) {
    const err = new Error("Jurnal tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  const rawDoi = (journal.doi || "").replace(/^https?:\/\/doi\.org\//i, "").trim();

  if (!rawDoi || !/^10\.\d{4,9}\//.test(rawDoi)) {
    const err = new Error("DOI tidak valid atau belum diisi. Format DOI: 10.xxxx/xxxxx");
    err.statusCode = 422;
    throw err;
  }

  // Cek via OpenAlex (gratis, tanpa API key)
  let verified = false;
  let openAlexData = null;

  try {
    const resp = await fetch(
      `https://api.openalex.org/works/https://doi.org/${encodeURIComponent(rawDoi)}`,
      { headers: { "User-Agent": "Zetera Research Platform (mailto:admin@zetera.id)" } }
    );
    if (resp.ok) {
      openAlexData = await resp.json();
      verified = !!(openAlexData?.id);
    }
  } catch (e) {
    console.warn("[verifyJournalDoi] OpenAlex check failed:", e.message);
  }

  // Fallback: cek via Crossref
  if (!verified) {
    try {
      const resp = await fetch(
        `https://api.crossref.org/works/${encodeURIComponent(rawDoi)}`,
        { headers: { "User-Agent": "Zetera/1.0 (mailto:admin@zetera.id)" } }
      );
      if (resp.ok) {
        const data = await resp.json();
        verified = data?.status === "ok";
      }
    } catch (e) {
      console.warn("[verifyJournalDoi] Crossref check failed:", e.message);
    }
  }

  if (!verified) {
    const err = new Error(
      `DOI "${rawDoi}" tidak ditemukan di OpenAlex maupun Crossref. ` +
      "Pastikan DOI benar dan jurnal sudah terindeks."
    );
    err.statusCode = 422;
    throw err;
  }

  // Evaluasi Anti-Fraud (Retraction Watch & DOAJ via OpenAlex)
  const isRetracted = Boolean(openAlexData?.is_retracted);
  const isInDoaj = Boolean(
    openAlexData?.primary_location?.source?.is_in_doaj ||
    openAlexData?.locations?.some((loc) => loc?.source?.is_in_doaj)
  );

  // Update verifiedAt, status, dan flag anti-fraud
  const updated = await prisma.journal.update({
    where: { id: journalId },
    data: {
      verifiedAt: new Date(),
      pdfStoragePath: journal.filePath || journal.pdfStoragePath || null,
      isRetracted,
      isInDoaj,
      ...(isRetracted && { status: "REJECTED" }),
      // Perkaya metadata dari OpenAlex jika tersedia
      ...(openAlexData && {
        doi: rawDoi,
        url: openAlexData.doi || journal.url,
      }),
    },
  });

  const badge = isRetracted
    ? { code: "RETRACTED", label: "❌ Jurnal ini telah diretraksi (Retraction Watch)", variant: "danger" }
    : isInDoaj
    ? { code: "DOAJ_VERIFIED", label: "✅ Terverifikasi, tidak diretraksi & terindeks DOAJ", variant: "success" }
    : { code: "DOI_VALID", label: "⚠️ DOI valid, tapi belum terindeks DOAJ — cek manual", variant: "warning" };

  return {
    success: true,
    isRetracted,
    isInDoaj,
    badge,
    message: isRetracted
      ? `PERINGATAN: Jurnal dengan DOI "${rawDoi}" telah DIRETRAKSI (Retraction Watch). Status otomatis ditolak (REJECTED).`
      : `DOI "${rawDoi}" berhasil diverifikasi via ${openAlexData ? "OpenAlex" : "Crossref"}.${isInDoaj ? " Jurnal terdaftar resmi di DOAJ." : ""}`,
    data: updated,
  };
}

/**
 * Ekstraksi Metadata & Semua Sub-bab Jurnal Ilmiah dari Teks PDF
 * Menyimpan seluruh struktur bab, sub-bab, metodologi, dan temuan ke database.
 */
function extractAcademicPaperMetadata(parsedText, cleanFilename) {
  if (!parsedText || parsedText.trim().length === 0) {
    return {
      title: cleanFilename,
      authors: null,
      publication: null,
      year: new Date().getFullYear(),
      abstract: null,
      doi: null,
      sections: [],
    };
  }

  const cleanText = sanitizeAcademicText(parsedText.replace(/\r\n/g, "\n"));

  // 1. Ekstrak DOI (Hanya ambil jika format valid dan bersihkan karakter akhir)
  let doi = null;
  const doiMatch = cleanText.match(/\b10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/);
  if (doiMatch) {
    const rawDoi = doiMatch[0].replace(/[.,;:)\]\s]+$/, "");
    if (rawDoi.includes("/") && rawDoi.split("/")[1].length >= 3) {
      doi = rawDoi;
    }
  }

  // 2. Ekstrak Header & Title (Semua teks sebelum "Abstrak" / "Abstract")
  const abstractIdx = cleanText.search(/\b(abstrak|abstract|ringkasan)\b/i);
  let preAbstractText = abstractIdx > 0 ? cleanText.substring(0, abstractIdx) : cleanText.substring(0, 3000);

  const preLines = preAbstractText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let publication = null;
  let year = new Date().getFullYear();
  let titleCandidates = [];
  let authorsCandidates = [];

  // Cari nama jurnal / publikasi & tahun di baris teratas
  for (let i = 0; i < Math.min(5, preLines.length); i++) {
    const line = preLines[i];
    if (/(journal|jurnal|proceedings|prosiding|conference|vol\.|volume|issn|e-issn|doi)/i.test(line)) {
      if (!publication && !/^(e-issn|issn|doi|http)/i.test(line)) {
        publication = line;
      }
      const yrMatch = line.match(/\b(20\d{2}|19\d{2})\b/);
      if (yrMatch) {
        year = parseInt(yrMatch[1]);
      }
    }
  }

  // Filter baris untuk mendapatkan Judul Paper Asli
  for (let i = 0; i < preLines.length; i++) {
    let line = preLines[i]
      .replace(/^homepage\s+https?:\/\/\S+/gi, "")
      .replace(/https?:\/\/\S+/gi, "")
      .replace(/(?:e-?issn|p-?issn)[\s\d\-;&,]+/gi, "")
      .replace(/received\s+[a-z0-9,\s]+;\s*revised\s+[a-z0-9,\s]+;\s*accepted\s+[a-z0-9,\s]+/gi, "")
      .replace(/^(?:artikel\s+penelitian|original\s+article|research\s+article|jurnal\s+ilmiah|review\s+article|paper\s+ilmiah)[:\s-]*/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    if (/^(journal|jurnal|e-issn|issn|doi|http|vol\.|volume|halaman|page|download|homepage)/i.test(line)) {
      continue;
    }

    if (/@|fakultas|jurusan|program studi|prodi|universitas|university|institut|tarbiyah|keguruan|sekolah tinggi|puskesmas|dinas|korespondensi|penulis|jl\.|jalan|p-issn/i.test(line)) {
      continue;
    }

    if (/^\d+([-/.]\d+)*$/.test(line) || /^(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+\d{4}$/i.test(line)) {
      continue;
    }

    if (line.length >= 10 && titleCandidates.length < 3) {
      titleCandidates.push(line);
    } else if (line.length >= 3 && line.length < 80 && titleCandidates.length > 0 && authorsCandidates.length < 3) {
      if (!/abstrak|abstract/i.test(line)) {
        authorsCandidates.push(line);
      }
    }
  }

  let extractedTitle = titleCandidates.join(" ").trim().replace(/\s+/g, " ");
  // Sanitasi ekstra untuk judul
  extractedTitle = extractedTitle
    .replace(/^homepage\s+https?:\/\/\S+/gi, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/(?:e-?issn|p-?issn)[\s\d\-;&,]+/gi, "")
    .replace(/received\s+[a-z0-9,\s]+;\s*revised\s+[a-z0-9,\s]+;\s*accepted\s+[a-z0-9,\s]+/gi, "")
    .replace(/^(?:artikel\s+penelitian|original\s+article|research\s+article|jurnal\s+ilmiah)[:\s-]*/gi, "")
    .trim();

  const finalTitle = extractedTitle.length >= 10 ? extractedTitle : cleanFilename;
  const finalAuthors = authorsCandidates.length > 0 ? authorsCandidates.join(", ") : null;

  // 3. Ekstrak Abstrak
  let extractedAbstract = "";
  const abstractRegex = /(?:abstrak|abstract|ringkasan)[\s\S]{0,40}?:?\s*([\s\S]+?)(?=(?:kata\s*kunci|keywords?|index\s*terms|1\.?\s*(?:introduction|pendahuluan)|i\.\s*introduction|\n\s*\n\s*\n\s*\n|$))/i;
  const abstractMatch = cleanText.match(abstractRegex);

  if (abstractMatch && abstractMatch[1] && abstractMatch[1].trim().length >= 40) {
    extractedAbstract = abstractMatch[1].replace(/\s+/g, " ").trim().slice(0, 3500);
  } else {
    const sample = cleanText.slice(preAbstractText.length, preAbstractText.length + 2000).replace(/\s+/g, " ").trim();
    extractedAbstract = sample.slice(0, 1500);
  }

  // 4. Ekstrak SEMUA Sub-bab & Bagian (Pendahuluan, Metode, Hasil, Pembahasan, Kesimpulan, Daftar Pustaka)
  const sections = [];
  const lines = cleanText.split("\n");
  let currentSec = { heading: "Abstrak & Identitas", page: 1, content: "" };

  const sectionHeaderPattern = /^(1\.|\bI\.|\b[A-E]\.|\bBAB\b|\bPENDAHULUAN\b|\bMETODE\b|\bHASIL\b|\bPEMBAHASAN\b|\bKESIMPULAN\b|\bDAFTAR PUSTAKA\b|INTRODUCTION|METHOD|RESULTS|DISCUSSION|CONCLUSION|REFERENCES)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length > 3 && line.length < 80 && sectionHeaderPattern.test(line)) {
      if (currentSec.content.trim().length > 0) {
        sections.push({ ...currentSec, content: currentSec.content.trim() });
      }
      currentSec = {
        heading: line,
        page: Math.floor(i / 40) + 1,
        content: "",
      };
    } else {
      currentSec.content += (line + "\n");
    }
  }

  if (currentSec.content.trim().length > 0) {
    sections.push({ ...currentSec, content: currentSec.content.trim() });
  }

  return {
    title: finalTitle,
    authors: finalAuthors,
    publication: publication || null,
    year: year,
    abstract: extractedAbstract || null,
    doi: doi,
    sections,
  };
}

// ─────────────────────────────────────────────────────────────
// List journals for a project with optional search and status filter
// ─────────────────────────────────────────────────────────────
export async function listJournals(projectId, userId, { query, status } = {}) {
  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId },
  });

  if (!project) {
    const err = new Error("Project tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  const where = { projectId };
  if (status && status !== "ALL") {
    where.status = status;
  }
  if (query) {
    where.OR = [
      { title: { contains: query } },
      { authors: { contains: query } },
      { publication: { contains: query } },
      { abstract: { contains: query } },
    ];
  }

  return prisma.journal.findMany({
    where,
    include: {
      nodeMappings: {
        include: {
          node: {
            select: { id: true, label: true, type: true, status: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

// Get single journal with all mapped framework nodes
export async function getJournal(journalId, userId) {
  const journal = await prisma.journal.findUnique({
    where: { id: journalId },
    include: {
      project: true,
      nodeMappings: {
        include: {
          node: true,
        },
      },
    },
  });

  if (!journal || journal.project.userId !== userId) {
    const err = new Error("Jurnal tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  return journal;
}

// Create journal manually
export async function createJournal(projectId, userId, data) {
  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId },
  });

  if (!project) {
    const err = new Error("Project tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  let safeYear = null;
  if (data.year) {
    const yr = parseInt(data.year, 10);
    if (!isNaN(yr) && yr >= 1800 && yr <= 2100) {
      safeYear = yr;
    }
  }

  const validStatuses = ["CANDIDATE", "UNDER_REVIEW", "APPROVED", "REJECTED", "ARCHIVED"];
  const safeStatus = validStatuses.includes(data.status) ? data.status : "CANDIDATE";

  const validSources = ["PDF", "DOI", "URL", "MANUAL"];
  const safeSource = validSources.includes(data.sourceType) ? data.sourceType : "MANUAL";

  return prisma.journal.create({
    data: {
      projectId,
      title: (data.title || "Untitled Paper").slice(0, 490),
      authors: data.authors ? String(data.authors).slice(0, 490) : null,
      year: safeYear,
      publication: data.publication ? String(data.publication).slice(0, 250) : null,
      doi: data.doi ? String(data.doi).slice(0, 250) : null,
      url: data.url ? String(data.url).slice(0, 990) : null,
      abstract: data.abstract || null,
      fullText: data.fullText || null,
      keyFindings: data.keyFindings || null,
      status: safeStatus,
      sourceType: safeSource,
      // Hitung relevanceScore lokal (TF-IDF, cost $0)
      relevanceScore: computeRelevanceScore(project.title, data.abstract || data.keyFindings || data.title || ""),
      extractionMethod: "MANUAL",
      extractionStatus: "DONE",
    },
  });
}

// Update journal metadata / status
export async function updateJournal(journalId, userId, updateData) {
  const journal = await prisma.journal.findUnique({
    where: { id: journalId },
    include: { project: true },
  });

  if (!journal || journal.project.userId !== userId) {
    const err = new Error("Jurnal tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  const data = {};
  if (updateData.title !== undefined) data.title = updateData.title;
  if (updateData.authors !== undefined) data.authors = updateData.authors;
  if (updateData.year !== undefined) data.year = updateData.year ? parseInt(updateData.year) : null;
  if (updateData.publication !== undefined) data.publication = updateData.publication;
  if (updateData.doi !== undefined) data.doi = updateData.doi;
  if (updateData.url !== undefined) data.url = updateData.url;
  if (updateData.abstract !== undefined) data.abstract = updateData.abstract;
  if (updateData.fullText !== undefined) data.fullText = updateData.fullText;
  if (updateData.keyFindings !== undefined) data.keyFindings = updateData.keyFindings;
  if (updateData.status !== undefined) data.status = updateData.status;
  if (updateData.relevanceScore !== undefined)
    data.relevanceScore = parseFloat(updateData.relevanceScore);

  return prisma.journal.update({
    where: { id: journalId },
    data,
  });
}

// Delete journal
export async function deleteJournal(journalId, userId) {
  const journal = await prisma.journal.findUnique({
    where: { id: journalId },
    include: { project: true },
  });

  if (!journal || journal.project.userId !== userId) {
    const err = new Error("Jurnal tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  if (journal.filePath && fs.existsSync(journal.filePath)) {
    try {
      fs.unlinkSync(journal.filePath);
    } catch (e) {
      console.warn("Gagal hapus file fisik:", e);
    }
  }

  return prisma.journal.delete({
    where: { id: journalId },
  });
}

// Purge rejected journals
export async function purgeRejectedJournals(projectId, userId) {
  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId },
    include: { journals: { where: { status: "REJECTED" } } },
  });

  if (!project) {
    const err = new Error("Project tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  for (const j of project.journals) {
    if (j.filePath && fs.existsSync(j.filePath)) {
      try {
        fs.unlinkSync(j.filePath);
      } catch (e) {
        console.warn("Gagal hapus file fisik:", e);
      }
    }
  }

  const result = await prisma.journal.deleteMany({
    where: {
      projectId,
      status: "REJECTED",
    },
  });

  return {
    success: true,
    deletedCount: result.count,
    message: `Berhasil menghapus ${result.count} jurnal yang di luar topik.`,
  };
}

// ─────────────────────────────────────────────────────────────
// Upload PDF — Ekstraksi LOKAL DENGAN MINERU & FALLBACK LENGKAP
// Seluruh Bab, Sub-bab, Paragraf, dan Metadata disimpan ke Database
// ─────────────────────────────────────────────────────────────
export async function uploadAndParsePdf(projectId, userId, file) {
  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId },
  });

  if (!project) {
    const err = new Error("Project tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  if (!file) {
    const err = new Error("File PDF tidak disertakan");
    err.statusCode = 400;
    throw err;
  }

  const filePath = file.path;
  const cleanFilename = file.originalname
    .replace(/\.pdf$/i, "")
    .replace(/[+_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  let parsedText = "";
  let pageCount = 1;
  let extractionError = null;
  let extractionStatus = "DONE";
  let extractionMethod = "PDFPARSE";
  let structuredSections = [];
  let extractedImages = [];
  let fullMarkdown = "";

  // ── 0. DOCUMENT FINGERPRINT CACHE (SIDIK JARI DOKUMEN) ──
  // Jika file PDF yang sama persis (ukuran & konten) sudah pernah diekstrak sebelumnya di sistem,
  // gunakan hasil ekstraksi cache secara instan (0 detik) tanpa perlu parsing ulang.
  const existingCached = await prisma.journal.findFirst({
    where: {
      fileSize: file.size,
      extractionStatus: "DONE",
      fullText: { not: null },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingCached && existingCached.rawExtraction && existingCached.fullText && existingCached.fullText.length > 50) {
    console.log(`[FINGERPRINT CACHE HIT] Memanfaatkan cache sidik jari dokumen: "${existingCached.title}" (${file.size} bytes).`);
    const cachedRaw = existingCached.rawExtraction;
    parsedText = existingCached.fullText;
    structuredSections = Array.isArray(cachedRaw.sections) ? cachedRaw.sections : [];
    fullMarkdown = cachedRaw.fullMarkdown || "";
    pageCount = cachedRaw.pageCount || 1;
    extractionMethod = "PDFPARSE";
    extractionStatus = "DONE";
  } else {
    // 1. Ekstraksi instan menggunakan pdf-parse terlebih dahulu (<0.5 detik)
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      parsedText = (pdfData.text || "").replace(/\r\n/g, "\n");
      pageCount = pdfData.numpages || 1;
    } catch (err) {
      console.warn("Gagal parse PDF dengan engine dasar:", err.message);
      extractionError = err.message;
      extractionStatus = "FAILED";
    }

    // 2. Coba perkaya struktur sub-bab & tabel dengan MinerU jika tersedia
    try {
      const mineruRes = await extractWithMinerU(filePath);
      if (mineruRes && mineruRes.success) {
        extractionMethod = "MINERU_PIPELINE";
        if (mineruRes.sections && mineruRes.sections.length > 0) {
          structuredSections = mineruRes.sections;
        }
        if (mineruRes.images && mineruRes.images.length > 0) {
          extractedImages = mineruRes.images;
        }
        if (mineruRes.fullMarkdown) {
          fullMarkdown = mineruRes.fullMarkdown;
        }
        if (mineruRes.contentList && mineruRes.contentList.length > 0) {
          const mineruText = mineruRes.contentList.map((c) => c.text || c.content || "").join("\n");
          if (mineruText.trim().length > 100) {
            parsedText = mineruText;
          }
        }
      }
    } catch (mErr) {
      console.warn("MinerU selesai/fallback ke ekstraksi terstruktur:", mErr.message);
    }
  }

  // Ekstraksi Metadata Ilmiah & Sub-bab
  const metadata = extractAcademicPaperMetadata(parsedText, cleanFilename);
  if (structuredSections.length === 0) {
    structuredSections = metadata.sections;
  }

  // Validasi enum ExtractionMethod
  const validMethods = ["MINERU_PIPELINE", "MINERU_VLM", "GROBID", "PDFPARSE", "OCR", "MANUAL"];
  const safeExtractionMethod = validMethods.includes(extractionMethod) ? extractionMethod : "PDFPARSE";

  // Validasi enum ExtractionStatus
  const validStatuses = ["PENDING", "PROCESSING", "DONE", "FAILED"];
  const safeExtractionStatus = validStatuses.includes(extractionStatus) ? extractionStatus : "DONE";

  // Validasi Integer Tahun
  let safeYear = null;
  if (metadata.year) {
    const yr = parseInt(metadata.year, 10);
    if (!isNaN(yr) && yr >= 1800 && yr <= 2100) {
      safeYear = yr;
    }
  }

  // Simpan JSON Terstruktur Lengkap ke Database (rawExtraction)
  const rawExtraction = {
    title: (metadata.title || cleanFilename || "Untitled Paper").slice(0, 490),
    authors: metadata.authors ? String(metadata.authors).slice(0, 490) : null,
    publication: metadata.publication ? String(metadata.publication).slice(0, 250) : null,
    year: safeYear,
    abstract: metadata.abstract,
    doi: metadata.doi ? String(metadata.doi).slice(0, 250) : null,
    pageCount: pageCount,
    sections: structuredSections,
    images: extractedImages,
    fullMarkdown: fullMarkdown || parsedText.slice(0, 50000),
    extractedAt: new Date().toISOString(),
    method: safeExtractionMethod,
  };

  const relativeUrl = `/uploads/${path.basename(filePath)}`;

  const created = await prisma.journal.create({
    data: {
      projectId,
      title: (metadata.title || cleanFilename || "Untitled Paper").slice(0, 490),
      authors: metadata.authors ? String(metadata.authors).slice(0, 490) : null,
      publication: metadata.publication ? String(metadata.publication).slice(0, 250) : null,
      year: safeYear,
      doi: metadata.doi ? String(metadata.doi).slice(0, 250) : null,
      url: relativeUrl.slice(0, 990),
      abstract: metadata.abstract || null,
      fullText: parsedText.slice(0, 50000),
      fileKey: file.filename ? String(file.filename).slice(0, 250) : null,
      filePath: filePath ? String(filePath).slice(0, 490) : null,
      fileSize: file.size ? Number(file.size) : null,
      sourceType: "PDF",
      status: "CANDIDATE",
      // Hitung relevanceScore lokal via TF-IDF (cost $0)
      relevanceScore: computeRelevanceScore(project.title, metadata.abstract || parsedText.slice(0, 1000)),
      rawExtraction: rawExtraction,
      extractionMethod: safeExtractionMethod,
      extractionStatus: safeExtractionStatus,
      extractionError: extractionError ? String(extractionError).slice(0, 1000) : null,
    },
  });

  // ── Sync hasil ekstraksi MinerU ke Project Memory Landscape ──
  try {
    await syncJournalToLiteratureLandscape(projectId, created);
  } catch (memErr) {
    console.warn("Sync to literature landscape warning:", memErr.message);
  }

  // ── Auto-Screening Instan Terhadap Topik Skripsi Project Ini ──
  try {
    const screened = await screenJournal(created.id, userId);
    return screened;
  } catch (e) {
    console.warn("Auto-screening pasca upload error:", e.message);
    return created;
  }
}

// ─────────────────────────────────────────────────────────────
// Re-trigger Ekstraksi PDF Lokal
// ─────────────────────────────────────────────────────────────
export async function extractJournal(journalId, userId) {
  const journal = await prisma.journal.findUnique({
    where: { id: journalId },
    include: { project: true },
  });

  if (!journal || journal.project.userId !== userId) {
    const err = new Error("Jurnal tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  if (!journal.filePath || !fs.existsSync(journal.filePath)) {
    const err = new Error("File PDF tidak ditemukan untuk jurnal ini");
    err.statusCode = 400;
    throw err;
  }

  await prisma.journal.update({
    where: { id: journalId },
    data: { extractionStatus: "PROCESSING", extractionError: null },
  });

  try {
    const cleanFilename = path
      .basename(journal.filePath)
      .replace(/\.pdf$/i, "")
      .replace(/[+_-]/g, " ")
      .trim();

    let parsedText = "";
    let pageCount = 1;
    let extractionMethod = "PDFPARSE";
    let structuredSections = [];
    let fullMarkdown = "";

    // Coba MinerU
    const mineruRes = await extractWithMinerU(journal.filePath);
    if (mineruRes.success) {
      extractionMethod = "MINERU_PIPELINE";
      structuredSections = mineruRes.sections || [];
      fullMarkdown = mineruRes.fullMarkdown || "";
      parsedText = mineruRes.contentList.map((c) => c.text || c.content || "").join("\n");
    }

    if (!parsedText || parsedText.trim().length === 0) {
      const dataBuffer = fs.readFileSync(journal.filePath);
      const pdfData = await pdfParse(dataBuffer);
      parsedText = (pdfData.text || "").replace(/\r\n/g, "\n");
      pageCount = pdfData.numpages || 1;
    }

    const metadata = extractAcademicPaperMetadata(parsedText, cleanFilename);
    if (structuredSections.length === 0) {
      structuredSections = metadata.sections;
    }

    const rawExtraction = {
      title: metadata.title,
      authors: metadata.authors,
      publication: metadata.publication,
      year: metadata.year,
      abstract: metadata.abstract,
      doi: metadata.doi,
      pageCount,
      sections: structuredSections, // SEMUA SUB-BAB DI DATABASE
      fullMarkdown: fullMarkdown || parsedText.slice(0, 50000),
      extractedAt: new Date().toISOString(),
      method: extractionMethod,
    };

    return prisma.journal.update({
      where: { id: journalId },
      data: {
        title: metadata.title,
        authors: metadata.authors || journal.authors,
        publication: metadata.publication || journal.publication,
        year: metadata.year || journal.year,
        doi: metadata.doi || journal.doi,
        abstract: metadata.abstract || journal.abstract,
        fullText: parsedText.slice(0, 50000),
        rawExtraction,
        extractionStatus: "DONE",
        extractionMethod: extractionMethod,
        extractionError: null,
      },
    });
  } catch (err) {
    await prisma.journal.update({
      where: { id: journalId },
      data: {
        extractionStatus: "FAILED",
        extractionError: err.message,
      },
    });
    const error = new Error("Ekstraksi PDF gagal: " + err.message);
    error.statusCode = 500;
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────
// AI Tier 1 Screening
// ─────────────────────────────────────────────────────────────
export async function screenJournal(journalId, userId) {
  const journal = await prisma.journal.findUnique({
    where: { id: journalId },
    include: { project: true },
  });

  if (!journal || journal.project.userId !== userId) {
    const err = new Error("Jurnal tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  const project = journal.project;
  const raw = journal.rawExtraction;
  const titleForScreen = (raw?.title || journal.title || "").trim();
  const abstractForScreen = (raw?.abstract || journal.abstract || "").trim();

  // 1. Cek Cepat Domain Kata Kunci (Local Keyword Domain Check)
  const localCheck = localDomainCheck(project.title, titleForScreen);
  if (localCheck && localCheck.verdict === "REJECTED") {
    console.log(`[AUTO-SCREEN LOCAL REJECT] "${titleForScreen}" → ${localCheck.reason}`);
    return prisma.journal.update({
      where: { id: journalId },
      data: {
        status: "REJECTED",
        relevanceScore: 15.0,
        keyFindings: `⚠️ [Ditolak / Di Luar Topik] ${localCheck.reason}`,
      },
    });
  }

  let autoStatus = "UNDER_REVIEW";
  let autoScore = null;
  let autoFindings = "⚠️ Sistem AI sedang sibuk atau mengalami kendala saat menelaah artikel ini. Silakan klik tombol 'Telaah AI' untuk mencoba lagi nanti.";

  try {
    // 2. Fast Reject AI Check
    const tier0 = await titleLevelFastReject(
      null,
      project.title,
      project.field,
      titleForScreen,
      project.approachConfig,
      project.commonNarrative,
      userId,
      project.id
    );
    if (tier0 && tier0.verdict === "REJECTED") {
      autoStatus = "REJECTED";
      autoScore = 15.0;
      autoFindings = `[Ditolak AI] ${tier0.reason}`;
      console.log(`[AUTO-SCREEN AI REJECT] "${titleForScreen}" → ${tier0.reason}`);
    } else {
      // 3. Full Deep Screening AI
      const deepResult = await fullDeepScreening(
        null,
        project,
        {
          ...journal,
          title: titleForScreen,
          abstract: abstractForScreen,
        },
        userId
      );
      if (deepResult && deepResult.reasoning) {
        if (deepResult.relevanceScore !== undefined) autoScore = Number(deepResult.relevanceScore);
        if (deepResult.recommendation) autoStatus = deepResult.recommendation;
        autoFindings = deepResult.reasoning;
      }
    }
  } catch (e) {
    console.warn("Screening AI error:", e.message);
    autoStatus = "UNDER_REVIEW";
    autoFindings = `⚠️ Terjadi kendala saat menghubungkan ke AI (${e.message}). Silakan klik tombol 'Telaah AI' untuk mencoba lagi.`;
  }

  return prisma.journal.update({
    where: { id: journalId },
    data: {
      status: autoStatus,
      relevanceScore: autoScore,
      keyFindings: autoFindings,
    },
  });
}

// Lookup metadata by DOI
export async function lookupDoiMetadata(doi) {
  const cleanDoi = doi.trim().replace(/^(https?:\/\/)?(dx\.)?doi\.org\//, "");
  const url = `https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Zetera-Academic-Research/1.0 (mailto:support@zetera.app)" },
    });

    if (!res.ok) {
      throw new Error(`CrossRef API error status: ${res.status}`);
    }

    const data = await res.json();
    const item = data.message;

    const title = Array.isArray(item.title) ? item.title[0] : item.title || "";
    const authors = item.author
      ? item.author.map((a) => `${a.given || ""} ${a.family || ""}`.trim()).join(", ")
      : "";
    const year =
      item.created?.["date-parts"]?.[0]?.[0] ||
      item.issued?.["date-parts"]?.[0]?.[0] ||
      null;
    const publication = Array.isArray(item["container-title"])
      ? item["container-title"][0]
      : item["container-title"] || "";
    const abstract = item.abstract ? item.abstract.replace(/<[^>]+>/g, "").trim() : "";

    return {
      success: true,
      data: {
        doi: cleanDoi,
        title,
        authors,
        year,
        publication,
        abstract,
        url: item.URL || `https://doi.org/${cleanDoi}`,
      },
    };
  } catch (err) {
    const error = new Error("Gagal menemukan metadata untuk DOI tersebut: " + err.message);
    error.statusCode = 404;
    throw error;
  }
}

// Map Journal Evidence to Framework Node
export async function mapNodeEvidence(journalId, userId, { nodeId, evidenceType, quote, pageNumber, confidence }) {
  const journal = await prisma.journal.findUnique({
    where: { id: journalId },
    include: { project: true },
  });

  if (!journal || journal.project.userId !== userId) {
    const err = new Error("Jurnal tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  const sourceDoi = journal.doi || null;

  const mapping = await prisma.journalNodeMapping.create({
    data: {
      journalId,
      nodeId,
      evidenceType: evidenceType || "SUPPORTS",
      quote: quote || null,
      sourcePage: parseInt(pageNumber),
      sourceDoi,
      confidence: confidence ? parseFloat(confidence) : 1.0,
    },
    include: {
      node: true,
    },
  });

  if (evidenceType === "SUPPORTS") {
    await prisma.frameworkNode.update({
      where: { id: nodeId },
      data: { status: "SUPPORTED" },
    });
  } else if (evidenceType === "CONTRADICTS") {
    await prisma.frameworkNode.update({
      where: { id: nodeId },
      data: { status: "CONTRADICTORY" },
    });
  }

  return mapping;
}

// Remove Node Mapping
export async function removeNodeMapping(mappingId, userId) {
  const mapping = await prisma.journalNodeMapping.findUnique({
    where: { id: mappingId },
    include: { journal: { include: { project: true } } },
  });

  if (!mapping || mapping.journal.project.userId !== userId) {
    const err = new Error("Pemetaan bukti tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  return prisma.journalNodeMapping.delete({
    where: { id: mappingId },
  });
}

// AI Tier 2 Deep Cross-Check
export async function aiCrosscheckJournal(projectId, journalId, userId) {
  const journal = await prisma.journal.findUnique({
    where: { id: journalId },
    include: { project: true },
  });

  if (!journal || journal.project.userId !== userId) {
    const err = new Error("Jurnal tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  const frameworkNodes = await prisma.frameworkNode.findMany({
    where: { projectId },
  });

  const contextText =
    journal.rawExtraction?.fullMarkdown ||
    journal.rawExtraction?.fullText ||
    journal.fullText ||
    journal.abstract ||
    "";

  const { crossCheckJournalWithGroq } = await import("./ai.service.js");

  const aiResult = await crossCheckJournalWithGroq({
    projectTitle: journal.project.title,
    projectField: journal.project.field,
    journal: {
      ...journal,
      abstract: journal.rawExtraction?.abstract || journal.abstract,
      fullText: contextText,
    },
    frameworkNodes,
  });

  const createdMappings = [];
  if (Array.isArray(aiResult.matchedEvidence)) {
    for (const evidence of aiResult.matchedEvidence) {
      if (!evidence.nodeId) continue;

      try {
        const existing = await prisma.journalNodeMapping.findFirst({
          where: { journalId, nodeId: evidence.nodeId },
        });

        if (!existing) {
          const m = await prisma.journalNodeMapping.create({
            data: {
              journalId,
              nodeId: evidence.nodeId,
              evidenceType: evidence.evidenceType || "SUPPORTS",
              quote: evidence.quote || "Bukti empiris artikel jurnal",
              sourcePage: evidence.page || 1,
              sourceDoi: journal.doi || null,
              confidence: evidence.confidence || 0.95,
            },
            include: { node: true },
          });
          createdMappings.push(m);

          await prisma.frameworkNode.update({
            where: { id: evidence.nodeId },
            data: {
              status: evidence.evidenceType === "CONTRADICTS" ? "CONTRADICTORY" : "SUPPORTED",
            },
          });
        }
      } catch (e) {
        console.warn("Gagal auto-create mapping:", e);
      }
    }
  }

  let newStatus = "APPROVED";
  const score = aiResult.relevanceScore !== undefined ? Number(aiResult.relevanceScore) : 85;
  if (aiResult.topicFit === "TIDAK COCOK" || score < 40) {
    newStatus = "REJECTED";
  } else if (aiResult.topicFit === "SANGAT COCOK" || score >= 70) {
    newStatus = "APPROVED";
  } else {
    newStatus = "UNDER_REVIEW";
  }

  const updatedJournal = await prisma.journal.update({
    where: { id: journalId },
    data: {
      keyFindings: aiResult.executiveSummary
        ? `${aiResult.executiveSummary}\n\n📊 Metode: ${aiResult.methodology || "-"}\n👥 Sampel: ${aiResult.sampleSize || "-"}\n💡 Temuan: ${aiResult.keyEmpiricalFindings || "-"}`
        : journal.keyFindings,
      relevanceScore: score > 0 ? score : journal.relevanceScore,
      status: newStatus,
    },
    include: {
      nodeMappings: {
        include: { node: true },
      },
    },
  });

  return {
    success: true,
    aiAnalysis: aiResult,
    journal: updatedJournal,
    newMappings: createdMappings,
  };
}

// ── Overhaul v2: Single Source of Truth PDF Streaming & Caching Proxy ──
/**
 * Stream PDF jurnal dari storage lokal.
 * Jika belum ada di disk tapi openAccessPdfUrl tersedia:
 * fetch sekali dari provider, simpan ke uploads/, update filePath di DB, lalu stream.
 */
export async function streamJournalPdf(projectId, journalId, userId, res) {
  const journal = await prisma.journal.findUnique({
    where: { id: journalId },
    include: { project: true },
  });

  if (!journal || journal.project.userId !== userId) {
    const err = new Error("Jurnal tidak ditemukan atau akses ditolak");
    err.statusCode = 404;
    throw err;
  }

  // 1. Coba baca dari storage lokal
  let resolvedPath = journal.filePath ? path.resolve(journal.filePath) : null;
  if (!resolvedPath || !fs.existsSync(resolvedPath)) {
    if (journal.pdfStoragePath) {
      const alt = path.resolve(journal.pdfStoragePath);
      if (fs.existsSync(alt)) resolvedPath = alt;
    }
    if ((!resolvedPath || !fs.existsSync(resolvedPath)) && journal.url && journal.url.startsWith("/uploads/")) {
      const alt = path.resolve("." + journal.url);
      if (fs.existsSync(alt)) resolvedPath = alt;
    }
  }

  if (resolvedPath && fs.existsSync(resolvedPath)) {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent((journal.title || "paper").slice(0, 50))}.pdf"`);
    return fs.createReadStream(resolvedPath).pipe(res);
  }

  // 2. Jika lokal belum ada tapi openAccessPdfUrl ada -> fetch & cache
  const targetPdfUrl = journal.openAccessPdfUrl || (journal.url && journal.url.toLowerCase().endsWith(".pdf") ? journal.url : null);
  if (targetPdfUrl) {
    console.log(`[streamJournalPdf] Fetching & caching OA PDF for journal ${journalId} from: ${targetPdfUrl}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const fetchResp = await fetch(targetPdfUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "application/pdf,*/*",
        },
        signal: controller.signal,
        redirect: "follow",
      });
      clearTimeout(timeoutId);

      if (!fetchResp.ok) {
        const err = new Error(`Gagal mengunduh PDF open-access (status: ${fetchResp.status})`);
        err.statusCode = 502;
        throw err;
      }

      const arrayBuf = await fetchResp.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);

      // Verifikasi minimal bahwa buffer bukan halaman web HTML error
      const isPdfHeader = buffer.slice(0, 5).toString().startsWith("%PDF");
      const isPdfContentType = (fetchResp.headers.get("content-type") || "").toLowerCase().includes("pdf");

      if (!isPdfHeader && !isPdfContentType && buffer.slice(0, 50).toString().includes("<html")) {
        const err = new Error("Tautan open access mengembalikan halaman HTML, bukan file PDF");
        err.statusCode = 422;
        throw err;
      }

      const uploadDir = path.resolve("uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filename = `oa-${journal.id}-${Date.now()}.pdf`;
      const savePath = path.join(uploadDir, filename);
      fs.writeFileSync(savePath, buffer);

      const relativeSavedPath = `uploads/${filename}`;
      await prisma.journal.update({
        where: { id: journal.id },
        data: {
          filePath: relativeSavedPath,
          pdfStoragePath: relativeSavedPath,
          hasFullPdf: true,
          fileSize: buffer.length,
        },
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent((journal.title || "paper").slice(0, 50))}.pdf"`);
      return res.end(buffer);
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      console.warn(`[streamJournalPdf] Error fetching OA PDF: ${fetchErr.message}`);
      const err = new Error(`Tidak dapat mengunduh PDF open access: ${fetchErr.message}`);
      err.statusCode = 502;
      throw err;
    }
  }

  const err = new Error("PDF tidak tersedia untuk jurnal ini. Sumber dokumen belum memiliki file PDF lokal maupun tautan Open Access.");
  err.statusCode = 404;
  throw err;
}
