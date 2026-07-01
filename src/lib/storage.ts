// src/lib/storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Med, Dose } from "./types";

const K_MEDS = "meds";
const K_DOSES = "doses";

async function safeGet<T>(key: string, fallback: T): Promise<T> {
  try {
    const s = await AsyncStorage.getItem(key);
    if (!s) return fallback;
    return JSON.parse(s) as T;
  } catch (e) {
    console.warn(`[storage] get ${key} failed:`, e);
    return fallback;
  }
}
async function safeSet<T>(key: string, val: T) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.warn(`[storage] set ${key} failed:`, e);
    throw e;
  }
}

// ---- Meds ----
export async function getMeds(): Promise<Med[]> {
  return safeGet<Med[]>(K_MEDS, []);
}
export async function setMeds(meds: Med[]) {
  await safeSet(K_MEDS, meds);
}
export async function upsertMedByName(m: Omit<Med, "medId">): Promise<Med> {
  const meds = await getMeds();
  const nameKey = m.name.trim().toLowerCase();
  const existing = meds.find(x => x.name.trim().toLowerCase() === nameKey);
  if (existing) {
    existing.pattern = m.pattern;
    await setMeds(meds);
    console.log("[storage] upsert existing med:", existing);
    return existing;
  }
  const newMed: Med = { ...m, medId: `med-${Date.now()}` };
  meds.push(newMed);
  await setMeds(meds);
  console.log("[storage] created med:", newMed);
  return newMed;
}

// ---- Doses ----
export async function getDoses(): Promise<Dose[]> {
  return safeGet<Dose[]>(K_DOSES, []);
}
export async function setDoses(doses: Dose[]) {
  await safeSet(K_DOSES, doses);
}
export async function appendDoses(newOnes: Dose[]) {
  const all = await getDoses();
  const before = all.length;
  const map = new Map<string, Dose>(all.map(d => [d.doseId, d]));
  for (const d of newOnes) map.set(d.doseId, d);
  const merged = [...map.values()];
  await setDoses(merged);
  console.log(`[storage] appendDoses: before=${before} added=${newOnes.length} after=${merged.length}`);
}
export async function updateDoseStatus(doseId: string, status: "taken" | "missed") {
  const doses = await getDoses();
  const idx = doses.findIndex(d => d.doseId === doseId);
  if (idx >= 0) {
    doses[idx].status = status;
    doses[idx].loggedAt = new Date().toISOString();
    await setDoses(doses);
    console.log("[storage] updateDoseStatus:", doseId, status);
  } else {
    console.warn("[storage] updateDoseStatus: dose not found:", doseId);
  }
}

// ---- Utilities / Dev helpers ----
export async function resetAll() {
  await AsyncStorage.multiRemove([K_MEDS, K_DOSES]);
  console.log("[storage] resetAll: cleared keys");
}
export async function seedSample() {
  const med = await upsertMedByName({ name: "Paracetamol 500mg", pattern: "custom" });
  const now = new Date();
  const t1 = new Date(
    now.getFullYear(), now.getMonth(), now.getDate(),
    now.getHours(), (now.getMinutes() + 2) % 60, 0, 0
  );
  const t2 = new Date(
    now.getFullYear(), now.getMonth(), now.getDate(),
    (now.getHours() + 1) % 24, now.getMinutes(), 0, 0
  );
  const doses: Dose[] = [
    { doseId: `${med.medId}-now+2`,   medId: med.medId, whenISO: t1.toISOString(), slot: "morning", status: "scheduled" },
    { doseId: `${med.medId}-now+60`,  medId: med.medId, whenISO: t2.toISOString(), slot: "night",   status: "scheduled" },
  ];
  await appendDoses(doses);
  return { med, doses };
}

// IMPORTANT: do NOT add a default export.
// Keep only named exports as above.
