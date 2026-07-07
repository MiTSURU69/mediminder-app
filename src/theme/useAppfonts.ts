// src/theme/useAppFonts.ts
// Call this once at the very root of the app (App.tsx, or app/_layout.tsx if
// you're on expo-router) and don't render navigation until `loaded` is true.
// Both font families are already in your package.json — no install needed.
//
// Example:
//   const loaded = useAppFonts();
//   if (!loaded) return null; // or a splash screen
//   return <RootNavigator />;

import { useFonts } from "expo-font";
import {
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { Inter_400Regular, Inter_500Medium } from "@expo-google-fonts/inter";

export function useAppFonts() {
  const [loaded] = useFonts({
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    Inter_400Regular,
    Inter_500Medium,
  });
  return loaded;
}