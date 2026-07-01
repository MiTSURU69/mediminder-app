// src/components/chat/ChatMessage.tsx
import React from "react";
import { View, Text } from "react-native";
import Markdown from "react-native-markdown-display";

type Props = {
  text: string;
  isMine?: boolean;
};

export default function ChatMessage({ text, isMine = false }: Props) {
  return (
    <View style={{
      marginVertical: 6,
      alignSelf: isMine ? "flex-end" : "flex-start",
      maxWidth: "85%",
    }}>
      <Markdown
        // you can override styles to match your theme
        style={{
          body: { fontSize: 15, color: isMine ? "#fff" : "#0f172a", lineHeight: 20 },
          strong: { fontWeight: "700" },     // **bold**
          em: { fontStyle: "italic" },       // *italic*
          link: { color: "#2563eb" },        // [link](url)
          code_inline: { backgroundColor: "#11182710", padding: 4, borderRadius: 4 },
          code_block: { backgroundColor: "#11182710", padding: 8, borderRadius: 6 },
        }}
      >
        {text}
      </Markdown>
    </View>
  );
}
