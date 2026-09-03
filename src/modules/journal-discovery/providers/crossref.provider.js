import { safeFetchJson } from "../../../lib/http-fanout.js";
import { createNormalizedPaper } from "./provider.contract.js";

export async function searchCrossref(query, { limit = 8, timeoutMs = 8000 } = {}) {
  if (!query || !query.trim()) return [];

  const email = process.env.ACADEMIC_POLITE_EMAIL || "admin@zetera.id";
  const url = `https://api.crossref.org/works?query=${encodeURIComponent(query.trim())}&rows=${limit}&mailto=${email}`;
  const res = await safeFetchJson(url, { headers: { "User-Agent": `Zetera/1.0 (mailto:${email})` } }, timeoutMs);

  const items = res.data?.message?.items;
  if (!res.ok || !Array.isArray(items)) {
    return [];
  }

  return items.map((item) => {
    const authors = (item.author || [])
      .map((a) => [a.given, a.family].filter(Boolean).join(" "))
      .filter(Boolean)
      .join(", ");

    const title = Array.isArray(item.title) ? item.title[0] : item.title || "Untitled Paper";
    const publication = Array.isArray(item["container-title"])
      ? item["container-title"][0]
      : item.publisher || null;

    let year = null;
    const parts = item.published?.["date-parts"] || item["published-print"]?.["date-parts"];
    if (parts && parts[0] && parts[0][0]) {
      year = Number(parts[0][0]);
    }

    const openAccessPdfUrl = (item.link || []).find((l) => l["content-type"] === "application/pdf")?.URL || null;

    return createNormalizedPaper({
      externalId: item.DOI || "",
      provider: "CROSSREF",
      title,
      authors,
      year,
      publication,
      doi: item.DOI,
      url: item.URL || (item.DOI ? `https://doi.org/${item.DOI}` : null),
      abstract: item.abstract ? item.abstract.replace(/<[^>]+>/g, "").trim() : "",
      openAccessPdfUrl,
      citedByCount: item["is-referenced-by-count"] || 0,
      isRetracted: false,
      isInDoaj: false,
      domainHint: "GENERAL",
    });
  });
}
