import { computeRelevanceScore } from "../../../services/journal.service.js";

export function calculatePaperRanking(papers = [], contextTitle = "") {
  const currentYear = new Date().getFullYear();

  return papers
    .map((paper) => {
      // 1. Relevance Score (TF-IDF overlap terhadap project title / query)
      const docText = `${paper.title || ""} ${paper.abstract || ""}`;
      const tfIdfScore = contextTitle ? computeRelevanceScore(contextTitle, docText) : 0.5;

      // 2. Recency Score (prioritaskan 5 tahun terakhir, meluruh hingga 20 tahun)
      let recencyScore = 0.5;
      if (paper.year && paper.year > 1900) {
        const age = Math.max(0, currentYear - paper.year);
        recencyScore = Math.max(0, 1 - age / 20);
      }

      // 3. Citation Score (skala logaritmik base 10, max ~1000 sitasi)
      const citations = Number(paper.citedByCount) || 0;
      const citationScore = Math.min(1.0, Math.log10(citations + 1) / 3);

      // 4. Topic Text Match Score (kecocokan kata kunci pada judul paper)
      let textMatchScore = 0.5;
      if (contextTitle && paper.title) {
        const queryWords = contextTitle.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
        const titleLower = paper.title.toLowerCase();
        let matches = 0;
        for (const word of queryWords) {
          if (titleLower.includes(word)) matches++;
        }
        textMatchScore = queryWords.length > 0 ? Math.min(1.0, matches / queryWords.length) : 0.5;
      }

      // Bobot PRD §11: 40% TF-IDF + 30% Text/Semantic Match + 20% Recency + 10% Citation
      const finalScore = Number(
        (0.4 * tfIdfScore + 0.3 * textMatchScore + 0.2 * recencyScore + 0.1 * citationScore).toFixed(4)
      );

      return {
        ...paper,
        relevanceScore: tfIdfScore,
        rankingScore: finalScore,
      };
    })
    .sort((a, b) => b.rankingScore - a.rankingScore);
}
