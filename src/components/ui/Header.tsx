// src/components/ui/Header.tsx
import * as React from "react";
import { View, Text, TextInput } from "react-native";
import tw from "../../lib/tw";
import { softShadow } from "../../lib/shadows";

export default function Header() {
  return (
    <View style={tw`px-5 pt-6 pb-3 bg-bg`}>
      <Text style={tw`text-text text-2xl font-bold`}>Mediminder</Text>

      <View style={[tw`mt-3 bg-card rounded-2xl px-4 py-2 border border-border`, softShadow]}>
        <TextInput
          placeholder="Search medicines, reminders…"
          placeholderTextColor={tw.color("mutetext") as string}
          style={[tw`text-text text-base`]}
          clearButtonMode="while-editing"
        />
      </View>
    </View>
  );
}
