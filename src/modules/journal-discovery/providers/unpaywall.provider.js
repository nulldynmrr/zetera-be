import { safeFetchJson } from "../../../lib/http-fanout.js";
import { normalizeDoi } from "../../../lib/merge-deduplicate.js";

export async function resolveUnpaywallPdf(doi, { email = "admin@zetera.id", timeoutMs = 6000 } = {}) {
  const cleanDoi = normalizeDoi(doi);
  if (!cleanDoi) {
    return { isOa: false, pdfUrl: null, oaUrl: null };
  }

  const url = `https://api.unpaywall.org/v2/${encodeURIComponent(cleanDoi)}?email=${encodeURIComponent(email)}`;
  const res = await safeFetchJson(url, {}, timeoutMs);

  if (!res.ok || !res.data) {
    return { isOa: false, pdfUrl: null, oaUrl: null };
  }

  const data = res.data;
  const bestLocation = data.best_oa_location || {};

  const pdfUrl =
    bestLocation.url_for_pdf ||
    (Array.isArray(data.oa_locations)
      ? data.oa_locations.find((loc) => loc?.url_for_pdf)?.url_for_pdf
      : null);

  const oaUrl = bestLocation.url || data.oa_url || null;

  return {
    isOa: Boolean(data.is_oa),
    pdfUrl,
    oaUrl,
    journalIsOa: Boolean(data.journal_is_oa),
    journalIsInDoaj: Boolean(data.journal_is_in_doaj),
  };
}
