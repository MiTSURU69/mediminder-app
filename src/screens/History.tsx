// src/screens/History.tsx
import React, { useEffect, useMemo, useState } from "react";
import { SectionList, View } from "react-native";
import { Card, Text, Button } from "react-native-paper";
import { getDoses, getMeds, resetAll } from "../lib/storage";
import type { Dose } from "../lib/types";
import AppHeader from "../components/AppHeader";

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function History({ navigation }: any) {
  const [doses, setDoses] = useState<Dose[]>([]);
  const [medNames, setMedNames] = useState<Record<string, string>>({});

  async function load() {
    const [ds, meds] = await Promise.all([getDoses(), getMeds()]);
    setDoses(ds.sort((a, b) => a.whenISO.localeCompare(b.whenISO)));
    setMedNames(Object.fromEntries(meds.map((m) => [m.medId, m.name])));
  }
  useEffect(() => { load(); }, []);

  const sections = useMemo(() => {
    const map = new Map<string, Dose[]>();
    for (const d of doses) {
      const day = ymd(new Date(d.whenISO));
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(d);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([title, data]) => ({ title, data }));
  }, [doses]);

  return (
    <View style={{ flex: 1 }}>
      {/* 👇 only show back arrow if this screen can actually go back (i.e., not opened as a tab) */}
      <AppHeader
        title="All Doses"
        canGoBack={!!navigation?.canGoBack?.()}
        onBack={() => navigation.goBack()}
      />

      <View style={{ flex: 1, padding: 16 }}>
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.doseId}
          renderSectionHeader={({ section: { title } }) => (
            <Text variant="titleMedium" style={{ marginTop: 12 }}>{title}</Text>
          )}
          renderItem={({ item }) => (
            <Card style={{ marginVertical: 6 }}>
              <Card.Title
                title={medNames[item.medId] || item.medId}
                subtitle={`${new Date(item.whenISO).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
              />
              <Card.Content><Text>Status: {item.status}</Text></Card.Content>
            </Card>
          )}
          ListEmptyComponent={
            <Card>
              <Card.Content><Text>No doses yet.</Text></Card.Content>
            </Card>
          }
        />

        <Button
          mode="outlined"
          onPress={async () => { await resetAll(); load(); }}
          style={{ marginTop: 16 }}
          icon="backup-restore"
        >
          Reset Local Data
        </Button>
      </View>
    </View>
  );
}
