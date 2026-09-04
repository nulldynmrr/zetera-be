import { safeFetchJson } from "../../../lib/http-fanout.js";
import { createNormalizedPaper } from "./provider.contract.js";
import { getSecret } from "../../../services/config.service.js";

export async function searchSemanticScholar(query, { limit = 10, timeoutMs = 8000 } = {}) {
  if (!query || !query.trim()) return [];

  const fields = "paperId,title,authors,year,venue,externalIds,abstract,citationCount,isOpenAccess,openAccessPdf";
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query.trim())}&limit=${limit}&fields=${fields}`;

  const apiKey = (await getSecret("SEMANTIC_SCHOLAR_API_KEY")) || process.env.SEMANTIC_SCHOLAR_API_KEY;
  const headers = {};
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  const res = await safeFetchJson(url, { headers }, timeoutMs);

  if (!res.ok || !Array.isArray(res.data?.data)) {
    return [];
  }

  return res.data.data.map((item) => {
    const authors = (item.authors || []).map((a) => a.name).filter(Boolean).join(", ");
    const doi = item.externalIds?.DOI || null;
    const openAccessPdfUrl = item.openAccessPdf?.url || null;

    return createNormalizedPaper({
      externalId: item.paperId || "",
      provider: "SEMANTIC_SCHOLAR",
      title: item.title || "Untitled Paper",
      authors,
      year: item.year,
      publication: item.venue || null,
      doi,
      url: doi ? `https://doi.org/${doi}` : `https://www.semanticscholar.org/paper/${item.paperId}`,
      abstract: item.abstract || "",
      openAccessPdfUrl,
      citedByCount: item.citationCount || 0,
      isRetracted: false,
      isInDoaj: false,
      domainHint: "AI_CS",
    });
  });
}
