// src/components/EmptyState.tsx
import React from "react";
import { View } from "react-native";
import { Card, Text, Icon } from "react-native-paper";
import { spacing } from "../design/tokens";

export default function EmptyState({
  title,
  subtitle,
}: { title: string; subtitle?: string }) {
  return (
    <Card style={{ marginTop: spacing.md }}>
      <Card.Content style={{ alignItems: "center", paddingVertical: 24, gap: 8 }}>
        <Icon source="clock-outline" size={40} />
        <Text variant="titleMedium">{title}</Text>
        {subtitle ? (
          <Text style={{ opacity: 0.7, textAlign: "center" }}>{subtitle}</Text>
        ) : null}
      </Card.Content>
    </Card>
  );
}
