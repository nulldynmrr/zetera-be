import { uploadAndParsePdf, verifyJournalDoi } from "../../../services/journal.service.js";

export async function processLocalUpload({ projectId, userId, file }) {
  const journal = await uploadAndParsePdf(projectId, userId, file);

  let verificationResult = null;
  const warnings = [];

  // Jika DOI ditemukan dari hasil ekstraksi MinerU / PDF, jalankan verifikasi anti-fraud otomatis
  if (journal.doi) {
    try {
      verificationResult = await verifyJournalDoi(journal.id, userId);
      if (verificationResult.isRetracted) {
        warnings.push("PERINGATAN: Jurnal ini terindikasi telah diretraksi oleh penerbit (Retraction Watch).");
      }
    } catch (err) {
      warnings.push(`Verifikasi DOI otomatis: ${err.message}`);
    }
  } else {
    warnings.push("DOI belum terdeteksi dari teks PDF — verifikasi manual disarankan.");
  }

  const abstractShort = journal.abstract
    ? journal.abstract.slice(0, 300) + (journal.abstract.length > 300 ? "..." : "")
    : "";

  return {
    success: true,
    journalId: journal.id,
    title: journal.title,
    authors: journal.authors,
    year: journal.year,
    publication: journal.publication,
    doi: journal.doi,
    abstractShort,
    relevanceScore: journal.relevanceScore || 0,
    status: verificationResult?.data?.status || journal.status,
    tier: verificationResult?.data?.tier || journal.tier,
    hasFullPdf: true,
    isRetracted: Boolean(verificationResult?.isRetracted),
    isInDoaj: Boolean(verificationResult?.isInDoaj),
    badge: verificationResult?.badge || null,
    warnings,
    sourceProvider: "UPLOAD",
  };
}
