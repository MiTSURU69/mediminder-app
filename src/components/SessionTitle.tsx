import React from "react";
import { Text } from "react-native-paper";

export default function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text variant="titleMedium" style={{ fontFamily: "Inter_600SemiBold" }}>{children}</Text>;
}
