import { safeFetchJson } from "../../../lib/http-fanout.js";
import { createNormalizedPaper } from "./provider.contract.js";

export async function searchCore(query, { limit = 10, timeoutMs = 8000 } = {}) {
  const apiKey = process.env.CORE_API_KEY;
  if (!apiKey || !query || !query.trim()) {
    return [];
  }

  const url = `https://api.core.ac.uk/v3/search/works?q=${encodeURIComponent(query.trim())}&limit=${limit}`;
  const res = await safeFetchJson(
    url,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    },
    timeoutMs
  );

  if (!res.ok || !Array.isArray(res.data?.results)) {
    return [];
  }

  return res.data.results.map((work) => {
    const authors = (work.authors || [])
      .map((a) => (typeof a === "string" ? a : a.name))
      .filter(Boolean)
      .join(", ");

    return createNormalizedPaper({
      externalId: String(work.id || ""),
      provider: "CORE",
      title: work.title || "Untitled Work",
      authors,
      year: work.yearPublished ? Number(work.yearPublished) : null,
      publication: work.publisher || work.journals?.[0]?.title || null,
      doi: work.doi || null,
      url: work.downloadUrl || (work.doi ? `https://doi.org/${work.doi}` : null),
      abstract: work.abstract || "",
      openAccessPdfUrl: work.downloadUrl || null,
      citedByCount: work.citationCount || 0,
      isRetracted: false,
      isInDoaj: false,
      domainHint: "GENERAL",
    });
  });
}
