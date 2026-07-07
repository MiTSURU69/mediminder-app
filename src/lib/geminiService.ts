// src/lib/geminiService.ts
import { generateText } from "./geminiClient";

/**
 * Small wrapper to use generateText directly for simpler code paths.
 * DO NOT hardcode API keys in this file.
 */
export async function askGemini(question: string): Promise<string> {
  try {
    // Use generateText which does auto-discovery and handles v1/v1beta selection
    const out = await generateText(question, { maxOutputTokens: 300 });
    return out || "";
  } catch (err: any) {
    console.error("[geminiService] error:", err);
    // surface a friendly message to callers — actual chat UI fallback is handled in chatService
    return `❌ Gemini request failed: ${String(err?.message ?? err)}`;
  }
}
