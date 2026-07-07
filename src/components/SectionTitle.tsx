// components/SectionTitle.tsx
import React from "react";
import { Text, View } from "react-native";
import tw from "../lib/tw";

export default function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={tw`px-5 mt-4 mb-2`}>
      <Text style={tw`text-text text-lg font-semibold`}>{title}</Text>
      {subtitle ? <Text style={tw`text-mutetext mt-0.5`}>{subtitle}</Text> : null}
    </View>
  );
}
