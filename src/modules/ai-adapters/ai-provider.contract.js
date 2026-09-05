/**
 * Kontrak standar untuk AI Provider Adapter (Groq, MaiaRouter, OpenAI, Anthropic, dll)
 * Semua adapter wajib mengembalikan objek terstandarisasi.
 *
 * @typedef {Object} StandardAiCompletionResponse
 * @property {string} content - Teks hasil respons AI
 * @property {Object} usage   - Statistik token
 * @property {number} usage.prompt_tokens
 * @property {number} usage.completion_tokens
 * @property {number} usage.total_tokens
 * @property {any}    raw     - Payload respons mentah dari provider
 */

export class BaseAiProviderAdapter {
  constructor(name) {
    this.name = name;
  }

  /**
   * Eksekusi pemanggilan completions
   * @param {Object} options
   * @param {Object} options.model        - Model config dari database
   * @param {Array}  options.messages     - Format [{ role: "system"|"user"|"assistant", content: string }]
   * @param {number} options.temperature  - Derajat kreativitas AI
   * @param {number} options.maxTokens    - Batas maksimum token
   * @param {boolean} options.jsonMode    - Paksa respons JSON
   * @param {string} options.apiKey       - Kunci API hasil dekripsi
   * @returns {Promise<StandardAiCompletionResponse>}
   */
  async executeCompletion(options) {
    throw new Error(`executeCompletion() belum diimplementasikan pada adapter "${this.name}".`);
  }
}
