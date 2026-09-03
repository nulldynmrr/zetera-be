import { createNormalizedPaper } from "./provider.contract.js";

export async function searchArxiv(query, { limit = 8, timeoutMs = 8000 } = {}) {
  if (!query || !query.trim()) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const cleanQuery = query.trim().replace(/[:#]/g, " ");
    const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(cleanQuery)}&start=0&max_results=${limit}`;

    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return [];

    const xml = await res.text();
    const entries = xml.split("<entry>").slice(1);
    const papers = [];

    for (const rawEntry of entries) {
      const entry = rawEntry.split("</entry>")[0];

      const idMatch = entry.match(/<id>([^<]+)<\/id>/);
      const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
      const summaryMatch = entry.match(/<summary>([\s\S]*?)<\/summary>/);
      const publishedMatch = entry.match(/<published>([^<]+)<\/published>/);
      const doiMatch = entry.match(/<arxiv:doi[^>]*>([^<]+)<\/arxiv:doi>/i);

      // Authors
      const authorMatches = [...entry.matchAll(/<author>\s*<name>([^<]+)<\/name>/g)];
      const authors = authorMatches.map((m) => m[1].trim()).join(", ");

      const idUrl = idMatch ? idMatch[1].trim() : "";
      const arxivId = idUrl.replace(/^https?:\/\/arxiv\.org\/abs\//i, "");

      const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "Untitled arXiv Paper";
      const abstract = summaryMatch ? summaryMatch[1].replace(/\s+/g, " ").trim() : "";
      const year = publishedMatch ? new Date(publishedMatch[1]).getFullYear() : null;
      const doi = doiMatch ? doiMatch[1].trim() : null;
      const openAccessPdfUrl = arxivId ? `https://arxiv.org/pdf/${arxivId}.pdf` : null;

      papers.push(
        createNormalizedPaper({
          externalId: arxivId || idUrl,
          provider: "ARXIV",
          title,
          authors,
          year,
          publication: "arXiv Preprint",
          doi,
          url: idUrl || (doi ? `https://doi.org/${doi}` : null),
          abstract,
          openAccessPdfUrl,
          citedByCount: 0,
          isRetracted: false,
          isInDoaj: false,
          domainHint: "AI_CS",
        })
      );
    }

    return papers;
  } catch (err) {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
