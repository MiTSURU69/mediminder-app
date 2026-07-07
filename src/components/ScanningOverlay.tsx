// src/components/ScanningOverlay.tsx
import React, { useEffect, useRef } from "react";
import { View, Modal, StyleSheet, Animated, Easing, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const GREEN = "#10B981";

type Props = {
  visible: boolean;
  message?: string;
};

export default function ScanningOverlay({ visible, message = "Reading your prescription..." }: Props) {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const lineAnim = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (visible) {
      pulseAnim.setValue(0);
      lineAnim.setValue(0);

      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );

      const lineLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(lineAnim, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(lineAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );

      loopRef.current = Animated.parallel([pulseLoop, lineLoop]);
      loopRef.current.start();
    } else {
      if (loopRef.current) {
        loopRef.current.stop();
        loopRef.current = null;
      }
    }

    return () => {
      if (loopRef.current) {
        loopRef.current.stop();
        loopRef.current = null;
      }
    };
  }, [visible]);

  const scale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
  const opacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  const lineTranslate = lineAnim.interpolate({ inputRange: [0, 1], outputRange: [-60, 60] });

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.scanBox}>
            <MaterialCommunityIcons name="file-document-outline" size={64} color="#fff" style={{ opacity: 0.9 }} />
            <Animated.View
              style={[
                styles.scanLine,
                { transform: [{ translateY: lineTranslate }] },
              ]}
            />
          </View>

          <Animated.View style={{ transform: [{ scale }], opacity, marginTop: 20 }}>
            <MaterialCommunityIcons name="pill" size={28} color={GREEN} />
          </Animated.View>

          <Text style={styles.message}>{message}</Text>
          <Text style={styles.subMessage}>This usually takes a few seconds</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: "center",
    width: "80%",
  },
  scanBox: {
    width: 120,
    height: 120,
    borderRadius: 16,
    backgroundColor: "#1F2937",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  scanLine: {
    position: "absolute",
    width: "100%",
    height: 3,
    backgroundColor: GREEN,
    shadowColor: GREEN,
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  message: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    textAlign: "center",
  },
  subMessage: {
    marginTop: 4,
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
  },
});