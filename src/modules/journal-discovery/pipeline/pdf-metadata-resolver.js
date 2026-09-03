import { resolveUnpaywallPdf } from "../providers/unpaywall.provider.js";
import { normalizeDoi } from "../../../lib/merge-deduplicate.js";

export async function resolvePaperPdfMetadata(candidate) {
  if (!candidate) return candidate;

  // Jika sudah punya PDF URL langsung, pertahankan
  if (candidate.openAccessPdfUrl && candidate.openAccessPdfUrl.endsWith(".pdf")) {
    return {
      ...candidate,
      hasFullPdf: true,
    };
  }

  const cleanDoi = normalizeDoi(candidate.doi);
  if (!cleanDoi) {
    return {
      ...candidate,
      hasFullPdf: Boolean(candidate.openAccessPdfUrl),
    };
  }

  try {
    const unpaywall = await resolveUnpaywallPdf(cleanDoi);
    if (unpaywall.isOa && unpaywall.pdfUrl) {
      return {
        ...candidate,
        openAccessPdfUrl: unpaywall.pdfUrl,
        hasFullPdf: true,
        isInDoaj: candidate.isInDoaj || unpaywall.journalIsInDoaj,
      };
    }
  } catch (_) {
    // Ignore error and retain existing candidate data
  }

  return {
    ...candidate,
    hasFullPdf: Boolean(candidate.openAccessPdfUrl),
  };
}
