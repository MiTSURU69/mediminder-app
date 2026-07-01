// src/components/chat/ChatSheet.tsx
import React, { useEffect, useRef, useState } from "react";
import { SafeAreaView, FlatList, View, Text, TextInput, TouchableOpacity, StyleSheet, Keyboard, ActivityIndicator } from "react-native";
import { askChatbot } from "../../lib/chatService";

type Msg = { role: "user" | "assistant"; text: string };

const GREEN = "#10B981";

export default function ChatScreen() {
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", text: "Hello! I am Baymax, your personal healthcare companion. How can I patch you up today?" }]);
  const [input, setInput] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);

  const listRef = useRef<FlatList<Msg> | null>(null);
  const inputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    const t = setTimeout(() => listRef.current?.scrollToOffset?.({ offset: 0, animated: true }), 50);
    return () => clearTimeout(t);
  }, [messages.length]);

  async function sendMessage() {
    const q = input.trim();
    if (!q || sending) return;
    setInput("");
    setSending(true);
    Keyboard.dismiss();
    setMessages((m) => [...m, { role: "user", text: q }]);

    try {
      const answer = await askChatbot(q);
      setMessages((m) => [...m, { role: "assistant", text: String(answer ?? "No answer") }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages((m) => [...m, { role: "assistant", text: `❌ ${msg}` }]);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus?.(), 50);
      setTimeout(() => listRef.current?.scrollToOffset?.({ offset: 0, animated: true }), 80);
    }
  }

  function renderItem({ item }: { item: Msg }) {
    const isUser = item.role === "user";
    return (
      <View style={[styles.row, isUser ? styles.rowUser : styles.rowBot]}>
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
          <Text style={isUser ? styles.textUser : styles.textBot}>{item.text}</Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList ref={listRef} data={messages.slice().reverse()} keyExtractor={(_, i) => String(i)} renderItem={renderItem} style={styles.list} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="always" inverted />

      <View style={styles.inputRow}>
        <TextInput ref={inputRef} value={input} onChangeText={setInput} placeholder="Ask about meds, schedules, reports…" style={styles.input} returnKeyType="send" onSubmitEditing={sendMessage} editable={!sending} multiline />
        <TouchableOpacity onPress={sendMessage} disabled={!input.trim() || sending} style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}>
          {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendBtnText}>Send</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  list: { flex: 1, paddingHorizontal: 14, paddingTop: 10 },
  listContent: { paddingBottom: 12, flexGrow: 1, justifyContent: "flex-end" },
  row: { marginVertical: 6 },
  rowUser: { alignSelf: "flex-end" },
  rowBot: { alignSelf: "flex-start" },
  bubble: { padding: 10, borderRadius: 12, maxWidth: "82%" },
  bubbleUser: { backgroundColor: GREEN },
  bubbleBot: { backgroundColor: "#F3F4F6" },
  textUser: { color: "#fff" },
  textBot: { color: "#111827" },
  inputRow: { flexDirection: "row", alignItems: "flex-end", padding: 12, borderTopWidth: 1, borderColor: "#eee" },
  input: { flex: 1, minHeight: 44, maxHeight: 140, borderRadius: 8, borderWidth: 1, borderColor: "#E5E7EB", paddingHorizontal: 12, paddingVertical: 8, marginRight: 8, backgroundColor: "#fff" },
  sendBtn: { backgroundColor: GREEN, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  sendBtnDisabled: { opacity: 0.55 },
  sendBtnText: { color: "#fff", fontWeight: "600" },
});
