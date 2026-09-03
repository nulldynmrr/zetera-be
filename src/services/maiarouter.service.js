import { getSecret } from "./config.service.js";

const FALLBACK_CHAT_URL = "https://api.maiarouter.ai/v1/chat/completions";
const FALLBACK_EMBEDDING_URL = "https://api.maiarouter.ai/v1/embeddings";

/**
 * Mengambil konfigurasi lengkap Maiarouter & Embedding secara dinamis dari Database (tabel SystemConfig)
 */
export async function getMaiarouterConfig() {
  const apiKey = (await getSecret("MAIAROUTER_API_KEY")) || process.env.MAIAROUTER_API_KEY || "";
  const embeddingApiKey =
    (await getSecret("EMBEDDING_API_KEY")) ||
    (await getSecret("MAIAROUTER_EMBEDDING_API_KEY")) ||
    (await getSecret("OPENAI_API_KEY")) ||
    apiKey;

  const chatUrl = (await getSecret("MAIAROUTER_CHAT_URL")) || FALLBACK_CHAT_URL;
  const embeddingUrl = (await getSecret("MAIAROUTER_EMBEDDING_URL")) || (await getSecret("EMBEDDING_BASE_URL")) || FALLBACK_EMBEDDING_URL;

  const embeddingModel = (await getSecret("MAIAROUTER_EMBEDDING_MODEL")) || process.env.MAIAROUTER_EMBEDDING_MODEL || "openai/text-embedding-3-small";
  const chatModel = (await getSecret("MAIAROUTER_CHAT_MODEL")) || process.env.MAIAROUTER_CHAT_MODEL || "xai/grok-4-1-fast-non-reasoning";

  return { apiKey, embeddingApiKey, chatUrl, embeddingUrl, embeddingModel, chatModel };
}

/**
 * 1. Embeddings API (openai/text-embedding-3-small)
 */
export async function getMaiarouterEmbeddings(inputArray, customModel) {
  const { apiKey, embeddingApiKey, embeddingUrl, embeddingModel } = await getMaiarouterConfig();
  const effectiveKey = embeddingApiKey || apiKey;
  if (!effectiveKey) {
    throw new Error("API Key untuk Embedding (EMBEDDING_API_KEY / MAIAROUTER_API_KEY) belum dikonfigurasi di database / admin panel.");
  }

  const model = customModel || embeddingModel;
  const inputs = Array.isArray(inputArray) ? inputArray : [inputArray];
  const targetUrl = embeddingUrl.endsWith("/embeddings") ? embeddingUrl : `${embeddingUrl.replace(/\/$/, "")}/embeddings`;

  const response = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${effectiveKey}`,
    },
    body: JSON.stringify({
      model,
      input: inputs,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Embeddings API Error [${response.status}]: ${errorText}`);
  }

  return response.json();
}

/**
 * 2. Chat Completions API via Maiarouter (xai/grok-4-1-fast-non-reasoning)
 */
export async function getMaiarouterChatCompletion({
  messages,
  model: customModel,
  temperature = 0.2,
  maxTokens = 2500,
  jsonMode = false,
}) {
  const { apiKey, chatUrl, chatModel } = await getMaiarouterConfig();
  if (!apiKey) {
    throw new Error("MAIAROUTER_API_KEY belum dikonfigurasi di database / admin panel.");
  }

  const model = customModel || chatModel;
  const requestBody = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  if (jsonMode) {
    requestBody.response_format = { type: "json_object" };
  }

  const targetUrl = chatUrl.endsWith("/chat/completions") ? chatUrl : `${chatUrl.replace(/\/$/, "")}/chat/completions`;

  const response = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Maiarouter Chat Completion Error [${response.status}]: ${errorText}`);
  }

  return response.json();
}
