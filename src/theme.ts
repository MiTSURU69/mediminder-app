// src/theme.ts
import { MD3LightTheme, MD3DarkTheme, configureFonts } from "react-native-paper";
import { brand } from "./design/tokens";

// Keep it simple: one default family for all variants.
// (Avoid platform-specific overrides to prevent 'headlineSmall' undefined errors)
const fonts = configureFonts({
  config: {
    fontFamily: "Inter_400Regular",
  },
});

export const lightTheme = {
  ...MD3LightTheme,
  roundness: 16,
  fonts,
  colors: {
    ...MD3LightTheme.colors,
    primary: brand.primary,
    secondary: brand.green,
    tertiary: brand.amber,
    background: brand.slateBg,     // #F6F8FB
    surface: brand.slateSurface,   // #FFFFFF
    surfaceVariant: "#F3F4F6",
    outline: brand.slateLine,      // #E5E7EB
    error: brand.red,              // #EF4444
    onPrimary: "#FFFFFF",
  },
} as const;

export const darkTheme = {
  ...MD3DarkTheme,
  roundness: 16,
  fonts,
  colors: {
    ...MD3DarkTheme.colors,
    // richer dark palette
    background: "#0A0F1E",
    surface: "#0F172A",
    surfaceVariant: "#111827",
    outline: "#1F2937",

    // accents
    primary: "#60A5FA",
    secondary: "#34D399",
    tertiary: "#FBBF24",
    error: brand.red,

    onPrimary: "#0B1220",
  },
} as const;
