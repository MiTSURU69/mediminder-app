// src/screens/AddMedication.tsx
import { upsertMedByName, appendDoses, resetAll, seedSample } from "../lib/storage";
import type { Dose, DoseSlot } from "../lib/types";
import * as React from "react";
import { useState, useMemo, useEffect } from "react";
import {
  View,
  Platform,
  ScrollView,
  Text as RNText,
  KeyboardAvoidingView,
  TouchableOpacity,
} from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Card, TextInput, Text, Checkbox } from "react-native-paper";

import tw from "../lib/tw";
import { softShadow } from "../lib/shadows";
import PrimaryButton from "../components/PrimaryButton";
import { scheduleMany } from "../lib/notifications";

import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

// --- helpers ---
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

// Auto-suggest sensible clock times from a frequency string, when OCR gave no explicit timing.
// Returns { times, isAsNeeded } — isAsNeeded means don't force a schedule (SOS/PRN).
function suggestTimesFromFrequency(frequency: string): { times: Date[]; isAsNeeded: boolean } {
  const f = (frequency || "").toLowerCase();

  if (/\bsos\b|as needed|prn|if needed|whenever needed/.test(f)) {
    return { times: [], isAsNeeded: true };
  }
  if (/once a week|weekly/.test(f)) {
    return { times: [makeTime(9, 0)], isAsNeeded: false };
  }
  if (/four times|4 times|qid/.test(f)) {
    return { times: [makeTime(8, 0), makeTime(12, 0), makeTime(16, 0), makeTime(20, 0)], isAsNeeded: false };
  }
  if (/thrice|three times|3 times|tid/.test(f)) {
    return { times: [makeTime(8, 0), makeTime(14, 0), makeTime(20, 0)], isAsNeeded: false };
  }
  if (/twice|two times|2 times|bid/.test(f)) {
    return { times: [makeTime(8, 0), makeTime(20, 0)], isAsNeeded: false };
  }
  if (/once a day|once daily|1 time|od\b/.test(f)) {
    return { times: [makeTime(9, 0)], isAsNeeded: false };
  }
  // Unknown/unclear frequency — default to a single morning dose, user can edit
  return { times: [makeTime(9, 0)], isAsNeeded: false };
}

// Parse "10 days" into consecutive Dates starting today. Defaults to 7 days if unclear
// (safe editable default — user can add/remove date chips).
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

// Editable draft state for each medicine in the review list
type MedDraft = {
  key: string;
  name: string;
  dosage: string;
  frequency: string;
  dates: Date[];
  times: Date[];
  asNeeded: boolean; // SOS/PRN — excluded from auto-scheduling unless user adds times manually
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

export default function AddMedication({ navigation, route }: { navigation?: any; route?: any }) {
  const insets = useSafeAreaInsets();

  const [patientName, setPatientName] = useState("");
  const [name, setName] = useState("");
  const [dates, setDates] = useState<Date[]>([]);
  const [times, setTimes] = useState<Date[]>([]);

  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);

  const [dateDraft, setDateDraft] = useState<Date>(new Date());
  const [timeDraft, setTimeDraft] = useState<Date>(new Date());

  // --- scanned prescription review state ---
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
    setScannedDrafts((list) =>
      list ? list.map((d) => (d.key === key ? { ...d, ...patch } : d)) : list
    );
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
    setScannedDrafts((list) =>
      list ? list.map((x) => (x.key === key ? { ...x, dates: [...x.dates, d] } : x)) : list
    );
  };
  const addDraftTime = (key: string, t: Date) => {
    setScannedDrafts((list) =>
      list ? list.map((x) => (x.key === key ? { ...x, times: [...x.times, t] } : x)) : list
    );
  };
  const removeDraftEntirely = (key: string) => {
    setScannedDrafts((list) => (list ? list.filter((d) => d.key !== key) : list));
  };

  const sortedDates = useMemo(
    () => uniq([...dates].sort((a, b) => a.getTime() - b.getTime()), toYMD),
    [dates]
  );
  const sortedTimes = useMemo(
    () => uniq([...times].sort((a, b) => a.getTime() - b.getTime()), timeKey),
    [times]
  );

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

  // --- Manual single-medication save (unchanged flow) ---
  const onSave = async () => {
    if (!patientName.trim() || !name.trim() || sortedDates.length === 0 || sortedTimes.length === 0) {
      console.log("[AddMedication] cannot save — missing fields");
      return;
    }
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
    console.log("[AddMedication] saved & scheduled:", med, newDoses);
    navigation?.goBack?.();
  };

  // --- Save ALL scanned medicines at once ---
  const onSaveAllScanned = async () => {
    if (!scannedDrafts || scannedDrafts.length === 0) return;
    if (!patientName.trim()) {
      console.log("[AddMedication] cannot save — missing patient name");
      return;
    }
    setSaving(true);
    try {
      for (const draft of scannedDrafts) {
        if (!draft.name.trim()) continue;
        const uniqueDates = uniq([...draft.dates].sort((a, b) => a.getTime() - b.getTime()), toYMD);
        const uniqueTimes = uniq([...draft.times].sort((a, b) => a.getTime() - b.getTime()), timeKey);

        // Skip scheduling for as-needed meds with no times set — still log the medicine itself
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
      console.log("[AddMedication] all scanned medicines saved & scheduled");
      setScannedDrafts(null);
      navigation?.goBack?.();
    } finally {
      setSaving(false);
    }
  };

  const onReset = async () => { await resetAll(); console.log("[AddMedication] storage reset"); };
  const onSeed  = async () => { await seedSample(); console.log("[AddMedication] storage seeded"); };

  const canSave = patientName.trim().length > 0 && name.trim().length > 0 && sortedDates.length > 0 && sortedTimes.length > 0;
  const canSaveAll = scannedDrafts !== null && scannedDrafts.length > 0 && patientName.trim().length > 0;

  const textColor = (tw.color("text") as string) || "#111827";
  const chipText  = (tw.color("brandDark") as string) || "#0f172a";
  const chipBg    = (tw.color("brandSoft") as string) || "#e2e8f0";
  const borderCol = (tw.color("border") as string) || "#e5e7eb";

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: "padding", android: undefined })}
      style={tw`flex-1 bg-bg`}
    >
      <SafeAreaView edges={["top"]} style={tw`bg-bg`}>
        <View style={[tw`px-4 pb-1 flex-row justify-end gap-2`, { paddingTop: 4 }]}>
          <PrimaryButton mode="outlined" onPressAsync={onReset}>Reset</PrimaryButton>
          <PrimaryButton mode="outlined" onPressAsync={onSeed}>Seed</PrimaryButton>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={tw`flex-grow px-4 pt-2 pb-6`}>
        {scannedDrafts !== null ? (
          // ===== SCANNED PRESCRIPTION REVIEW MODE =====
          <View style={[tw`rounded-2xl bg-card border border-border overflow-hidden p-3`, softShadow]}>
            <Text variant="titleMedium" style={{ color: textColor, marginBottom: 8 }}>
              Review scanned prescription
            </Text>

            <TextInput
              label="Patient name (applies to all medicines below)"
              value={patientName}
              onChangeText={setPatientName}
              autoCapitalize="words"
              style={tw`mb-3`}
              mode="outlined"
              outlineStyle={{ borderColor: borderCol }}
              theme={{
                colors: {
                  primary: (tw.color("brand") as string) || "#2563eb",
                  outline: borderCol,
                  onSurface: textColor,
                  onSurfaceVariant: textColor,
                },
              }}
            />

            {scannedDrafts.map((draft) => (
              <View
                key={draft.key}
                style={[tw`rounded-xl p-3 mb-3`, { backgroundColor: chipBg, borderColor: borderCol, borderWidth: 1 }]}
              >
                <View style={tw`flex-row justify-between items-center mb-2`}>
                  <RNText style={{ color: chipText, fontWeight: "600", fontSize: 15 }}>
                    {draft.name} {draft.dosage ? `(${draft.dosage})` : ""}
                  </RNText>
                  <PrimaryButton mode="text" onPress={() => removeDraftEntirely(draft.key)}>
                    Remove
                  </PrimaryButton>
                </View>

                <RNText style={{ color: chipText, opacity: 0.7, fontSize: 12, marginBottom: 8 }}>
                  Frequency: {draft.frequency || "unclear"}
                  {draft.asNeeded ? " — as needed, no auto-schedule" : ""}
                </RNText>

                {/* Times */}
                <RNText style={{ color: chipText, fontSize: 12, marginBottom: 4 }}>
                  {draft.asNeeded ? "Times (optional — leave empty if truly as-needed)" : "Times"}
                </RNText>
                <View style={tw`flex-row flex-wrap items-center mb-2`}>
                  {draft.times.map((t, idx) => (
                    <View
                      key={`${timeKey(t)}-${idx}`}
                      style={[tw`flex-row items-center rounded-full px-2 py-1 mr-2 mb-2`, { backgroundColor: "#fff", borderColor: borderCol, borderWidth: 1 }]}
                    >
                      <RNText style={[tw`mr-1`, { color: chipText, fontSize: 12 }]}>{timeKey(t)}</RNText>
                      <TouchableOpacity onPress={() => removeDraftTime(draft.key, idx)}>
                        <RNText style={{ color: chipText, fontSize: 12 }}>✕</RNText>
                      </TouchableOpacity>
                    </View>
                  ))}
                  <PrimaryButton mode="outlined" onPress={() => updateDraft(draft.key, { showTimePicker: true })}>
                    + Time
                  </PrimaryButton>
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

                {/* Dates */}
                {!draft.asNeeded && (
                  <>
                    <RNText style={{ color: chipText, fontSize: 12, marginBottom: 4, marginTop: 4 }}>
                      Dates ({draft.dates.length} day{draft.dates.length === 1 ? "" : "s"})
                    </RNText>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`mb-2`}>
                      {draft.dates.map((d, idx) => (
                        <View
                          key={`${toYMD(d)}-${idx}`}
                          style={[tw`flex-row items-center rounded-full px-2 py-1 mr-2`, { backgroundColor: "#fff", borderColor: borderCol, borderWidth: 1 }]}
                        >
                          <RNText style={[tw`mr-1`, { color: chipText, fontSize: 12 }]}>{toYMD(d)}</RNText>
                          <TouchableOpacity onPress={() => removeDraftDate(draft.key, idx)}>
                            <RNText style={{ color: chipText, fontSize: 12 }}>✕</RNText>
                          </TouchableOpacity>
                        </View>
                      ))}
                      <PrimaryButton mode="outlined" onPress={() => updateDraft(draft.key, { showDatePicker: true })}>
                        + Date
                      </PrimaryButton>
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

            <PrimaryButton onPressAsync={onSaveAllScanned} disabled={!canSaveAll || saving}>
              {saving ? "Saving..." : `Save All (${scannedDrafts.length})`}
            </PrimaryButton>
            <View style={tw`mt-2`} />
            <PrimaryButton mode="outlined" onPress={() => setScannedDrafts(null)}>
              Cancel scan review
            </PrimaryButton>
          </View>
        ) : (
          // ===== MANUAL SINGLE-MEDICATION MODE (unchanged) =====
          <View style={[tw`rounded-2xl bg-card border border-border overflow-hidden`, softShadow]}>
            <Card mode="elevated" style={tw`bg-card`}>
              <Card.Content>
                <Text variant="titleMedium" style={[tw`mb-2`, { color: textColor }]}>
                  Add Medication
                </Text>

                <Text variant="titleSmall" style={{ color: textColor, opacity: 0.8, marginBottom: 4 }}>
                  Patient name
                </Text>
                <TextInput
                  label="Patient name"
                  value={patientName}
                  onChangeText={setPatientName}
                  autoCapitalize="words"
                  style={tw`mb-3`}
                  mode="outlined"
                  outlineStyle={{ borderColor: borderCol }}
                  theme={{
                    colors: {
                      primary: (tw.color("brand") as string) || "#2563eb",
                      outline: borderCol,
                      onSurface: textColor,
                      onSurfaceVariant: textColor,
                    },
                  }}
                />

                <TextInput
                  label="Medication name"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  style={tw`mb-3`}
                  mode="outlined"
                  outlineStyle={{ borderColor: borderCol }}
                  theme={{
                    colors: {
                      primary: (tw.color("brand") as string) || "#2563eb",
                      outline: borderCol,
                      onSurface: textColor,
                      onSurfaceVariant: textColor,
                    },
                  }}
                />

                <Text variant="titleSmall" style={{ color: textColor, opacity: 0.8, marginBottom: 4 }}>
                  Select dates
                </Text>
                <PrimaryButton mode="outlined" onPress={() => setShowDate(true)}>
                  Add Date
                </PrimaryButton>
                <View style={tw`mt-2`}>
                  <ScrollView nestedScrollEnabled style={tw`max-h-40`} contentContainerStyle={tw`flex-row flex-wrap`}>
                    {sortedDates.map((d, idx) => (
                      <View
                        key={`${toYMD(d)}-${idx}`}
                        style={[tw`flex-row items-center rounded-full px-3 py-2 mr-2 mb-2`, { backgroundColor: chipBg, borderColor: borderCol, borderWidth: 1 }]}
                      >
                        <RNText style={[tw`mr-2`, { color: chipText }]}>{toYMD(d)}</RNText>
                        <PrimaryButton mode="text" onPress={() => setDates((arr) => arr.filter((_, i) => i !== idx))}>
                          ✕
                        </PrimaryButton>
                      </View>
                    ))}
                  </ScrollView>
                </View>

                <Text variant="titleSmall" style={{ color: textColor, opacity: 0.8, marginTop: 16, marginBottom: 4 }}>
                  Select times
                </Text>
                <PrimaryButton mode="outlined" onPress={() => setShowTime(true)}>
                  Add Time
                </PrimaryButton>
                <View style={tw`mt-2`}>
                  <ScrollView nestedScrollEnabled style={tw`max-h-40`} contentContainerStyle={tw`flex-row flex-wrap`}>
                    {sortedTimes.map((t, idx) => (
                      <View
                        key={`${timeKey(t)}-${idx}`}
                        style={[tw`flex-row items-center rounded-full px-3 py-2 mr-2 mb-2`, { backgroundColor: chipBg, borderColor: borderCol, borderWidth: 1 }]}
                      >
                        <RNText style={[tw`mr-2`, { color: chipText }]}>{timeKey(t)}</RNText>
                        <PrimaryButton mode="text" onPress={() => setTimes((arr) => arr.filter((_, i) => i !== idx))}>
                          ✕
                        </PrimaryButton>
                      </View>
                    ))}
                  </ScrollView>
                </View>

                {showDate && (
                  <View style={[tw`mt-2 rounded-xl p-2`, { backgroundColor: "#fff", borderColor: borderCol, borderWidth: 1 }]}>
                    <DateTimePicker
                      value={dateDraft}
                      mode="date"
                      display={Platform.OS === "ios" ? "inline" : "default"}
                      onChange={handleDateChange}
                      {...(Platform.OS === "ios" ? { themeVariant: "light" as const, textColor } : {})}
                    />
                  </View>
                )}

                {showTime && (
                  <View style={[tw`mt-2 rounded-xl p-2`, { backgroundColor: "#fff", borderColor: borderCol, borderWidth: 1 }]}>
                    <DateTimePicker
                      value={timeDraft}
                      mode="time"
                      is24Hour
                      display={Platform.OS === "ios" ? "spinner" : "default"}
                      onChange={handleTimeChange}
                      {...(Platform.OS === "ios" ? { themeVariant: "light" as const, textColor } : {})}
                    />
                  </View>
                )}

                <View style={tw`mt-5`}>
                  <PrimaryButton onPressAsync={onSave} disabled={!canSave}>
                    Save
                  </PrimaryButton>
                  <View style={tw`mt-2`} />
                  <PrimaryButton mode="outlined" onPress={() => navigation?.goBack?.()}>
                    Cancel
                  </PrimaryButton>
                </View>
              </Card.Content>
            </Card>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}