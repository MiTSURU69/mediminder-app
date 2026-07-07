// src/screens/History.tsx
import React, { useEffect, useMemo, useState } from "react";
import { SectionList, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { getDoses, getMeds, resetAll } from "../lib/storage";
import type { Dose } from "../lib/types";
import { TAB_BAR_CLEARANCE } from "../lib/layout";
import { COLORS, FONTS } from "../theme/colors";

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function formatTime(iso: string) {
  return new Date(iso)
    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    .toLowerCase()
    .replace(" ", "");
}
function formatSectionHeading(dayKey: string) {
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const isToday = ymd(today) === dayKey;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = ymd(yesterday) === dayKey;

  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

export default function History({ navigation }: any) {
  const [doses, setDoses] = useState<Dose[]>([]);
  const [medNames, setMedNames] = useState<Record<string, string>>({});
  const [resetting, setResetting] = useState(false);

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
      .sort((a, b) => b[0].localeCompare(a[0])) // most recent day first
      .map(([title, data]) => ({ title, data }));
  }, [doses]);

  const canGoBack = !!navigation?.canGoBack?.();

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safe}>
      <View style={styles.header}>
        {canGoBack && (
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8} style={styles.backBtn}>
            <MaterialCommunityIcons name="chevron-left" size={22} color={COLORS.ink} />
          </TouchableOpacity>
        )}
        <View>
          <Text style={styles.title}>History</Text>
          <Text style={styles.subtitle}>{doses.length} logged dose{doses.length === 1 ? "" : "s"}</Text>
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.doseId}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={styles.sectionHeader}>{formatSectionHeading(title)}</Text>
        )}
        renderItem={({ item, index, section }) => {
          const taken = item.status === "taken";
          const missed = item.status === "missed";
          const isLastInSection = index === section.data.length - 1;

          return (
            <View style={styles.row}>
              <View style={styles.railCol}>
                <View style={[styles.dot, taken && styles.dotTaken, missed && styles.dotMissed]}>
                  {taken && <View style={styles.dotInner} />}
                </View>
                {!isLastInSection && <View style={styles.railLine} />}
              </View>
              <View style={styles.rowContent}>
                <View style={styles.rowTopLine}>
                  <Text style={styles.timeText}>{formatTime(item.whenISO)}</Text>
                  <Text
                    style={[
                      styles.statusText,
                      taken && { color: COLORS.accent },
                      missed && { color: COLORS.skip },
                    ]}
                  >
                    {taken ? "Taken" : missed ? "Skipped" : "Scheduled"}
                  </Text>
                </View>
                <Text style={styles.medName} numberOfLines={1}>
                  {medNames[item.medId] || item.medId}
                </Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No doses yet</Text>
            <Text style={styles.emptyBody}>Doses you schedule will show up here once logged.</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 24 }}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
      />

      <TouchableOpacity
        style={styles.resetBtn}
        onPress={async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          setResetting(true);
          try {
            await resetAll();
            await load();
          } finally {
            setResetting(false);
          }
        }}
        disabled={resetting}
      >
        <MaterialCommunityIcons name="backup-restore" size={14} color={COLORS.muted} />
        <Text style={styles.resetBtnText}>{resetting ? "Resetting…" : "Reset local data"}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.paper },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.line,
    marginBottom: 4,
  },
  backBtn: { marginRight: 8, marginLeft: -4 },
  title: { fontFamily: FONTS.display, fontSize: 22, color: COLORS.ink },
  subtitle: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, marginTop: 2 },

  sectionHeader: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: COLORS.faint,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },

  row: { flexDirection: "row", paddingHorizontal: 20 },
  railCol: { width: 22, alignItems: "center" },
  dot: {
    width: 12, height: 12, borderRadius: 6,
    borderWidth: 1.5, borderColor: COLORS.faint,
    marginTop: 18, alignItems: "center", justifyContent: "center",
  },
  dotTaken: { borderColor: COLORS.accent, backgroundColor: COLORS.accent },
  dotMissed: { borderColor: COLORS.skip },
  dotInner: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.surface },
  railLine: { flex: 1, width: 1.5, backgroundColor: COLORS.line, marginTop: 4 },

  rowContent: {
    flex: 1,
    paddingVertical: 12,
    paddingLeft: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.line,
  },
  rowTopLine: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  timeText: { fontFamily: FONTS.bodyMedium, fontSize: 12, color: COLORS.muted },
  statusText: { fontFamily: FONTS.bodyMedium, fontSize: 12, color: COLORS.faint },
  medName: { fontFamily: FONTS.displayMedium, fontSize: 15, color: COLORS.ink },

  emptyBox: { paddingHorizontal: 20, marginTop: 40 },
  emptyTitle: { fontFamily: FONTS.displayMedium, fontSize: 16, color: COLORS.ink, marginBottom: 4 },
  emptyBody: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.muted },

  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginBottom: TAB_BAR_CLEARANCE,
  },
  resetBtnText: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, marginLeft: 6 },
});