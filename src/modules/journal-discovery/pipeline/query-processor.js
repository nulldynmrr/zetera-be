import { getGroqChatCompletion } from "../../../lib/groq-config.js";

const HEALTH_KEYWORDS = [
  "kesehatan", "medis", "pasien", "penyakit", "dokter", "rumah sakit",
  "terapi", "mental", "klinis", "obat", "psikologi", "health", "medical",
  "patient", "disease", "clinical", "hospital", "therapy", "psychology",
];

const AI_CS_KEYWORDS = [
  "ai", "artificial intelligence", "machine learning", "deep learning",
  "neural", "algorithm", "software", "komputer", "data mining", "nlp",
  "cnn", "lstm", "transformer", "chatbot", "vision", "robotik", "iot",
  "network", "keamanan siber", "cybersecurity", "web", "aplikasi",
];

export function detectDomainHint(query = "") {
  const q = query.toLowerCase();
  const hasHealth = HEALTH_KEYWORDS.some((kw) => q.includes(kw));
  const hasAiCs = AI_CS_KEYWORDS.some((kw) => q.includes(kw));

  if (hasHealth && !hasAiCs) return "HEALTH";
  if (hasAiCs && !hasHealth) return "AI_CS";
  return "GENERAL";
}

export async function processSearchQuery(rawQuery, explicitDomainHint = null) {
  const cleanQuery = (rawQuery || "").trim().replace(/\s+/g, " ");
  const domainHint = explicitDomainHint || detectDomainHint(cleanQuery);

  let expandedQuery = cleanQuery;

  // AI query expansion jika ada bahasa Indonesia atau query pendek
  try {
    const isIndonesian = /[a-z]/i.test(cleanQuery) && (
      cleanQuery.includes(" dan ") ||
      cleanQuery.includes(" yang ") ||
      cleanQuery.includes(" pada ") ||
      cleanQuery.includes(" untuk ") ||
      cleanQuery.includes(" berbasis ")
    );

    if (isIndonesian || cleanQuery.split(" ").length < 4) {
      const prompt = `Translate and expand this research topic into English academic search keywords (maximum 6-8 keywords without boolean AND/OR, plain text only): "${cleanQuery}"`;
      const completion = await getGroqChatCompletion({
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 50,
      });

      const expanded = completion.choices?.[0]?.message?.content?.trim();
      if (expanded && expanded.length > 3 && !expanded.includes("\n")) {
        expandedQuery = expanded.replace(/["']/g, "");
      }
    }
  } catch (_) {
    // Fallback gracefully to clean query
    expandedQuery = cleanQuery;
  }

  return {
    rawQuery,
    cleanQuery,
    expandedQuery,
    domainHint,
  };
}
