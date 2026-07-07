// src/screens/ChatScreen.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  View,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  TextInput as RNTextInput,
  Text,
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  UIManager,
} from "react-native";
import { TAB_BAR_CLEARANCE } from "../lib/layout";
import { SafeAreaView } from "react-native-safe-area-context";
import { askChatbot } from "../lib/chatService";
import { Audio } from "expo-av";
import Markdown from "react-native-markdown-display";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { COLORS, FONTS, RADIUS } from "../theme/colors";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Msg = { id: string; role: "user" | "assistant"; content: string };

const WELCOME_MESSAGE =
  "Namaste! I am MediChat, your personal healthcare companion. How may I assist you in feeling your  best today?";
// NOTE: still points at the old filename — update this path once you swap in the new WAV,
// or keep it if you're overwriting baymax_welcome.wav in place with new audio.
const WELCOME_AUDIO = require("../../assets/sounds/baymax_welcome.wav");
const CHAT_SERVER_URL = "https://mediminder-1.onrender.com";

const TYPING_ID = "__typing__";

const SUGGESTIONS = [
  "What am I taking today?",
  "Explain a side effect",
  "Can I take these together?",
  "Remind me about refills",
];

function PressableScale({
  onPress,
  disabled,
  style,
  children,
  haptic = true,
}: {
  onPress?: () => void;
  disabled?: boolean;
  style?: any;
  children: React.ReactNode;
  haptic?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.92, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      disabled={disabled}
      onPressIn={pressIn}
      onPressOut={pressOut}
      onPress={() => {
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.();
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </TouchableOpacity>
  );
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const listRef = useRef<FlatList<Msg> | null>(null);
  const inputRef = useRef<RNTextInput | null>(null);

  const soundRef = useRef<Audio.Sound | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [welcomeMsgId, setWelcomeMsgId] = useState<string | null>(null);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [wordTimestamps, setWordTimestamps] = useState<number[] | null>(null);
  const wordsRef = useRef<string[]>([]);

  const dotAnims = useRef([new Animated.Value(0.3), new Animated.Value(0.3), new Animated.Value(0.3)]).current;
  const typingLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  function animateNext() {
    LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
  }

  function push(role: Msg["role"], content: string) {
    animateNext();
    setMessages((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, role, content }]);
  }

  useEffect(() => {
    animateNext();
    if (loading) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === TYPING_ID)) return prev;
        return [...prev, { id: TYPING_ID, role: "assistant", content: "" }];
      });
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== TYPING_ID));
    }
  }, [loading]);

  function startTypingAnim() {
    if (typingLoopRef.current) return;
    const seq = dotAnims.map((anim) =>
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    typingLoopRef.current = Animated.loop(Animated.stagger(140, seq));
    typingLoopRef.current.start();
  }
  function stopTypingAnim() {
    if (typingLoopRef.current) {
      typingLoopRef.current.stop();
      typingLoopRef.current = null;
    }
    dotAnims.forEach((d) => d.setValue(0.3));
  }
  useEffect(() => {
    if (loading) startTypingAnim();
    else stopTypingAnim();
  }, [loading]);

  // Pulsing ring while recording — gives clear "I'm listening" feedback
  useEffect(() => {
    if (isRecording) {
      pulseLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.6, duration: 700, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 0, useNativeDriver: true }),
        ])
      );
      pulseLoopRef.current.start();
    } else {
      pulseLoopRef.current?.stop();
      pulseAnim.setValue(1);
    }
    return () => { pulseLoopRef.current?.stop(); };
  }, [isRecording]);

  async function onSend(overrideText?: string) {
    const q = (overrideText ?? input).trim();
    if (!q || loading) return;
    setInput("");
    push("user", q);
    setLoading(true);
    Keyboard.dismiss();

    setTimeout(() => listRef.current?.scrollToOffset?.({ offset: 0, animated: true }), 120);

    try {
      const answer = await askChatbot(q);
      push("assistant", String(answer ?? ""));
    } catch (err: any) {
      push("assistant", `Sorry — I couldn't reach the server. ${err?.message ?? ""}`.trim());
    } finally {
      setLoading(false);
      setTimeout(() => {
        listRef.current?.scrollToOffset?.({ offset: 0, animated: true });
        inputRef.current?.focus?.();
      }, 80);
    }
  }

  async function startRecording() {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Permission needed", "Please allow microphone access for voice input.");
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setIsRecording(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch (e) {
      console.warn("[mic] start error", e);
      Alert.alert("Mic error", "Couldn't start recording.");
    }
  }

  async function stopRecordingAndSend() {
    const recording = recordingRef.current;
    setIsRecording(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      recordingRef.current = null;
      if (!uri) return;

      setTranscribing(true);
      const formData = new FormData();
      formData.append("audio", { uri, name: "recording.m4a", type: "audio/m4a" } as any);

      const res = await fetch(`${CHAT_SERVER_URL}/transcribe`, { method: "POST", body: formData });
      const data = await res.json();

      if (data.text?.trim()) {
        setInput((prev) => (prev ? `${prev} ${data.text.trim()}` : data.text.trim()));
      } else {
        Alert.alert("Couldn't hear that", "Try recording again somewhere quieter.");
      }
    } catch (e) {
      console.warn("[mic] stop error", e);
      Alert.alert("Voice input failed", "Something went wrong transcribing your audio.");
    } finally {
      setTranscribing(false);
    }
  }

  useEffect(() => {
    return () => {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
      stopAndUnloadSound().catch(() => {});
      stopTypingAnim();
    };
  }, []);

  async function stopAndUnloadSound() {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync().catch(() => {});
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    } catch {
      soundRef.current = null;
    }
  }

  async function startWelcomeOnce() {
    const id = `${Date.now()}-welcome`;
    setWelcomeMsgId(id);
    animateNext();
    setMessages((prev) => [...prev, { id, role: "assistant", content: WELCOME_MESSAGE }]);

    const words = WELCOME_MESSAGE.split(/\s+/).filter(Boolean);
    wordsRef.current = words;
    setCurrentWordIndex(-1);
    setWordTimestamps(null);

    try {
      await stopAndUnloadSound();
      const { sound } = await Audio.Sound.createAsync(WELCOME_AUDIO, { shouldPlay: false });
      soundRef.current = sound;

      const statusAny = (await sound.getStatusAsync()) as any;
      let durationMs = statusAny?.durationMillis ?? 0;

      if (!durationMs || durationMs <= 0) {
        try {
          await sound.playAsync();
          const st2 = (await sound.getStatusAsync()) as any;
          durationMs = st2?.durationMillis ?? durationMs;
          await sound.pauseAsync().catch(() => {});
          await sound.setPositionAsync(0).catch(() => {});
        } catch {}
      }

      if (durationMs && durationMs > 0) {
        const spacing = Math.max(50, Math.floor(durationMs / Math.max(words.length, 1)));
        const ts = words.map((_, i) => Math.round(i * spacing));
        setWordTimestamps(ts);
      }
    } catch {
      setWordTimestamps(null);
    }

    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }

    try {
      if (soundRef.current) {
        try { await soundRef.current.setPositionAsync(0).catch(() => {}); } catch {}
        await soundRef.current.playAsync().catch(() => {});
      }
    } catch {}

    const fallbackCadence = 140;
    const startTs = Date.now();

    tickRef.current = setInterval(async () => {
      try {
        let elapsed = Date.now() - startTs;
        if (soundRef.current) {
          const st = (await soundRef.current.getStatusAsync()) as any;
          if (st && typeof st.positionMillis === "number") elapsed = st.positionMillis;
        }
        if (wordTimestamps && wordTimestamps.length === wordsRef.current.length) {
          let idx = 0;
          for (let i = 0; i < wordTimestamps.length; i++) {
            if (elapsed >= (wordTimestamps[i] || 0)) idx = i;
            else break;
          }
          setCurrentWordIndex(idx);
          if (idx >= wordsRef.current.length - 1) {
            setTimeout(() => { if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; } }, 200);
          }
        } else {
          const idx = Math.min(wordsRef.current.length - 1, Math.floor(elapsed / fallbackCadence));
          setCurrentWordIndex(idx);
          if (idx >= wordsRef.current.length - 1) {
            if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
          }
        }
      } catch {}
    }, 80);
  }

  useEffect(() => {
    if (!hasStarted) {
      setHasStarted(true);
      setTimeout(() => {
        inputRef.current?.focus?.();
        startWelcomeOnce();
      }, 220);
    }
  }, []);

  const realMessageCount = messages.filter((m) => m.id !== TYPING_ID).length;
  const showSuggestions = realMessageCount <= 1 && !loading;

  function renderItem({ item }: { item: Msg }) {
    const isUser = item.role === "user";

    if (welcomeMsgId && item.id === welcomeMsgId) {
      const words = wordsRef.current;
      return (
        <View style={[styles.row, styles.rowBot]}>
          <View style={[styles.bubble, styles.bubbleBot]}>
            <Text style={styles.welcomeText}>
              {words.map((w, i) => {
                const shown = i <= currentWordIndex;
                return (
                  <Text key={`${item.id}-w-${i}`} style={shown ? styles.welcomeWordShown : styles.welcomeWordHidden}>
                    {w}{i < words.length - 1 ? " " : ""}
                  </Text>
                );
              })}
            </Text>
          </View>
        </View>
      );
    }

    if (item.id === TYPING_ID) {
      return (
        <View style={[styles.row, styles.rowBot]}>
          <View style={[styles.bubble, styles.bubbleBot, styles.typingBubble]}>
            <View style={styles.typingDotsRow}>
              {dotAnims.map((anim, i) => (
                <Animated.View
                  key={`dot-${i}`}
                  style={[
                    styles.typingDot,
                    {
                      transform: [{ translateY: anim.interpolate({ inputRange: [0.3, 1], outputRange: [0, -6] }) }],
                      opacity: anim.interpolate({ inputRange: [0.3, 1], outputRange: [0.35, 1] }),
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.row, isUser ? styles.rowUser : styles.rowBot]}>
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
          <Markdown
            style={{
              body: { fontFamily: FONTS.body, fontSize: 15, color: isUser ? "#fff" : COLORS.ink },
              strong: { fontFamily: FONTS.bodyMedium },
              em: { fontStyle: "italic" },
              link: { color: isUser ? "#fff" : COLORS.accent, textDecorationLine: "underline" },
            }}
          >
            {item.content}
          </Markdown>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView edges={["left", "right"]} style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <View style={styles.header}>
          <Text style={styles.title}>MediChat</Text>
          <Text style={styles.subtitle}>Your healthcare companion</Text>
        </View>

        <FlatList
          ref={listRef}
          data={messages.slice().reverse()}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          inverted
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
        />

        {showSuggestions && (
          <View style={styles.suggestionsWrap}>
            <FlatList
              horizontal
              data={SUGGESTIONS}
              keyExtractor={(s) => s}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16 }}
              renderItem={({ item }) => (
                <PressableScale onPress={() => onSend(item)} style={styles.suggestionChip}>
                  <Text style={styles.suggestionText}>{item}</Text>
                </PressableScale>
              )}
            />
          </View>
        )}

        <View style={styles.inputRow}>
          <RNTextInput
            ref={inputRef}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about meds, schedules, reports…"
            placeholderTextColor={COLORS.faint}
            style={styles.input}
            returnKeyType="send"
            onSubmitEditing={() => onSend()}
            editable={!loading}
            multiline
            blurOnSubmit={false}
          />

          <View style={styles.micWrap}>
            {isRecording && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.micPulseRing,
                  { transform: [{ scale: pulseAnim }], opacity: pulseAnim.interpolate({ inputRange: [1, 1.6], outputRange: [0.5, 0] }) },
                ]}
              />
            )}
            <PressableScale
              onPress={isRecording ? stopRecordingAndSend : startRecording}
              disabled={transcribing || loading}
              style={[styles.micBtn, isRecording && styles.micBtnActive]}
              haptic={false}
            >
              {transcribing ? (
                <ActivityIndicator color={isRecording ? "#fff" : COLORS.accent} size="small" />
              ) : (
                <MaterialCommunityIcons name={isRecording ? "stop" : "microphone"} size={19} color={isRecording ? "#fff" : COLORS.accent} />
              )}
            </PressableScale>
          </View>

          <PressableScale
            onPress={() => onSend()}
            disabled={loading || !input.trim()}
            style={[styles.sendBtn, (loading || !input.trim()) && styles.sendBtnDisabled]}
          >
            {loading ? <ActivityIndicator color="#fff" size="small" /> : (
              <MaterialCommunityIcons name="arrow-up" size={18} color="#fff" />
            )}
          </PressableScale>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  container: { flex: 1 },

  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.line,
  },
  title: { fontFamily: FONTS.display, fontSize: 20, color: COLORS.ink },
  subtitle: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, marginTop: 2 },

  list: { flex: 1, paddingHorizontal: 14, backgroundColor: COLORS.surface },
  listContent: { paddingTop: 12, paddingBottom: 8, flexGrow: 1, justifyContent: "flex-end" },

  row: { marginVertical: 5 },
  rowUser: { alignSelf: "flex-end" },
  rowBot: { alignSelf: "flex-start" },

  bubble: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: RADIUS.card, maxWidth: "82%" },
  bubbleUser: { backgroundColor: COLORS.accent, borderBottomRightRadius: 4 },
  bubbleBot: { backgroundColor: COLORS.paper, borderBottomLeftRadius: 4 },

  typingBubble: { minWidth: 52, paddingHorizontal: 14, paddingVertical: 10 },
  typingDotsRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center" },
  typingDot: { width: 6, height: 6, borderRadius: 3, marginHorizontal: 3, backgroundColor: COLORS.accent },

  welcomeText: { fontFamily: FONTS.body, fontSize: 15, lineHeight: 21 },
  welcomeWordHidden: { color: "transparent" },
  welcomeWordShown: { color: COLORS.ink },

  suggestionsWrap: { paddingBottom: 10 },
  suggestionChip: {
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.chip,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginRight: 8,
  },
  suggestionText: { fontFamily: FONTS.bodyMedium, fontSize: 12.5, color: COLORS.ink },

  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    paddingBottom: TAB_BAR_CLEARANCE,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.line,
    backgroundColor: COLORS.surface,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 160,
    fontFamily: FONTS.body,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 8,
    backgroundColor: COLORS.paper,
    color: COLORS.ink,
  },
  micWrap: { alignItems: "center", justifyContent: "center", marginRight: 8 },
  micPulseRing: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accent,
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: COLORS.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  micBtnActive: { backgroundColor: COLORS.skip, borderColor: COLORS.skip },
  sendBtn: {
    backgroundColor: COLORS.accent,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
});