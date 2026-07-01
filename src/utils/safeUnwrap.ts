// src/utils/safeUnwrap.ts
export function safeUnwrapGatewayPayload(raw: any) {
  if (!raw) return {};
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return { raw }; }
  }
  if (raw.body) {
    try {
      return typeof raw.body === "string" ? JSON.parse(raw.body) : raw.body;
    } catch {
      return raw.body;
    }
  }
  return raw;
}
