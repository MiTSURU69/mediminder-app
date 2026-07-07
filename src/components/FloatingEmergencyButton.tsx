// src/components/FloatingEmergencyButton.tsx
import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Animated,
  Easing,
  Linking,
  Alert,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

/**
 * FloatingEmergencyButton
 *
 * - Small floating icon with badge.
 * - Tap to open a compact modal (confirm sheet).
 * - Long-press Confirm to actually "send" (prevents accidental presses).
 *
 * Props:
 *  - contactPhone?: string (e.g. "+911234567890") -- used by Call / SMS actions
 *  - badgeCount?: number
 *  - onSendAlert?: (payload) => Promise<void> // optional hook to call your backend / push service
 *
 * Usage:
 *  <FloatingEmergencyButton contactPhone="+911234567890" badgeCount={0} onSendAlert={yourHandler} />
 *
 * Note:
 *  - Uses Linking to open dialer / SMS. No special SMS permissions required.
 *  - If you want to actually send SMS in background, you'll need a server or native library.
 */

export default function FloatingEmergencyButton({
  contactPhone,
  badgeCount = 0,
  onSendAlert,
}: {
  contactPhone?: string;
  badgeCount?: number;
  onSendAlert?: (payload: { reason?: string; timestamp: number }) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;

  // continuous gentle pulse for the icon
  const startPulse = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();
  }, [pulse]);

  // start pulse once when component mounts
  React.useEffect(() => {
    startPulse();
  }, [startPulse]);

  const openSheet = useCallback(() => setOpen(true), []);
  const closeSheet = useCallback(() => setOpen(false), []);

  const handleCall = useCallback(async () => {
    if (!contactPhone) {
      Alert.alert("No contact", "No emergency contact configured.");
      return;
    }
    const url = `tel:${contactPhone}`;
    try {
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert("Call failed", "Could not open dialer.");
    }
  }, [contactPhone]);

  const handleSms = useCallback(async () => {
    if (!contactPhone) {
      Alert.alert("No contact", "No emergency contact configured.");
      return;
    }
    // prefill message using the app's context (customize as needed)
    const body = encodeURIComponent("I need help. Please check on me. — Sent from Bayman");
    // sms URI differs on iOS vs Android for body
    const separator = Platform.OS === "ios" ? "&" : "?";
    const url = `sms:${contactPhone}${separator}body=${body}`;
    try {
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert("SMS failed", "Could not open SMS composer.");
    }
  }, [contactPhone]);

  const doSendAlert = useCallback(
    async (reason?: string) => {
      setSending(true);
      const payload = { reason: reason ?? "User triggered emergency", timestamp: Date.now() };

      try {
        if (onSendAlert) {
          await onSendAlert(payload);
        } else {
          // default behavior: open SMS if a phone is set, otherwise just show confirmation
          if (contactPhone) {
            await handleSms();
          } else {
            Alert.alert("Alert", "No handler configured — please set onSendAlert or contactPhone.");
          }
        }
        Alert.alert("Alert sent", "Emergency alert action completed.");
      } catch (err: any) {
        console.error("send alert error:", err);
        Alert.alert("Failed", String(err?.message ?? err));
      } finally {
        setSending(false);
        closeSheet();
      }
    },
    [contactPhone, handleSms, onSendAlert]
  );

  // Long-press handler: require 1 second press to confirm
  const onConfirmLongPress = useCallback(() => {
    doSendAlert();
  }, [doSendAlert]);

  return (
    <>
      <Animated.View style={[styles.fabWrap, { transform: [{ scale: pulse }] }]}>
        <TouchableOpacity activeOpacity={0.9} style={styles.fab} onPress={openSheet}>
          <MaterialCommunityIcons name="shield-alert-outline" size={26} color="#fff" />
          {badgeCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badgeCount > 99 ? "99+" : String(badgeCount)}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </Animated.View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={closeSheet}>
        <View style={styles.modalBg}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Emergency</Text>
            <Text style={styles.sheetSubtitle}>Quick actions — long press Confirm to send</Text>

            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={handleCall}>
                <MaterialCommunityIcons name="phone" size={20} color="#065f46" />
                <Text style={styles.actionText}>Call</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionBtn} onPress={handleSms}>
                <MaterialCommunityIcons name="message-text" size={20} color="#065f46" />
                <Text style={styles.actionText}>SMS</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnDisabled]}
                onPress={() => {
                  Alert.alert("Planned", "Other channels (whatsapp/email) can be added here.");
                }}
              >
                <MaterialCommunityIcons name="share-variant" size={20} color="#6b7280" />
                <Text style={[styles.actionText, { color: "#6b7280" }]}>More</Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: 12 }} />

            <View style={styles.confirmRow}>
              <TouchableOpacity
                style={[styles.confirmBtn, sending && styles.confirmBtnDisabled]}
                activeOpacity={0.85}
                onLongPress={onConfirmLongPress}
                delayLongPress={800}
                disabled={sending}
              >
                <Text style={styles.confirmText}>{sending ? "Sending…" : "Long press to Confirm"}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={closeSheet}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.hint}>Tip: Long press Confirm to avoid accidental alerts.</Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fabWrap: {
    position: "absolute",
    right: 16,
    bottom: 96, // above other buttons; adjust as needed
    zIndex: 9999,
    elevation: 10,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#EF4444", // red-ish accent for emergency
    justifyContent: "center",
    alignItems: "center",
  },
  badge: {
    position: "absolute",
    right: -6,
    top: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#10B981", // green badge (matches theme)
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.36)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderColor: "#e5e7eb",
    borderWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  sheetSubtitle: { color: "#6b7280", marginBottom: 12 },

  actionsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  actionBtn: {
    flex: 1,
    marginHorizontal: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f8fafc",
    alignItems: "center",
  },
  actionText: { marginTop: 6, color: "#065f46", fontWeight: "600" },
  actionBtnDisabled: { backgroundColor: "#fff", borderStyle: "dashed" },

  confirmRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#EF4444",
    marginRight: 8,
    alignItems: "center",
  },
  confirmBtnDisabled: { opacity: 0.7 },
  confirmText: { color: "#fff", fontWeight: "700" },

  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#fff",
  },
  cancelText: { color: "#374151", fontWeight: "600" },

  hint: { fontSize: 12, color: "#6b7280", marginTop: 10, textAlign: "center" },
});
