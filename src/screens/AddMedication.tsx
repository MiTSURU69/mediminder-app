// src/screens/AddMedication.tsx
import { upsertMedByName, appendDoses, resetAll, seedSample } from "../lib/storage";
import type { Dose, DoseSlot } from "../lib/types";
import * as React from "react";
import { useState, useMemo, useEffect } from "react";
import {
  View,
  Platform,
  ScrollView,
  Text,
  TextInput,
  KeyboardAvoidingView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";

import { scheduleMany } from "../lib/notifications";
import { COLORS, FONTS, RADIUS } from "../theme/colors";

// --- helpers (unchanged logic) ---
function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function timeKey(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function uniq<T>(arr: T[], key: (x: T) => string) {
  const seen = new Set<string>();
  return arr.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
function parseTimeString(hhmm: string): Date | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  const d = new Date();
  d.setHours(parseInt(match[1], 10), parseInt(match[2], 10), 0, 0);
  return d;
}
function makeTime(h: number, m = 0): Date {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}
function suggestTimesFromFrequency(frequency: string): { times: Date[]; isAsNeeded: boolean } {
  const f = (frequency || "").toLowerCase();
  if (/\bsos\b|as needed|prn|if needed|whenever needed/.test(f)) return { times: [], isAsNeeded: true };
  if (/once a week|weekly/.test(f)) return { times: [makeTime(9, 0)], isAsNeeded: false };
  if (/four times|4 times|qid/.test(f)) return { times: [makeTime(8, 0), makeTime(12, 0), makeTime(16, 0), makeTime(20, 0)], isAsNeeded: false };
  if (/thrice|three times|3 times|tid/.test(f)) return { times: [makeTime(8, 0), makeTime(14, 0), makeTime(20, 0)], isAsNeeded: false };
  if (/twice|two times|2 times|bid/.test(f)) return { times: [makeTime(8, 0), makeTime(20, 0)], isAsNeeded: false };
  if (/once a day|once daily|1 time|od\b/.test(f)) return { times: [makeTime(9, 0)], isAsNeeded: false };
  return { times: [makeTime(9, 0)], isAsNeeded: false };
}
function parseDurationToDates(duration: string, isWeekly: boolean): Date[] {
  const match = /(\d+)\s*day/i.exec(duration || "");
  const numDays = match ? parseInt(match[1], 10) : (isWeekly ? 1 : 7);
  const out: Date[] = [];
  for (let i = 0; i < numDays; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    out.push(d);
  }
  return out;
}

type ScannedMedicine = {
  medicine: string;
  dosage: string;
  frequency: string;
  timing: string[];
  duration: string;
};
type MedDraft = {
  key: string;
  name: string;
  dosage: string;
  frequency: string;
  dates: Date[];
  times: Date[];
  asNeeded: boolean;
  showDatePicker: boolean;
  showTimePicker: boolean;
};
function buildDraftFromScanned(med: ScannedMedicine, idx: number): MedDraft {
  const explicitTimes = (med.timing || []).map(parseTimeString).filter((d): d is Date => d !== null);
  const isWeekly = /once a week|weekly/i.test(med.frequency || "");
  let times: Date[];
  let asNeeded = false;
  if (explicitTimes.length > 0) {
    times = explicitTimes;
  } else {
    const suggestion = suggestTimesFromFrequency(med.frequency);
    times = suggestion.times;
    asNeeded = suggestion.isAsNeeded;
  }
  const dates = asNeeded ? [new Date()] : parseDurationToDates(med.duration, isWeekly);
  return {
    key: `${med.medicine}-${idx}`,
    name: med.medicine || "",
    dosage: med.dosage || "",
    frequency: med.frequency || "",
    dates,
    times,
    asNeeded,
    showDatePicker: false,
    showTimePicker: false,
  };
}

// --- small reusable pieces, self-contained so this file has no external
// styling dependencies (react-native-paper / tw / PrimaryButton removed) ---

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function LabeledInput(props: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  autoCapitalize?: "none" | "words" | "sentences" | "characters";
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        autoCapitalize={props.autoCapitalize ?? "sentences"}
        placeholder={props.placeholder}
        placeholderTextColor={COLORS.faint}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.fieldInput, focused && styles.fieldInputFocused]}
      />
    </View>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
      {onRemove && (
        <TouchableOpacity onPress={onRemove} hitSlop={8} style={styles.chipRemove}>
          <MaterialCommunityIcons name="close" size={12} color={COLORS.muted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function AddChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.addChip} onPress={onPress} activeOpacity={0.7}>
      <MaterialCommunityIcons name="plus" size={13} color={COLORS.accent} />
      <Text style={styles.addChipText}>{label}</Text>
    </TouchableOpacity>
  );
}

function Btn({
  children,
  onPress,
  variant = "primary",
  disabled,
  loading,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: "primary" | "outline" | "text" | "danger-text";
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={() => {
        if (disabled || loading) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.();
      }}
      activeOpacity={0.8}
      disabled={disabled || loading}
      style={[
        variant === "primary" && styles.btnPrimary,
        variant === "outline" && styles.btnOutline,
        variant === "text" && styles.btnText,
        variant === "danger-text" && styles.btnDangerText,
        (disabled || loading) && { opacity: 0.5 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#fff" : COLORS.accent} size="small" />
      ) : (
        <Text
          style={[
            variant === "primary" && styles.btnPrimaryText,
            variant === "outline" && styles.btnOutlineText,
            variant === "text" && styles.btnTextText,
            variant === "danger-text" && styles.btnDangerTextText,
          ]}
        >
          {children}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export default function AddMedication({ navigation, route }: { navigation?: any; route?: any }) {
  const [patientName, setPatientName] = useState("");
  const [name, setName] = useState("");
  const [dates, setDates] = useState<Date[]>([]);
  const [times, setTimes] = useState<Date[]>([]);

  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);

  const [dateDraft, setDateDraft] = useState<Date>(new Date());
  const [timeDraft, setTimeDraft] = useState<Date>(new Date());

  const [scannedDrafts, setScannedDrafts] = useState<MedDraft[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const incoming: ScannedMedicine[] | undefined = route?.params?.scannedMedicines;
    if (incoming && incoming.length > 0) {
      setScannedDrafts(incoming.map(buildDraftFromScanned));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params?.scannedMedicines]);

  const updateDraft = (key: string, patch: Partial<MedDraft>) => {
    setScannedDrafts((list) => (list ? list.map((d) => (d.key === key ? { ...d, ...patch } : d)) : list));
  };
  const removeDraftDate = (key: string, idx: number) => {
    setScannedDrafts((list) =>
      list ? list.map((d) => (d.key === key ? { ...d, dates: d.dates.filter((_, i) => i !== idx) } : d)) : list
    );
  };
  const removeDraftTime = (key: string, idx: number) => {
    setScannedDrafts((list) =>
      list ? list.map((d) => (d.key === key ? { ...d, times: d.times.filter((_, i) => i !== idx) } : d)) : list
    );
  };
  const addDraftDate = (key: string, d: Date) => {
    setScannedDrafts((list) => (list ? list.map((x) => (x.key === key ? { ...x, dates: [...x.dates, d] } : x)) : list));
  };
  const addDraftTime = (key: string, t: Date) => {
    setScannedDrafts((list) => (list ? list.map((x) => (x.key === key ? { ...x, times: [...x.times, t] } : x)) : list));
  };
  const removeDraftEntirely = (key: string) => {
    setScannedDrafts((list) => (list ? list.filter((d) => d.key !== key) : list));
  };

  const sortedDates = useMemo(() => uniq([...dates].sort((a, b) => a.getTime() - b.getTime()), toYMD), [dates]);
  const sortedTimes = useMemo(() => uniq([...times].sort((a, b) => a.getTime() - b.getTime()), timeKey), [times]);

  const handleDateChange = (_evt: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") setShowDate(false);
    if (selected) {
      setDateDraft(selected);
      setDates((arr) => [...arr, selected]);
    }
  };
  const handleTimeChange = (_evt: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") setShowTime(false);
    if (selected) {
      setTimeDraft(selected);
      setTimes((arr) => [...arr, selected]);
    }
  };

  const onSave = async () => {
    if (!patientName.trim() || !name.trim() || sortedDates.length === 0 || sortedTimes.length === 0) return;
    const med = await upsertMedByName({ name, pattern: "custom" });
    const newDoses: Dose[] = sortedDates.flatMap((d) =>
      sortedTimes.map((t) => {
        const when = new Date(d);
        when.setHours(t.getHours(), t.getMinutes(), 0, 0);
        return {
          doseId: `${med.medId}-${when.toISOString()}`,
          medId: med.medId,
          whenISO: when.toISOString(),
          slot: "custom" as DoseSlot,
          status: "scheduled",
        };
      })
    );
    await appendDoses(newDoses);
    const notificationTitlePrefix = patientName.trim() ? `${patientName.trim()} — ${med.name}` : med.name;
    await scheduleMany(newDoses, notificationTitlePrefix);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    navigation?.goBack?.();
  };

  const onSaveAllScanned = async () => {
    if (!scannedDrafts || scannedDrafts.length === 0) return;
    if (!patientName.trim()) return;
    setSaving(true);
    try {
      for (const draft of scannedDrafts) {
        if (!draft.name.trim()) continue;
        const uniqueDates = uniq([...draft.dates].sort((a, b) => a.getTime() - b.getTime()), toYMD);
        const uniqueTimes = uniq([...draft.times].sort((a, b) => a.getTime() - b.getTime()), timeKey);

        if (draft.asNeeded && uniqueTimes.length === 0) {
          await upsertMedByName({ name: draft.name, pattern: "as-needed" });
          continue;
        }
        if (uniqueDates.length === 0 || uniqueTimes.length === 0) continue;

        const med = await upsertMedByName({ name: draft.name, pattern: "custom" });
        const newDoses: Dose[] = uniqueDates.flatMap((d) =>
          uniqueTimes.map((t) => {
            const when = new Date(d);
            when.setHours(t.getHours(), t.getMinutes(), 0, 0);
            return {
              doseId: `${med.medId}-${when.toISOString()}`,
              medId: med.medId,
              whenISO: when.toISOString(),
              slot: "custom" as DoseSlot,
              status: "scheduled",
            };
          })
        );
        await appendDoses(newDoses);
        const notificationTitlePrefix = `${patientName.trim()} — ${med.name}`;
        await scheduleMany(newDoses, notificationTitlePrefix);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setScannedDrafts(null);
      navigation?.goBack?.();
    } finally {
      setSaving(false);
    }
  };

  const onReset = async () => { await resetAll(); };
  const onSeed = async () => { await seedSample(); };

  const canSave = patientName.trim().length > 0 && name.trim().length > 0 && sortedDates.length > 0 && sortedTimes.length > 0;
  const canSaveAll = scannedDrafts !== null && scannedDrafts.length > 0 && patientName.trim().length > 0;

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: "padding", android: undefined })} style={{ flex: 1, backgroundColor: COLORS.paper }}>
      <SafeAreaView edges={["left", "right"]} style={{ backgroundColor: COLORS.paper }}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.screenTitle}>
              {scannedDrafts ? "Review scan" : "Add medication"}
            </Text>
            <Text style={styles.screenSubtitle}>
              {scannedDrafts ? `${scannedDrafts.length} medicine${scannedDrafts.length === 1 ? "" : "s"} detected` : "Schedule a new dose"}
            </Text>
          </View>
          <View style={styles.topBarActions}>
            <TouchableOpacity onPress={onSeed} style={styles.iconGhostBtn} hitSlop={8}>
              <MaterialCommunityIcons name="autorenew" size={16} color={COLORS.muted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onReset} style={styles.iconGhostBtn} hitSlop={8}>
              <MaterialCommunityIcons name="backup-restore" size={16} color={COLORS.muted} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        {scannedDrafts !== null ? (
          // ===== SCANNED PRESCRIPTION REVIEW =====
          <View style={{ paddingHorizontal: 20 }}>
            <SectionLabel>Patient</SectionLabel>
            <LabeledInput
              label="Patient name"
              value={patientName}
              onChangeText={setPatientName}
              autoCapitalize="words"
              placeholder="Applies to every medicine below"
            />

            <SectionLabel>Medicines</SectionLabel>
            {scannedDrafts.map((draft) => (
              <View key={draft.key} style={styles.medCard}>
                <View style={styles.medCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.medCardName}>{draft.name}</Text>
                    {!!draft.dosage && <Text style={styles.medCardDosage}>{draft.dosage}</Text>}
                  </View>
                  <TouchableOpacity onPress={() => removeDraftEntirely(draft.key)} hitSlop={8}>
                    <MaterialCommunityIcons name="trash-can-outline" size={18} color={COLORS.skip} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.medCardFrequency}>
                  {draft.frequency || "Frequency unclear"}
                  {draft.asNeeded ? " · as needed" : ""}
                </Text>

                <Text style={styles.miniLabel}>
                  {draft.asNeeded ? "Times (optional)" : "Times"}
                </Text>
                <View style={styles.chipRow}>
                  {draft.times.map((t, idx) => (
                    <Chip key={`${timeKey(t)}-${idx}`} label={timeKey(t)} onRemove={() => removeDraftTime(draft.key, idx)} />
                  ))}
                  <AddChip label="Time" onPress={() => updateDraft(draft.key, { showTimePicker: true })} />
                </View>
                {draft.showTimePicker && (
                  <DateTimePicker
                    value={new Date()}
                    mode="time"
                    is24Hour
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={(_e, selected) => {
                      if (Platform.OS === "android") updateDraft(draft.key, { showTimePicker: false });
                      if (selected) addDraftTime(draft.key, selected);
                    }}
                  />
                )}

                {!draft.asNeeded && (
                  <>
                    <Text style={styles.miniLabel}>
                      Dates · {draft.dates.length} day{draft.dates.length === 1 ? "" : "s"}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.chipRow}>
                        {draft.dates.map((d, idx) => (
                          <Chip key={`${toYMD(d)}-${idx}`} label={toYMD(d)} onRemove={() => removeDraftDate(draft.key, idx)} />
                        ))}
                        <AddChip label="Date" onPress={() => updateDraft(draft.key, { showDatePicker: true })} />
                      </View>
                    </ScrollView>
                    {draft.showDatePicker && (
                      <DateTimePicker
                        value={new Date()}
                        mode="date"
                        display={Platform.OS === "ios" ? "inline" : "default"}
                        onChange={(_e, selected) => {
                          if (Platform.OS === "android") updateDraft(draft.key, { showDatePicker: false });
                          if (selected) addDraftDate(draft.key, selected);
                        }}
                      />
                    )}
                  </>
                )}
              </View>
            ))}

            <View style={{ marginTop: 8 }}>
              <Btn onPress={onSaveAllScanned} disabled={!canSaveAll} loading={saving}>
                {`Save all (${scannedDrafts.length})`}
              </Btn>
              <View style={{ height: 10 }} />
              <Btn variant="outline" onPress={() => setScannedDrafts(null)}>
                Cancel review
              </Btn>
            </View>
          </View>
        ) : (
          // ===== MANUAL ENTRY =====
          <View style={{ paddingHorizontal: 20 }}>
            <SectionLabel>Patient</SectionLabel>
            <LabeledInput label="Patient name" value={patientName} onChangeText={setPatientName} autoCapitalize="words" />

            <SectionLabel>Medication</SectionLabel>
            <LabeledInput label="Medication name" value={name} onChangeText={setName} autoCapitalize="words" />

            <SectionLabel>Schedule</SectionLabel>

            <Text style={styles.miniLabel}>Dates · {sortedDates.length} selected</Text>
            <View style={styles.chipRow}>
              {sortedDates.map((d, idx) => (
                <Chip key={`${toYMD(d)}-${idx}`} label={toYMD(d)} onRemove={() => setDates((arr) => arr.filter((_, i) => i !== idx))} />
              ))}
              <AddChip label="Add date" onPress={() => setShowDate(true)} />
            </View>

            <Text style={[styles.miniLabel, { marginTop: 18 }]}>Times · {sortedTimes.length} selected</Text>
            <View style={styles.chipRow}>
              {sortedTimes.map((t, idx) => (
                <Chip key={`${timeKey(t)}-${idx}`} label={timeKey(t)} onRemove={() => setTimes((arr) => arr.filter((_, i) => i !== idx))} />
              ))}
              <AddChip label="Add time" onPress={() => setShowTime(true)} />
            </View>

            {showDate && (
              <View style={styles.pickerWrap}>
                <DateTimePicker value={dateDraft} mode="date" display={Platform.OS === "ios" ? "inline" : "default"} onChange={handleDateChange} />
              </View>
            )}
            {showTime && (
              <View style={styles.pickerWrap}>
                <DateTimePicker value={timeDraft} mode="time" is24Hour display={Platform.OS === "ios" ? "spinner" : "default"} onChange={handleTimeChange} />
              </View>
            )}

            <View style={{ marginTop: 28 }}>
              <Btn onPress={onSave} disabled={!canSave}>Save</Btn>
              <View style={{ height: 10 }} />
              <Btn variant="outline" onPress={() => navigation?.goBack?.()}>Cancel</Btn>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.line,
  },
  screenTitle: { fontFamily: FONTS.display, fontSize: 20, color: COLORS.ink },
  screenSubtitle: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, marginTop: 2 },
  topBarActions: { flexDirection: "row" },
  iconGhostBtn: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: "center", justifyContent: "center",
    marginLeft: 6, backgroundColor: COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.line,
  },

  sectionLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: COLORS.faint,
    marginTop: 24,
    marginBottom: 10,
  },

  fieldWrap: { marginBottom: 4 },
  fieldLabel: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, marginBottom: 6 },
  fieldInput: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 15,
    color: COLORS.ink,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.line,
    paddingVertical: 8,
  },
  fieldInputFocused: { borderBottomColor: COLORS.accent },

  miniLabel: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, marginBottom: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: RADIUS.chip,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: { fontFamily: FONTS.bodyMedium, fontSize: 12, color: COLORS.ink },
  chipRemove: { marginLeft: 6 },
  addChip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS.chip,
    borderWidth: 1,
    borderColor: COLORS.accent,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 8,
  },
  addChipText: { fontFamily: FONTS.bodyMedium, fontSize: 12, color: COLORS.accent, marginLeft: 4 },

  pickerWrap: {
    marginTop: 10,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.surface,
    padding: 8,
  },

  medCard: {
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.surface,
    padding: 14,
    marginBottom: 14,
  },
  medCardHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 4 },
  medCardName: { fontFamily: FONTS.displayMedium, fontSize: 16, color: COLORS.ink },
  medCardDosage: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, marginTop: 1 },
  medCardFrequency: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, marginBottom: 12 },

  btnPrimary: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.card,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryText: { fontFamily: FONTS.bodyMedium, color: "#fff", fontSize: 14 },
  btnOutline: {
    borderRadius: RADIUS.card,
    borderWidth: 1.5,
    borderColor: COLORS.line,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  btnOutlineText: { fontFamily: FONTS.bodyMedium, color: COLORS.ink, fontSize: 14 },
  btnText: { paddingVertical: 8, alignItems: "center" },
  btnTextText: { fontFamily: FONTS.bodyMedium, color: COLORS.accent, fontSize: 13 },
  btnDangerText: { paddingVertical: 8, alignItems: "center" },
  btnDangerTextText: { fontFamily: FONTS.bodyMedium, color: COLORS.skip, fontSize: 13 },
});