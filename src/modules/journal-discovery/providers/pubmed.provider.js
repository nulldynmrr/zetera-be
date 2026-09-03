import { safeFetchJson } from "../../../lib/http-fanout.js";
import { createNormalizedPaper } from "./provider.contract.js";

export async function searchPubMed(query, { limit = 8, timeoutMs = 8000 } = {}) {
  if (!query || !query.trim()) return [];

  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pmc&term=${encodeURIComponent(query.trim())}&retmode=json&retmax=${limit}`;
  const searchRes = await safeFetchJson(searchUrl, {}, timeoutMs);

  const idList = searchRes.data?.esearchresult?.idlist;
  if (!searchRes.ok || !Array.isArray(idList) || idList.length === 0) {
    return [];
  }

  const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pmc&id=${idList.join(",")}&retmode=json`;
  const summaryRes = await safeFetchJson(summaryUrl, {}, timeoutMs);

  if (!summaryRes.ok || !summaryRes.data?.result) {
    return [];
  }

  const resultObj = summaryRes.data.result;
  const papers = [];

  for (const uid of idList) {
    const item = resultObj[uid];
    if (!item || !item.title) continue;

    const authors = (item.authors || []).map((a) => a.name).filter(Boolean).join(", ");
    const doiObj = (item.articleids || []).find((idObj) => idObj.idtype === "doi");
    const doi = doiObj ? doiObj.value : null;

    let year = null;
    if (item.pubdate) {
      const match = item.pubdate.match(/\b(19\d\d|20\d\d)\b/);
      if (match) year = Number(match[1]);
    }

    papers.push(
      createNormalizedPaper({
        externalId: `PMC${uid}`,
        provider: "PUBMED",
        title: item.title.replace(/<[^>]+>/g, "").trim(),
        authors,
        year,
        publication: item.source || "PubMed Central",
        doi,
        url: doi ? `https://doi.org/${doi}` : `https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${uid}/`,
        abstract: item.volume ? `Volume: ${item.volume}, Issue: ${item.issue || "-"}` : "",
        openAccessPdfUrl: `https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${uid}/pdf/`,
        citedByCount: 0,
        isRetracted: false,
        isInDoaj: false,
        domainHint: "HEALTH",
      })
    );
  }

  return papers;
}
