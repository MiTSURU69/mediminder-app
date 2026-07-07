// src/components/PrescriptionProcessor.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  Image,
  FlatList,
  Alert,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import TextRecognition from "react-native-text-recognition";
import * as Notifications from "expo-notifications";
import { format } from "date-fns";
import { parsePrescriptionText, ParsedMed } from "../lib/prescriptionParser";

export default function PrescriptionProcessor({
  imageUri,
  onClose,
  onScheduled,
}: {
  imageUri: string;
  onClose?: () => void;
  onScheduled?: (scheduledItems: { med: ParsedMed; notificationId: string }[]) => void;
}) {
  const [ocrText, setOcrText] = useState<string>("");
  const [parsed, setParsed] = useState<ParsedMed[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState<string>("");

  useEffect(() => {
    console.log("[PrescriptionProcessor] mounted. imageUri:", imageUri);
    (async () => {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== "granted") {
        await Notifications.requestPermissionsAsync();
      }
    })();
  }, []);

  useEffect(() => {
    if (imageUri) {
      console.log("[PrescriptionProcessor] imageUri changed — running OCR:", imageUri);
      runOcr(imageUri);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUri]);

  async function runOcr(uri: string) {
    setLoading(true);
    setOcrText("");
    setParsed([]);
    try {
      console.log("[PrescriptionProcessor] starting TextRecognition.recognize for:", uri);
      const lines: string[] = await TextRecognition.recognize(uri);
      console.log("[PrescriptionProcessor] OCR lines:", lines);
      const text = lines.join("\n");
      setOcrText(text);

      const meds = parsePrescriptionText(text);
      console.log("[PrescriptionProcessor] parsed meds:", meds);
      setParsed(meds);
      if (!meds || meds.length === 0) {
        Alert.alert("No medicines detected", "OCR found text but couldn't detect medicines. Please edit manually.");
      }
    } catch (err: any) {
      console.error("[PrescriptionProcessor] OCR error:", err);
      // If native module missing, show clear guidance
      if (String(err).toLowerCase().includes("textrecognition") || String(err).toLowerCase().includes("native")) {
        Alert.alert(
          "OCR not available",
          "On-device OCR module is not available. Make sure you built a dev client (expo prebuild / EAS) and installed react-native-text-recognition."
        );
      } else {
        Alert.alert("OCR failed", String(err?.message ?? err));
      }
    } finally {
      setLoading(false);
    }
  }

  // ... rest of component unchanged, scheduleAll etc. (keep as before)
  // for brevity paste the rest of your component here unchanged
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.outer}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Prescription Processor</Text>
          <Button title="Close" onPress={onClose} />
        </View>

        <View style={styles.previewWrap}>
          {imageUri ? <Image source={{ uri: imageUri }} style={styles.preview} /> : <Text>No image</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>OCR Text</Text>
          {loading ? (
            <ActivityIndicator />
          ) : (
            <TextInput
              multiline
              value={ocrText}
              onChangeText={setOcrText}
              style={styles.ocrBox}
              placeholder="OCR text will appear here"
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Parsed Medicines</Text>
          {loading ? (
            <ActivityIndicator />
          ) : parsed && parsed.length > 0 ? (
            <FlatList data={parsed} renderItem={({item,index}) => (
              <View style={styles.medRow} key={String(index)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.medName}>{item.name}</Text>
                  <Text style={styles.medMeta}>{item.dose ?? "Dose not detected"}</Text>
                  <Text style={styles.medMeta}>{item.frequency ?? "Frequency not detected"}</Text>
                </View>
                <View style={styles.medActions}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => { setEditingIndex(index); setEditingText(item.raw ?? item.name); }}>
                    <Text style={styles.actionText}>Edit</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )} keyExtractor={(_,i)=>String(i)} />
          ) : (
            <Text style={styles.mono}>No medicines parsed. Edit OCR text above or add manually.</Text>
          )}
        </View>

        <View style={{ marginTop: 12 }}>
          <Button title="Schedule All (naive mapping)" onPress={async ()=>{ /* call scheduleAll logic from previous file */ Alert.alert("Not implemented in debug build"); }} disabled={loading || !parsed || parsed.length === 0} />
        </View>

        <View style={{ height: 48 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// reuse styles from previous file or paste them here
const styles = StyleSheet.create({
  outer: { flex: 1 },
  container: { padding: 16, paddingBottom: 80 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 18, fontWeight: "700" },
  previewWrap: { alignItems: "center", marginBottom: 12 },
  preview: { width: "100%", height: 280, borderRadius: 8, backgroundColor: "#f3f4f6" },
  section: { marginTop: 8 },
  heading: { fontWeight: "700", marginBottom: 6 },
  ocrBox: { minHeight: 80, borderWidth: 1, borderColor: "#e5e7eb", padding: 8, borderRadius: 6, textAlignVertical: "top" },
  mono: { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", color: "#374151" },
  medRow: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#eee", alignItems: "center" },
  medName: { fontWeight: "700" },
  medMeta: { color: "#6b7280" },
  medRaw: { color: "#9ca3af", marginTop: 6 },
  medActions: { marginLeft: 12, alignItems: "center" },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: "#ccc", marginBottom: 6 },
  actionText: { color: "#374151", fontWeight: "600" },
  editRow: { marginTop: 12 },
  editInput: { borderWidth: 1, borderColor: "#e5e7eb", padding: 8, borderRadius: 6, minHeight: 44 },
});
