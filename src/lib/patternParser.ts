import type { Dose, Med, DoseSlot } from "./types";

// Narrow the slot type to exclude "custom" for pattern expansion.
// (Your patterns only cover fixed day slots.)
type FixedSlot = Exclude<DoseSlot, "custom">;

// Default times for each fixed slot
const DEFAULT_TIMES: Record<FixedSlot, string> = {
  morning: "07:30",
  afternoon: "13:00",
  evening: "18:30",
  night: "21:30",
};

function addMinutes(base: Date, mins: number) {
  const d = new Date(base);
  d.setMinutes(d.getMinutes() + mins);
  return d;
}

export function expandPattern(med: Med, days = 7): Dose[] {
  // pattern like "1-0-1" (M-A-N) or "1-1-1-1" (M-A-E-N)
  const parts = String(med.pattern ?? "")
    .trim()
    .split("-")
    .map((x) => Number.parseInt(x || "0", 10) || 0);

  // Use the first 3 or 4 slots depending on pattern length
  // 3 parts => morning, afternoon, night
  // 4 parts => morning, afternoon, evening, night
  const baseSlots: FixedSlot[] = ["morning", "afternoon", "night"];
  const slots: FixedSlot[] =
    parts.length >= 4 ? (["morning", "afternoon", "evening", "night"] as FixedSlot[]) : baseSlots;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const doses: Dose[] = [];

  for (let d = 0; d < days; d++) {
    const date = new Date(today);
    date.setDate(today.getDate() + d);

    slots.forEach((slot, idx) => {
      const count = parts[idx] || 0;
      for (let k = 0; k < count; k++) {
        const [hh, mm] = DEFAULT_TIMES[slot].split(":").map(Number);
        const base = new Date(date);
        base.setHours(hh, mm, 0, 0);

        // If multiple doses in the same slot/day, stagger by 30 mins
        const when = k === 0 ? base : addMinutes(base, 30 * k);

        const doseId = `${med.medId}-${date.toISOString().slice(0, 10)}-${slot}-${k + 1}`;

        doses.push({
          doseId,
          medId: med.medId,
          whenISO: when.toISOString(),
          slot: slot as DoseSlot, // FixedSlot ⊂ DoseSlot
          status: "scheduled",
        });
      }
    });
  }

  return doses;
}
