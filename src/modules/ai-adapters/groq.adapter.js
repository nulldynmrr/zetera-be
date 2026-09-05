import Groq from "groq-sdk";
import { BaseAiProviderAdapter } from "./ai-provider.contract.js";

export class GroqAdapter extends BaseAiProviderAdapter {
  constructor() {
    super("Groq");
  }

  async executeCompletion({ model, messages, temperature = 0.2, maxTokens = 2500, jsonMode = false, apiKey }) {
    if (!apiKey) {
      throw new Error(`[GroqAdapter] API Key tidak ditemukan untuk model "${model?.modelName || "Groq"}".`);
    }

    const groq = new Groq({ apiKey });
    const targetModel = model?.modelName || "qwen/qwen3.8-27b";

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
    };
  }
}
