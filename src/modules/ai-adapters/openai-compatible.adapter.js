import { BaseAiProviderAdapter } from "./ai-provider.contract.js";

export class OpenAiCompatibleAdapter extends BaseAiProviderAdapter {
  constructor() {
    super("OpenAI-Compatible");
  }

  async executeCompletion({ model, messages, temperature = 0.2, maxTokens = 2500, jsonMode = false, apiKey }) {
    if (!apiKey) {
      throw new Error(`[OpenAiCompatibleAdapter] API Key tidak ditemukan untuk provider "${model?.routerLabel || "OpenAI-Compatible"}".`);
    }

    const baseUrl = model?.baseUrl || "https://api.openai.com/v1";
    const targetUrl = baseUrl.endsWith("/chat/completions")
      ? baseUrl
      : `${baseUrl.replace(/\/$/, "")}/chat/completions`;

    const requestBody = {
      model: model?.modelName,
      messages,
      temperature,
      max_tokens: maxTokens,
    };
    if (jsonMode) {
      requestBody.response_format = { type: "json_object" };
    }

    const resp = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(20000),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`[${model?.routerLabel || "AI-Provider"} HTTP ${resp.status}]: ${errText}`);
    }

    const data = await resp.json();
    const content =
      data.choices?.[0]?.message?.content ||
      data.choices?.[0]?.message?.reasoning_content ||
      data.choices?.[0]?.text ||
      "";

    if (!content || !content.trim()) {
      throw new Error(`[${model?.routerLabel || "AI-Provider"}] Model mengembalikan respon teks kosong.`);
    }
    const promptTokens = data.usage?.prompt_tokens || Math.round(JSON.stringify(messages).length / 4);
    const completionTokens = data.usage?.completion_tokens || Math.round(content.length / 4);

    return {
      content,
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: data.usage?.total_tokens || promptTokens + completionTokens,
      },
      raw: data,
    };
  }
}
