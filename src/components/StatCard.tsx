import React from "react";
import { Card, Text, ProgressBar } from "react-native-paper";
import { spacing, shadow } from "../design/tokens";

export default function StatCard({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(1, value / 100));
  return (
    <Card style={{ marginBottom: spacing.md, ...shadow.card }}>
      <Card.Content>
        <Text variant="bodySmall" style={{ opacity: 0.7 }}>{label}</Text>
        <Text variant="displaySmall">{Math.round(pct * 100)}%</Text>
        <ProgressBar progress={pct} style={{ marginTop: spacing.sm }} />
      </Card.Content>
    </Card>
  );
}
