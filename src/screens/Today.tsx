// src/screens/Today.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  FlatList,
  RefreshControl,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getDoses, getMeds, updateDoseStatus } from "../lib/storage";
import type { Dose } from "../lib/types";
import { COLORS, FONTS } from "../theme/colors";

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
function formatTime(iso: string) {
  return new Date(iso)
    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    .toLowerCase()
    .replace(" ", "");
}
function formatDateHeading() {
  return new Date().toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
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
  const fraction = visible.length ? takenCount / visible.length : 0;

  async function mark(d: Dose, status: "taken" | "missed") {
    try {
      await updateDoseStatus(d.doseId, status);
    } finally {
      refresh();
    }
  }
  async function unmark(d: Dose) {
    try {
      await updateDoseStatus(d.doseId, "scheduled" as any);
    } finally {
      refresh();
    }
  }

  const Header = (
    <View style={styles.header}>
      <Text style={styles.dateHeading}>{formatDateHeading()}</Text>
      <Text style={styles.screenTitle}>
        {todays.length ? "Today's medications" : "Next 24 hours"}
      </Text>

      <View style={styles.progressRow}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(fraction * 100)}%` }]} />
        </View>
        <Text style={styles.progressLabel}>
          {takenCount} of {visible.length} taken
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safe}>
        {Header}
        <View style={styles.centerFill}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    // edges intentionally excludes "top" — the Stack.Navigator header above
    // this screen already reserves the status bar / notch inset. Including
    // "top" here double-counts it and creates a large gap under the header.
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safe}>
      <FlatList
        data={visible}
        keyExtractor={(d) => d.doseId}
        ListHeaderComponent={
          <>
            {Header}
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorTitle}>Something went wrong</Text>
                <Text style={styles.errorBody}>{error}</Text>
              </View>
            )}
          </>
        }
        renderItem={({ item, index }) => {
          const taken = item.status === "taken";
          const missed = item.status === "missed";
          const isLast = index === visible.length - 1;

          return (
            <View style={styles.row}>
              {/* Timeline rail */}
              <View style={styles.railCol}>
                <View
                  style={[
                    styles.dot,
                    taken && styles.dotTaken,
                    missed && styles.dotMissed,
                  ]}
                >
                  {taken && <View style={styles.dotInner} />}
                </View>
                {!isLast && <View style={styles.railLine} />}
              </View>

              {/* Content */}
              <View style={styles.rowContent}>
                <View style={styles.rowTopLine}>
                  <Text style={styles.timeText}>{formatTime(item.whenISO)}</Text>
                  {missed && <Text style={styles.skippedTag}>Skipped</Text>}
                </View>
                <Text style={styles.medName} numberOfLines={1}>
                  {medNames[item.medId] || "Medication"}
                </Text>

                {!taken && !missed && (
                  <View style={styles.actionsRow}>
                    <TouchableOpacity onPress={() => mark(item, "taken")} hitSlop={8}>
                      <Text style={styles.actionTaken}>Mark taken</Text>
                    </TouchableOpacity>
                    <Text style={styles.actionDivider}>·</Text>
                    <TouchableOpacity onPress={() => mark(item, "missed")} hitSlop={8}>
                      <Text style={styles.actionSkip}>Skip</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {(taken || missed) && (
                  <TouchableOpacity onPress={() => unmark(item)} hitSlop={8}>
                    <Text style={styles.actionUndo}>Undo</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Nothing scheduled</Text>
            <Text style={styles.emptyBody}>
              Use the Add tab to schedule your first dose.
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={COLORS.accent}
            onRefresh={() => {
              setRefreshing(true);
              refresh();
            }}
          />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.paper },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.line,
    marginBottom: 4,
  },
  dateHeading: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.muted,
    marginBottom: 2,
  },
  screenTitle: {
    fontFamily: FONTS.display,
    fontSize: 22,
    color: COLORS.ink,
    marginBottom: 14,
  },
  progressRow: { flexDirection: "row", alignItems: "center" },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.line,
    overflow: "hidden",
    marginRight: 10,
  },
  progressFill: {
    height: 3,
    backgroundColor: COLORS.accent,
    borderRadius: 2,
  },
  progressLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
    color: COLORS.muted,
  },

  // Error
  errorBox: {
    marginHorizontal: 20,
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: COLORS.skipSoft,
  },
  errorTitle: { fontFamily: FONTS.bodyMedium, color: COLORS.ink, marginBottom: 2 },
  errorBody: { fontFamily: FONTS.body, color: COLORS.muted, fontSize: 13 },

  // Timeline row
  row: {
    flexDirection: "row",
    paddingHorizontal: 20,
  },
  railCol: {
    width: 22,
    alignItems: "center",
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLORS.faint,
    marginTop: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  dotTaken: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent,
  },
  dotMissed: {
    borderColor: COLORS.skip,
  },
  dotInner: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.surface,
  },
  railLine: {
    flex: 1,
    width: 1.5,
    backgroundColor: COLORS.line,
    marginTop: 4,
  },
  rowContent: {
    flex: 1,
    paddingVertical: 14,
    paddingLeft: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.line,
  },
  rowTopLine: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  timeText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
    color: COLORS.muted,
    letterSpacing: 0.2,
  },
  skippedTag: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    color: COLORS.skip,
    marginLeft: 8,
  },
  medName: {
    fontFamily: FONTS.displayMedium,
    fontSize: 16,
    color: COLORS.ink,
    marginBottom: 6,
  },
  actionsRow: { flexDirection: "row", alignItems: "center" },
  actionTaken: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.accent,
  },
  actionSkip: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.skip,
  },
  actionDivider: {
    color: COLORS.faint,
    marginHorizontal: 8,
  },
  actionUndo: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.faint,
    textDecorationLine: "underline",
  },

  // Empty state
  emptyBox: {
    marginHorizontal: 20,
    marginTop: 40,
    alignItems: "flex-start",
  },
  emptyTitle: {
    fontFamily: FONTS.displayMedium,
    fontSize: 16,
    color: COLORS.ink,
    marginBottom: 4,
  },
  emptyBody: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.muted,
  },
});