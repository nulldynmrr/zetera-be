import prisma from "../../lib/prisma.js";
import { processSearchQuery } from "./pipeline/query-processor.js";
import { runAcademicSearch } from "./pipeline/academic-search.js";
import { mergeAndDeduplicatePapers } from "../../lib/merge-deduplicate.js";
import { calculatePaperRanking } from "./pipeline/relevance-ranking.js";
import { resolvePaperPdfMetadata } from "./pipeline/pdf-metadata-resolver.js";
import { evaluateVerificationGate } from "./pipeline/verification-gate.js";
import { decidePersistenceStrategy } from "./pipeline/persistence-decider.js";
import { processLocalUpload } from "./pipeline/local-upload-pipeline.js";
import { screenJournal } from "../../services/journal.service.js";

/**
 * 1) SEARCH — Diagram 1 (SEARCH QUERY -> TOP PAPERS) + seluruh Diagram 2
 * Menghasilkan kandidat paper dari berbagai provider tanpa langsung mengotori tabel journals.
 */
export async function searchJournals({
  projectId,
  userId,
  query,
  domainHint = null,
  limitPerProvider = 8,
}) {
  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId },
  });

  if (!project) {
    const err = new Error("Project tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  const startTime = Date.now();

  // 1. Query Processing & NLP (Expansion + Domain Detection)
  const processedQuery = await processSearchQuery(query, domainHint);

  // 2. Multi-Provider Fan-out (Jalur A, C)
  const rawPapers = await runAcademicSearch({
    query: processedQuery.cleanQuery,
    expandedQuery: processedQuery.expandedQuery,
    domainHint: processedQuery.domainHint,
    limitPerProvider,
  });

  // 3. Merge & Deduplicate
  const deduplicated = mergeAndDeduplicatePapers([rawPapers]);

  // 4. Relevance & Multi-signal Ranking
  const rankedCandidates = calculatePaperRanking(deduplicated, project.title).slice(0, 25);

  const tookMs = Date.now() - startTime;

  // 5. Simpan ke Cache Staging (TTL 60 Menit)
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  const searchCache = await prisma.journalSearchCache.create({
    data: {
      projectId,
      query: processedQuery.cleanQuery,
      domainHint: processedQuery.domainHint,
      resultJson: rankedCandidates,
      expiresAt,
    },
  });

  return {
    searchId: searchCache.id,
    query: processedQuery.cleanQuery,
    expandedQuery: processedQuery.expandedQuery,
    domainHint: processedQuery.domainHint,
    totalFound: rankedCandidates.length,
    tookMs,
    candidates: rankedCandidates,
  };
}

/**
 * Mengambil kembali hasil pencarian dari staging cache
 */
export async function getCachedSearchResult({ projectId, userId, searchId }) {
  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId },
  });

  if (!project) {
    const err = new Error("Project tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  const cache = await prisma.journalSearchCache.findFirst({
    where: { id: searchId, projectId },
  });

  if (!cache || cache.expiresAt < new Date()) {
    const err = new Error("Hasil pencarian telah kedaluwarsa atau tidak ditemukan.");
    err.statusCode = 404;
    throw err;
  }

  return {
    searchId: cache.id,
    query: cache.query,
    domainHint: cache.domainHint,
    candidates: cache.resultJson,
    createdAt: cache.createdAt,
  };
}

/**
 * 2) IMPORT — Mengubah satu kandidat hasil search menjadi Journal permanen.
 * Menjalankan gate "VERIFIKASI LAGI" + "Ada file PDF full?"
 */
export async function importCandidate({ projectId, userId, candidate }) {
  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId },
  });

  if (!project) {
    const err = new Error("Project tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  if (!candidate || !candidate.title) {
    const err = new Error("Data kandidat jurnal tidak valid");
    err.statusCode = 400;
    throw err;
  }

  // 1. Jalur B: Resolusi PDF Open Access via Unpaywall
  const resolvedCandidate = await resolvePaperPdfMetadata(candidate);

  // 2. Gate "VERIFIKASI LAGI" (Anti-Retraksi, Format DOI, dan Kesesuaian Topik)
  const gate = await evaluateVerificationGate(resolvedCandidate, { contextTitle: project.title });

  // 3. Persistence Decider: Tentukan penyimpanan File PDF vs Link URL + Preview
  const decider = decidePersistenceStrategy(resolvedCandidate);

  // Validasi format enum provider
  const validProviders = [
    "OPENALEX",
    "SEMANTIC_SCHOLAR",
    "CORE",
    "PUBMED",
    "ARXIV",
    "CROSSREF",
    "DOAJ",
    "UPLOAD",
    "MANUAL",
  ];
  const safeProvider = validProviders.includes(candidate.provider) ? candidate.provider : "MANUAL";

  // 4. Buat row Journal permanen di database
  const createdJournal = await prisma.journal.create({
    data: {
      projectId,
      title: (resolvedCandidate.title || "Untitled Paper").slice(0, 490),
      authors: resolvedCandidate.authors ? String(resolvedCandidate.authors).slice(0, 490) : null,
      year: resolvedCandidate.year ? Number(resolvedCandidate.year) : null,
      publication: resolvedCandidate.publication ? String(resolvedCandidate.publication).slice(0, 250) : null,
      doi: resolvedCandidate.doi ? String(resolvedCandidate.doi).slice(0, 250) : null,
      url: resolvedCandidate.url ? String(resolvedCandidate.url).slice(0, 990) : null,
      abstract: resolvedCandidate.abstract || null,
      relevanceScore: resolvedCandidate.relevanceScore || 0,
      status: gate.status,
      tier: gate.tier,
      isRetracted: gate.isRetracted,
      isInDoaj: gate.isInDoaj,
      sourceType: resolvedCandidate.doi ? "DOI" : "URL",
      sourceProvider: safeProvider,
      externalId: resolvedCandidate.externalId ? String(resolvedCandidate.externalId).slice(0, 250) : null,
      openAccessPdfUrl: decider.openAccessPdfUrl,
      hasFullPdf: decider.hasFullPdf,
      linkPreviewTitle: decider.linkPreviewTitle,
      linkPreviewImage: decider.linkPreviewImage,
      citedByCount: resolvedCandidate.citedByCount || 0,
      verifiedAt: resolvedCandidate.doi && !gate.isRetracted ? new Date() : null,
    },
  });

  // 5. Trigger auto-screening jika jurnal bukan berstatus REJECTED
  let screeningResult = null;
  if (createdJournal.status !== "REJECTED") {
    try {
      screeningResult = await screenJournal(createdJournal.id, userId);
    } catch (_) {
      // Screening failure is non-blocking for candidate import
    }
  }

  return {
    success: true,
    message: gate.isRetracted
      ? "Kandidat diimpor namun berstatus DITOLAK karena terindikasi retraksi ilmiah."
      : "Kandidat berhasil diimpor dan diverifikasi ke dalam proyek skripsi!",
    journal: createdJournal,
    gateVerification: gate,
    screening: screeningResult,
  };
}

/**
 * 3) SUMMARIZE UPLOAD — Jalur D (upload jurnal cepat & rangkuman)
 */
export async function summarizeUploadedJournal({ projectId, userId, file }) {
  return processLocalUpload({ projectId, userId, file });
}
