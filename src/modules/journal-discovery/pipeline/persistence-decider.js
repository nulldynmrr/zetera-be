export function decidePersistenceStrategy(candidate) {
  const pdfUrl = candidate.openAccessPdfUrl;
  const isLikelyPdf = Boolean(
    pdfUrl &&
    (pdfUrl.toLowerCase().endsWith(".pdf") ||
      pdfUrl.includes("/pdf") ||
      candidate.provider === "ARXIV" ||
      candidate.provider === "PUBMED")
  );

  return {
    hasFullPdf: isLikelyPdf,
    openAccessPdfUrl: pdfUrl || null,
    linkPreviewTitle: candidate.title ? candidate.title.slice(0, 490) : "Journal Reference",
    linkPreviewImage: null,
    storageType: isLikelyPdf ? "PDF_URL" : "LINK_URL",
  };
}
