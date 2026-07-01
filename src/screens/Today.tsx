// src/screens/Today.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { View, FlatList, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Card, Text, ActivityIndicator } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context"; // ✅ safe area

import { getDoses, getMeds, updateDoseStatus } from "../lib/storage";
import type { Dose } from "../lib/types";
import StatCard from "../components/StatCard";
import DoseCard from "../components/DoseCard";
import CameraCapture from "../components/CameraCapture"; // ✅ added
import tw from "../lib/tw";

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}
function isWithinNextHours(iso: string, hours: number) {
  const t = new Date(iso).getTime();
  const now = Date.now();
  return t >= now && t <= now + hours * 3600_000;
}

export default function Today() {
  const [doses, setDoses] = useState<Dose[]>([]);
  const [medNames, setMedNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const [ds, meds] = await Promise.all([getDoses(), getMeds()]);

      const safeDoses = (Array.isArray(ds) ? ds : [])
        .slice()
        .sort((a, b) => a.whenISO.localeCompare(b.whenISO));
      const safeMeds = Array.isArray(meds) ? meds : [];

      setDoses(safeDoses);
      setMedNames(Object.fromEntries(safeMeds.map((m) => [m.medId, m.name])));
    } catch (e) {
      console.error("[DEBUG] refresh failed:", e);
      setError("Could not load your doses. Pull to refresh to try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  useEffect(() => { refresh(); }, [refresh]);

  const todays = useMemo(() => doses.filter((d) => isToday(d.whenISO)), [doses]);
  const upcoming24h = useMemo(
    () => doses.filter((d) => isWithinNextHours(d.whenISO, 24)),
    [doses]
  );
  const visible = todays.length ? todays : upcoming24h;

  const takenCount = visible.filter((d) => d.status === "taken").length;
  const adherence = visible.length
    ? Math.round((takenCount / visible.length) * 100)
    : 0;

  async function mark(d: Dose, status: "taken" | "missed") {
    try {
      await updateDoseStatus(d.doseId, status);
    } finally {
      refresh();
    }
  }

  if (loading) {
    return (
      <SafeAreaView edges={["top"]} style={tw`flex-1 bg-bg`}>
        <View style={tw`flex-1 items-center justify-center px-4`}>
          <ActivityIndicator />
          <Text style={tw`mt-2 text-text`}>Loading your doses…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={tw`flex-1 bg-bg`}>
      <View style={tw`flex-1 px-4 pt-2`}>
        {error && (
          <Card style={tw`rounded-xl bg-card mb-4 border border-border`}>
            <Card.Content>
              <Text variant="titleSmall" style={tw`text-text`}>
                Something went wrong
              </Text>
              <Text style={tw`mt-2 text-mutetext`}>{error}</Text>
            </Card.Content>
          </Card>
        )}

        {/* Adherence card */}
        <View style={tw`rounded-xl bg-card mb-4 p-4 border border-border shadow`}>
          <StatCard
            label={todays.length ? "Today’s adherence" : "Next 24h adherence"}
            value={adherence}
          />
        </View>

        

        {/* Doses list */}
        <FlatList
          data={visible}
          keyExtractor={(d) => d.doseId}
          renderItem={({ item }) => (
            <DoseCard
              medName={medNames[item.medId] || "Medication"}
              dose={item}
              onTaken={() => mark(item, "taken")}
              onMissed={() => mark(item, "missed")}
            />
          )}
          ListEmptyComponent={
            <View style={tw`rounded-xl bg-card mt-4 p-6 items-center border border-border`}>
              <Text style={tw`text-text text-base`}>No doses to show</Text>
              <Text style={tw`text-mutetext text-center mt-1`}>
                Use the Add tab below to schedule your first dose.
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                refresh();
              }}
            />
          }
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      </View>
    </SafeAreaView>
  );
}
