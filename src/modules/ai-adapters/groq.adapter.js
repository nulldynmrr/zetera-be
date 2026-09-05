import Groq from "groq-sdk";
import { BaseAiProviderAdapter } from "./ai-provider.contract.js";

export class GroqAdapter extends BaseAiProviderAdapter {
  constructor() {
    super("Groq");
    this.keyIndex = 0;
  }

  parseApiKeys(apiKey) {
    if (!apiKey) return [];
    return apiKey
      .split(/[\n,;]+/)
      .map((k) => k.trim())
      .filter((k) => k.length > 5);
  }

  async executeCompletion({ model, messages, temperature = 0.2, maxTokens = 2500, jsonMode = false, apiKey }) {
    const keys = this.parseApiKeys(apiKey);
    if (keys.length === 0) {
      throw new Error(`[GroqAdapter] API Key tidak ditemukan untuk model "${model?.modelName || "Groq"}".`);
    }

    const targetModel = model?.modelName || "qwen/qwen3.8-27b";
    let lastError = null;

    // Multi-key pool rotation (round-robin) & auto-switch on 429
    const startIndex = (this.keyIndex++) % keys.length;
    for (let i = 0; i < keys.length; i++) {
      const currentKeyIndex = (startIndex + i) % keys.length;
      const currentApiKey = keys[currentKeyIndex];

      try {
        const groq = new Groq({ apiKey: currentApiKey });
        const comp = await groq.chat.completions.create({
          model: targetModel,
          messages,
          temperature,
          max_tokens: maxTokens,
          response_format: jsonMode ? { type: "json_object" } : undefined,
        });

        const content = comp.choices?.[0]?.message?.content || "";
        const promptTokens = comp.usage?.prompt_tokens || Math.round(JSON.stringify(messages).length / 4);
        const completionTokens = comp.usage?.completion_tokens || Math.round(content.length / 4);

        return {
          content,
          usage: {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: comp.usage?.total_tokens || promptTokens + completionTokens,
          },
          raw: comp,
          keyUsedIndex: currentKeyIndex + 1,
          totalKeysInPool: keys.length,
        };
      } catch (err) {
        lastError = err;
        const isRateLimit =
          err?.status === 429 ||
          err?.message?.toLowerCase().includes("rate limit") ||
          err?.message?.toLowerCase().includes("tokens per minute") ||
          err?.message?.toLowerCase().includes("requests per minute");

        if (isRateLimit && keys.length > 1) {
          console.warn(
            `[GroqAdapter] Key #${currentKeyIndex + 1} terkena Rate Limit (429). Otomatis beralih ke key berikutnya di pool (${i + 1}/${keys.length})...`
          );
          continue;
        }

        throw err;
      }
    }

    throw lastError;
  }
}

