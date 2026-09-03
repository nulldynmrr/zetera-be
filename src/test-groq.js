import { Groq } from "groq-sdk";
import dotenv from "dotenv";
dotenv.config();

const apiKey = process.env.GROQ_API_KEY_FRAMEWORK_CROSS_CHECK_JURNAL;
const groq = new Groq({ apiKey });

async function test() {
  const modelsToTry = [
    "qwen/qwen3.8-27b",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "groq/compound",
    "llama-3.1-8b-instant"
  ];

  for (const model of modelsToTry) {
    try {
      console.log("Testing model:", model);
      const res = await groq.chat.completions.create({
        model,
        messages: [{ role: "user", content: "Katakan OK dalam format JSON: {\"status\": \"OK\"}" }],
        response_format: { type: "json_object" },
      });
      console.log(`✓ Model ${model} SUCCESS:`, res.choices[0]?.message?.content);
      return model;
    } catch (e) {
      console.log(`✗ Model ${model} FAILED:`, e.message);
    }
  }
}

test();
