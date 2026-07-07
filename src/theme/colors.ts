// src/theme/colors.ts
// Shared design tokens — restrained, utility-first palette for a medication
// schedule (not a lifestyle/wellness dashboard). Import from any screen so
// the whole app stays consistent as we redo History, AddMedication, Chat.

export const COLORS = {
  // Text
  ink: "#16211D",
  muted: "#6E7570",
  faint: "#9BA39D",

  // Surfaces
  paper: "#F7F7F4",
  surface: "#FFFFFF",
  line: "#E3E5E1",

  // Accent — a single deliberate pine-teal, used sparingly for actions
  // and the "taken" state. No gradients, no secondary bright accent.
  accent: "#1F6F62",
  accentSoft: "rgba(31, 111, 98, 0.10)",

  // Status
  skip: "#9A3324",
  skipSoft: "rgba(154, 51, 36, 0.08)",
};

export const RADIUS = {
  card: 14,
  chip: 10,
  pill: 999,
};

export const FONTS = {
  // Requires useAppFonts() to have run once at the app root (see
  // src/theme/useAppFonts.ts). Falls back to the system font if not loaded.
  display: "PlusJakartaSans_700Bold",
  displayMedium: "PlusJakartaSans_600SemiBold",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
};