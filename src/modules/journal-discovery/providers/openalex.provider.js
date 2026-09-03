import { safeFetchJson } from "../../../lib/http-fanout.js";
import { createNormalizedPaper } from "./provider.contract.js";

function reconstructAbstract(invertedIndex) {
  if (!invertedIndex || typeof invertedIndex !== "object") return null;
  const wordEntries = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    if (Array.isArray(positions)) {
      for (const pos of positions) {
        wordEntries.push({ word, pos });
      }
    }
  }
  if (wordEntries.length === 0) return null;
  wordEntries.sort((a, b) => a.pos - b.pos);
  return wordEntries.map((item) => item.word).join(" ");
}

export async function searchOpenAlex(query, { limit = 10, timeoutMs = 8000 } = {}) {
  if (!query || !query.trim()) return [];

  const url = `https://api.openalex.org/works?search=${encodeURIComponent(query.trim())}&per-page=${limit}&mailto=admin@zetera.id`;
  const res = await safeFetchJson(url, {}, timeoutMs);

  if (!res.ok || !Array.isArray(res.data?.results)) {
    return [];
  }

  return res.data.results.map((work) => {
    const authors = (work.authorships || [])
      .map((a) => a.author?.display_name)
      .filter(Boolean)
      .join(", ");

    const abstract = reconstructAbstract(work.abstract_inverted_index) || "";
    const primaryLoc = work.primary_location || {};
    const source = primaryLoc.source || {};

    const isInDoaj = Boolean(
      source.is_in_doaj ||
      (work.locations || []).some((loc) => loc.source?.is_in_doaj)
    );

    const openAccessPdfUrl =
      work.open_access?.oa_url ||
      work.best_oa_location?.pdf_url ||
      null;

    return createNormalizedPaper({
      externalId: work.id || "",
      provider: "OPENALEX",
      title: work.title || "Untitled Paper",
      authors,
      year: work.publication_year,
      publication: source.display_name || work.host_venue?.name || null,
      doi: work.doi,
      url: work.doi || work.id,
      abstract,
      openAccessPdfUrl,
      citedByCount: work.cited_by_count || 0,
      isRetracted: Boolean(work.is_retracted),
      isInDoaj,
      domainHint: "GENERAL",
    });
  });
}
