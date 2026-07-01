// src/lib/chatService.ts
import { CHAT_SERVER_URL } from "./chatServerConfig";

/**
 * askChatbot wrapper:
 *  - calls your Groq-backed server (index.mjs) at CHAT_SERVER_URL/chat
 *  - in-memory cache + cooldown, same as before
 */

const CACHE_TTL = 1000 * 60 * 30;
const USER_COOLDOWN_MS = 1000 * 5;
const CACHE: Record<string, { text: string; ts: number }> = {};
let lastCallTs = 0;

function extractErrorMessage(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message || String(err);
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export async function askChatbot(prompt: string): Promise<string> {
  const q = (prompt || "").trim();
  if (!q) return "";

  const now = Date.now();
  if (now - lastCallTs < USER_COOLDOWN_MS) {
    throw new Error("Please wait a few seconds before sending another question.");
  }
  lastCallTs = now;

  const cacheKey = q.toLowerCase();
  if (CACHE[cacheKey] && now - CACHE[cacheKey].ts < CACHE_TTL) return CACHE[cacheKey].text;

  try {
    const res = await fetch(`${CHAT_SERVER_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data?.error || `Server error: ${res.status}`);
    }

    const text = String(data?.answer ?? "").trim();
    if (!text) throw new Error("Server returned an empty response.");

    CACHE[cacheKey] = { text, ts: Date.now() };
    return text;
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.warn("[chatService] chat server error:", msg);
    throw new Error(`Chat server error: ${msg}`);
  }
}

/* Debug helper */
export function clearChatCache() {
  for (const k of Object.keys(CACHE)) delete CACHE[k];
  lastCallTs = 0;
}