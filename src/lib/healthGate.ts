// src/lib/healthGate.ts
// Strong rule-based health-only gate. Export isHealthQuery() for use by the handler.

const HEALTH_KEYWORDS = [
  "health", "doctor", "symptom", "symptoms", "diagnosis", "treatment", "therapy",
  "medicine", "medication", "dose", "prescription", "clinic", "hospital", "nurse",
  "pain", "fever", "cough", "headache", "nausea", "dizzy", "infection",
  "vaccine", "vaccination", "immunization", "mental health", "depression", "anxiety",
  "nutrition", "diet", "calorie", "protein", "sleep", "exercise", "fitness",
  "pregnancy", "childbirth", "pediatrics", "geriatrics", "allergy", "rash",
  "blood pressure", "bp", "heart rate", "cholesterol", "diabetes", "insulin",
  "antibiotic", "antiviral", "antidepressant", "side effect", "contraindication",
  "symptom checker", "medical", "urgent care", "emergency", "triage"
];

const FINANCE_BLACKLIST = [
  "stock", "stocks", "price", "share", "shares", "nse", "bse", "ipo", "market", "exchange",
  "crypto", "bitcoin", "btc", "eth", "usd", "eur", "₹", "$", "sell", "buy", "investment",
  "portfolio", "dividend", "mutual fund", "etf", "forex", "commodity", "gold", "silver",
  "rate today", "market cap", "quote", "forex", "sensex", "nifty", "dow", "nasdaq"
];

const OFFTOPIC_PHRASES = [
  "tell me a joke", "poem", "write a song", "story", "movie", "book", "weather", "who is", "what is the capital",
  "programming", "code", "recipe", "how to make", "lyrics"
];

function containsAny(source: string, arr: string[]) {
  for (const s of arr) if (source.includes(s)) return true;
  return false;
}

/**
 * isHealthQuery(input)
 * - returns true only if input appears health-related and not finance/offtopic.
 */
export function isHealthQuery(input: string): boolean {
  if (!input || typeof input !== "string") return false;
  const t = input.toLowerCase();

  // explicit off-topic phrases -> block
  if (containsAny(t, OFFTOPIC_PHRASES)) return false;

  // explicit finance tokens -> block
  if (containsAny(t, FINANCE_BLACKLIST)) return false;

  // price/ticker/currency patterns -> block
  const currencyNumberRegex = /(?:\$|₹|€|USD|INR|EUR)\s*\d+/i;
  const priceWordRegex = /\b(price|cost|rate|quote|current value|market cap|share price)\b/i;
  const uppercaseTickerRegex = /\b[A-Z]{2,5}\b/; // crude heuristic; used with finance words below
  if (currencyNumberRegex.test(input) || priceWordRegex.test(input)) return false;
  if (uppercaseTickerRegex.test(input) && /\b(stock|share|price|nifty|sensex|nasdaq|dow|market)\b/i.test(input)) return false;

  // allow if any health keyword present
  if (containsAny(t, HEALTH_KEYWORDS)) return true;

  // fallback: allow if common body parts or symptom words present
  const bodyParts = ["head", "stomach", "chest", "back", "arm", "leg", "eye", "ear", "throat", "skin", "bleed", "vomit", "fever", "pain"];
  if (containsAny(t, bodyParts)) return true;

  // otherwise block by default
  return false;
}
