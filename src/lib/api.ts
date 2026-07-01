// src/lib/api.ts
import { CHAT_SERVER_URL } from "./chatServerConfig";

export async function chatGemini(question: string): Promise<string> {
  if (!question?.trim()) return "Please ask a question.";

  try {
    const res = await fetch(`${CHAT_SERVER_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data?.error || `Server error: ${res.status}`;
      throw new Error(msg);
    }

    const text = String(data?.answer ?? "").trim();
    return text || "I couldn't find an answer.";
  } catch (err: any) {
    return `❌ Chat server error: ${err?.message || String(err)}`;
  }
}

// Optional alias used by some screens
export async function askChatbot(q: string) {
  return chatGemini(q);
}