/**
 * geminiClient.ts — now a thin wrapper around your Groq server.
 *
 * Kept the filename and `generateText` export so geminiService.ts (and any
 * other code importing from here) keeps working without changes.
 */

import { CHAT_SERVER_URL } from "./chatServerConfig";

/**
 * generateText(prompt, opts)
 * - prompt: string
 * - opts: kept for signature compatibility; currently unused since the
 *   Groq server controls model/temperature/maxOutputTokens itself.
 */
export async function generateText(prompt: string, _opts?: any): Promise<string> {
  const q = (prompt || "").trim();
  if (!q) return "";

  const res = await fetch(`${CHAT_SERVER_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: q }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data?.error || `Server error: ${res.status}`;
    throw new Error(`[chat server] ${msg}`);
  }

  const text = String(data?.answer ?? "").trim();
  if (!text) throw new Error("[chat server] Empty response.");

  return text;
}