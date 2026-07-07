// src/lib/types.ts

export type Med = {
  medId: string;
  name: string;
  pattern: string;
};

export type DoseSlot = "morning" | "afternoon" | "evening" | "night" | "custom";

export type Dose = {
  doseId: string;
  medId: string;
  whenISO: string;
  slot: DoseSlot;  // <— use union type
  status: "scheduled" | "taken" | "missed";
  loggedAt?: string;
};
