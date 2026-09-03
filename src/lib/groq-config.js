import Groq from "groq-sdk";

export function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY || "";
  if (!apiKey || apiKey.startsWith("gsk_demo") || apiKey === "gsk_your_groq_api_key_here") {
    return null;
  }
  return new Groq({ apiKey });
}

export async function getGroqChatCompletion({
  messages,
  model = "llama-3.3-70b-versatile",
  temperature = 0.2,
  maxTokens = 3500,
}) {
  const client = getGroqClient();
  if (!client) throw new Error("Groq API Key tidak ditemukan.");
  return client.chat.completions.create({
    messages,
    model,
    temperature,
    max_tokens: maxTokens,
  });
}

export const GROQ_MODELS = {
  FAST_BINARY: "llama-3.1-8b-instant",
  DEEP_REASON: "llama-3.3-70b-versatile",
  FALLBACK_REASON: "llama-3.1-70b-versatile",
};

/**
 * Ekstrak JSON dari output teks bebas atau blok markdown.
 */
export function parseJsonFromText(text) {
  if (!text) return {};
  const clean = text.trim();

  // Coba blok ```json ... ```
  const jsonBlock = clean.match(/```(?:json)?\s*([\s\S]+?)\s*```/i);
  if (jsonBlock) {
    try {
      return JSON.parse(jsonBlock[1]);
    } catch (_) {}
  }

  // Coba object langsung { ... }
  const objMatch = clean.match(/\{[\s\S]+\}/);
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0]);
    } catch (_) {}
  }

  // Coba array langsung [ ... ]
  const arrMatch = clean.match(/\[[\s\S]+\]/);
  if (arrMatch) {
    try {
      return JSON.parse(arrMatch[0]);
    } catch (_) {}
  }

  return {};
}
