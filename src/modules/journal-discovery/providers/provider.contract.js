/**
 * Kontrak terpadu untuk semua provider sumber jurnal ilmiah.
 *
 * @typedef {Object} NormalizedPaper
 * @property {string}  externalId      - ID unik dari provider asal
 * @property {string}  provider        - "OPENALEX" | "SEMANTIC_SCHOLAR" | "CORE" | "PUBMED" | "ARXIV" | "CROSSREF"
 * @property {string}  title
 * @property {string}  authors         - Nama penulis format ringkas "Nama A, Nama B"
 * @property {number|null} year
 * @property {string|null} publication - Nama venue / jurnal / publisher
 * @property {string|null} doi         - DOI ternormalisasi (tanpa prefix URL)
 * @property {string|null} url         - Link ke paper
 * @property {string|null} abstract
 * @property {string|null} openAccessPdfUrl - Link PDF open access langsung
 * @property {number|null} citedByCount
 * @property {boolean}  isRetracted
 * @property {boolean}  isInDoaj
 * @property {string}   domainHint     - "GENERAL" | "HEALTH" | "AI_CS"
 */

export function createNormalizedPaper(data = {}) {
  return {
    externalId: String(data.externalId || ""),
    provider: data.provider || "MANUAL",
    title: (data.title || "").trim(),
    authors: data.authors || "",
    year: data.year ? Number(data.year) : null,
    publication: data.publication || null,
    doi: data.doi ? data.doi.toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").trim() : null,
    url: data.url || (data.doi ? `https://doi.org/${data.doi}` : null),
    abstract: data.abstract ? data.abstract.trim() : null,
    openAccessPdfUrl: data.openAccessPdfUrl || null,
    citedByCount: typeof data.citedByCount === "number" ? data.citedByCount : 0,
    isRetracted: Boolean(data.isRetracted),
    isInDoaj: Boolean(data.isInDoaj),
    domainHint: data.domainHint || "GENERAL",
  };
}
