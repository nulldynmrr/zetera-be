import { safeFetchJson } from "../../../lib/http-fanout.js";
import { normalizeDoi } from "../../../lib/merge-deduplicate.js";

export async function checkRetractionStatus(doi, { timeoutMs = 6000 } = {}) {
  const cleanDoi = normalizeDoi(doi);
  if (!cleanDoi) {
    return { isRetracted: false, reason: null };
  }

  const url = `https://api.openalex.org/works/https://doi.org/${encodeURIComponent(cleanDoi)}?mailto=admin@zetera.id`;
  const res = await safeFetchJson(url, {}, timeoutMs);

  if (!res.ok || !res.data) {
    return { isRetracted: false, reason: null };
  }

  const isRetracted = Boolean(res.data.is_retracted);
  return {
    isRetracted,
    source: "OpenAlex / Retraction Watch",
    retractionDate: isRetracted ? res.data.updated_date || null : null,
  };
}
