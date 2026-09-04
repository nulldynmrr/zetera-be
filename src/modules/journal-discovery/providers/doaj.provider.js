import { safeFetchJson } from "../../../lib/http-fanout.js";
import { createNormalizedPaper } from "./provider.contract.js";

export async function searchDoaj(query, { limit = 8, timeoutMs = 8000 } = {}) {
  if (!query || !query.trim()) return [];

  const url = `https://doaj.org/api/search/articles/${encodeURIComponent(query.trim())}?pageSize=${limit}`;
  const res = await safeFetchJson(
    url,
    {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Zetera/1.0 (mailto:admin@zetera.id)",
      },
    },
    timeoutMs
  );

  const results = res.data?.results;
  if (!res.ok || !Array.isArray(results)) {
    return [];
  }

  return results.map((item) => {
    const bib = item.bibjson || {};
    const authors = (bib.author || [])
      .map((a) => a.name)
      .filter(Boolean)
      .join(", ");

    const title = bib.title || "Untitled Paper";
    const publication = bib.journal?.title || bib.journal?.publisher || null;
    const year = bib.year ? Number(bib.year) : null;

    const doiObj = (bib.identifier || []).find((id) => id.type === "doi");
    const doi = doiObj ? doiObj.id : null;

    const links = bib.link || [];
    const fullTextLink = links.find((l) => l.type === "fulltext")?.url || null;
    const pdfLink = links.find((l) => l.type === "fulltext" && (l.url?.toLowerCase().endsWith(".pdf") || l.content_type === "application/pdf"))?.url || null;

    return createNormalizedPaper({
      externalId: item.id || doi || "",
      provider: "DOAJ",
      title,
      authors,
      year,
      publication,
      doi,
      url: fullTextLink || (doi ? `https://doi.org/${doi}` : null),
      abstract: bib.abstract ? bib.abstract.trim() : "",
      openAccessPdfUrl: pdfLink || fullTextLink,
      citedByCount: 0,
      isRetracted: false,
      isInDoaj: true,
      domainHint: "GENERAL",
    });
  });
}
