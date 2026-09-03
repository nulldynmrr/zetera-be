import { checkRetractionStatus } from "../providers/retraction-watch.provider.js";
import { normalizeDoi } from "../../../lib/merge-deduplicate.js";

export async function evaluateVerificationGate(candidate, { contextTitle = "" } = {}) {
  const reasons = [];
  let isRetracted = Boolean(candidate.isRetracted);
  const cleanDoi = normalizeDoi(candidate.doi);

  // 1. Verifikasi Retraksi Ilmiah
  if (cleanDoi && !isRetracted) {
    try {
      const retractionCheck = await checkRetractionStatus(cleanDoi);
      if (retractionCheck.isRetracted) {
        isRetracted = true;
      }
    } catch (_) {}
  }

  if (isRetracted) {
    return {
      pass: false,
      status: "REJECTED",
      tier: "EXCLUDED",
      isRetracted: true,
      isInDoaj: Boolean(candidate.isInDoaj),
      reasons: ["Paper ini telah diretraksi oleh penerbit/jurnal (Retraction Watch)."],
    };
  }

  // 2. Evaluasi format DOI & sumber
  const hasValidDoi = Boolean(cleanDoi && /^10\.\d{4,9}\//.test(cleanDoi));
  if (!hasValidDoi) {
    reasons.push("Tidak memiliki DOI terstandarisasi (disimpan sebagai referensi URL).");
  }

  // 3. Evaluasi kesesuaian topik minimal
  const relScore = typeof candidate.relevanceScore === "number" ? candidate.relevanceScore : 0.5;
  const isRelevant = relScore >= 0.1 || !contextTitle;

  if (!isRelevant) {
    reasons.push("Skor relevansi terhadap judul penelitian di bawah ambang batas minimum.");
  }

  const pass = !isRetracted && (hasValidDoi || Boolean(candidate.openAccessPdfUrl || candidate.url));
  const status = pass ? "CANDIDATE" : "REJECTED";
  const tier = pass ? (candidate.hasFullPdf && hasValidDoi ? "PRIMARY" : "SUPPORTING") : "EXCLUDED";

  return {
    pass,
    status,
    tier,
    isRetracted: false,
    isInDoaj: Boolean(candidate.isInDoaj),
    reasons,
  };
}
