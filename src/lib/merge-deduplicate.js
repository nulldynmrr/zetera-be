export function normalizeDoi(doi) {
  if (!doi) return "";
  return doi
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .trim();
}

export function normalizeTitle(title) {
  if (!title) return "";
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function calculateTitleSimilarity(titleA, titleB) {
  const normA = normalizeTitle(titleA);
  const normB = normalizeTitle(titleB);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1.0;

  const wordsA = new Set(normA.split(" ").filter((w) => w.length > 2));
  const wordsB = new Set(normB.split(" ").filter((w) => w.length > 2));

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }

  const union = new Set([...wordsA, ...wordsB]).size;
  return union > 0 ? intersection / union : 0;
}

export function mergeAndDeduplicatePapers(paperLists = []) {
  const flattened = paperLists.flat().filter(Boolean);
  const result = [];
  const doiMap = new Map();

  for (const paper of flattened) {
    const rawDoi = normalizeDoi(paper.doi);

    if (rawDoi) {
      if (doiMap.has(rawDoi)) {
        const existingIdx = doiMap.get(rawDoi);
        result[existingIdx] = enrichPaperMetadata(result[existingIdx], paper);
        continue;
      }
      doiMap.set(rawDoi, result.length);
      result.push({ ...paper, doi: rawDoi });
      continue;
    }

    // Fallback: title matching if DOI is absent
    const matchIndex = result.findIndex((existing) => {
      const sim = calculateTitleSimilarity(existing.title, paper.title);
      return sim >= 0.85;
    });

    if (matchIndex !== -1) {
      result[matchIndex] = enrichPaperMetadata(result[matchIndex], paper);
    } else {
      result.push({ ...paper, doi: null });
    }
  }

  return result;
}

function enrichPaperMetadata(base, incoming) {
  return {
    ...base,
    abstract: base.abstract && base.abstract.length > (incoming.abstract?.length || 0)
      ? base.abstract
      : incoming.abstract || base.abstract,
    authors: base.authors || incoming.authors,
    year: base.year || incoming.year,
    publication: base.publication || incoming.publication,
    url: base.url || incoming.url,
    openAccessPdfUrl: base.openAccessPdfUrl || incoming.openAccessPdfUrl,
    citedByCount: Math.max(base.citedByCount || 0, incoming.citedByCount || 0),
    isRetracted: Boolean(base.isRetracted || incoming.isRetracted),
    isInDoaj: Boolean(base.isInDoaj || incoming.isInDoaj),
    providers: Array.from(new Set([...(base.providers || [base.provider]), incoming.provider])).filter(Boolean),
  };
}
