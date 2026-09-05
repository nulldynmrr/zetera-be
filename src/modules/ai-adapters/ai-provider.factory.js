import { GroqAdapter } from "./groq.adapter.js";
import { OpenAiCompatibleAdapter } from "./openai-compatible.adapter.js";

// Singleton adapter instances
const groqAdapter = new GroqAdapter();
const openAiCompatibleAdapter = new OpenAiCompatibleAdapter();

/**
 * Pabrik adapter untuk memilih adapter provider yang tepat berdasarkan metadata model
 *
 * @param {Object} model - Baris konfigurasi model dari tabel ai_model_configs
 * @returns {BaseAiProviderAdapter} Instance adapter yang sesuai
 */
export function getAiProviderAdapter(model) {
  if (!model) {
    return groqAdapter;
  }

  const baseUrl = (model.baseUrl || "").toLowerCase();
  const provider = (model.provider || "").toLowerCase();
  const routerLabel = (model.routerLabel || "").toLowerCase();

  // 1. Cek OpenAI compatible (MaiaRouter, DeepSeek, OpenAI, v1 endpoints)
  if (
    baseUrl.includes("maiarouter") ||
    baseUrl.includes("openai") ||
    baseUrl.includes("/v1") ||
    provider.includes("openai") ||
    routerLabel.includes("maiarouter")
  ) {
    return openAiCompatibleAdapter;
  }

  // 2. Default ke Groq
  return groqAdapter;
}
