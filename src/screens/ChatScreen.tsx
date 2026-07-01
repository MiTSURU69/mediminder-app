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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { askChatbot } from "../lib/chatService";
import { Audio } from "expo-av";
import Markdown from "react-native-markdown-display";

type Msg = { id: string; role: "user" | "assistant"; content: string };

const GREEN = "#10B981";
const WELCOME_MESSAGE =
  "Hello! I'm Baymax, your personal healthcare companion. How can I patch you up today?";
const WELCOME_AUDIO = require("../../assets/sounds/baymax_welcome.wav");

const TYPING_ID = "__typing__";

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

  function push(role: Msg["role"], content: string) {
    setMessages((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, role, content }]);
  }

  useEffect(() => {
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

  async function onSend() {
    const q = input.trim();
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
      push("assistant", `❌ ${err?.message ?? String(err)}`);
    } finally {
      setLoading(false);
      setTimeout(() => {
        listRef.current?.scrollToOffset?.({ offset: 0, animated: true });
        inputRef.current?.focus?.();
      }, 80);
    }
  }

  useEffect(() => {
    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
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

    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }

    try {
      if (soundRef.current) {
        try {
          await soundRef.current.setPositionAsync(0).catch(() => {});
        } catch {}
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
            setTimeout(() => {
              if (tickRef.current) {
                clearInterval(tickRef.current);
                tickRef.current = null;
              }
            }, 200);
          }
        } else {
          const idx = Math.min(wordsRef.current.length - 1, Math.floor(elapsed / fallbackCadence));
          setCurrentWordIndex(idx);
          if (idx >= wordsRef.current.length - 1) {
            if (tickRef.current) {
              clearInterval(tickRef.current);
              tickRef.current = null;
            }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function renderItem({ item }: { item: Msg }) {
    const isUser = item.role === "user";

    if (welcomeMsgId && item.id === welcomeMsgId) {
      const words = wordsRef.current;
      return (
        <View style={[styles.row, isUser ? styles.rowUser : styles.rowBot]}>
          <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
            <Text style={styles.welcomeText}>
              {words.map((w, i) => {
                const shown = i <= currentWordIndex;
                return (
                  <Text key={`${item.id}-w-${i}`} style={shown ? styles.welcomeWordShown : styles.welcomeWordHidden}>
                    {w}
                    {i < words.length - 1 ? " " : ""}
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
                      transform: [
                        {
                          translateY: anim.interpolate({
                            inputRange: [0.3, 1],
                            outputRange: [0, -6],
                          }),
                        },
                      ],
                      opacity: anim.interpolate({
                        inputRange: [0.3, 1],
                        outputRange: [0.35, 1],
                      }),
                      backgroundColor: GREEN,
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
              body: { fontSize: 15, color: isUser ? "#fff" : "#111827" },
              strong: { fontWeight: "700" },
              em: { fontStyle: "italic" },
              link: { color: "#2563eb" },
            }}
          >
            {item.content}
          </Markdown>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Baymax (●—●)</Text>
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

        <View style={styles.inputRow}>
          <RNTextInput
            ref={inputRef}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about meds, schedules, reports…"
            placeholderTextColor="#6B7280"
            style={styles.input}
            returnKeyType="send"
            onSubmitEditing={onSend}
            editable={!loading}
            multiline
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (loading || !input.trim()) && styles.sendBtnDisabled]}
            onPress={onSend}
            disabled={loading || !input.trim()}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendBtnText}>Send</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#ffffff" },
  container: { flex: 1 },

  header: {
    height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 18, fontWeight: "600", color: "#111827" },

  list: { flex: 1, paddingHorizontal: 12, backgroundColor: "#FFFFFF" },
  listContent: { paddingTop: 12, paddingBottom: 12, flexGrow: 1, justifyContent: "flex-end" },

  row: { marginVertical: 6 },
  rowUser: { alignSelf: "flex-end" },
  rowBot: { alignSelf: "flex-start" },

  bubble: { padding: 12, borderRadius: 14, maxWidth: "82%" },
  bubbleUser: { backgroundColor: GREEN },
  bubbleBot: { backgroundColor: "#F3F4F6" },

  typingBubble: { minWidth: 56, paddingHorizontal: 12, paddingVertical: 8 },
  typingDotsRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center" },
  typingDot: { width: 8, height: 8, borderRadius: 8, marginHorizontal: 6 },

  welcomeText: { fontSize: 15, lineHeight: 20 },
  welcomeWordHidden: { color: "transparent" },
  welcomeWordShown: { color: "#111827" },

  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
    backgroundColor: "#ffffff",
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 160,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: "#fff",
    color: "#111827",
  },
  sendBtn: {
    backgroundColor: GREEN,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: { opacity: 0.55 },
  sendBtnText: { color: "#fff", fontWeight: "600" },
});