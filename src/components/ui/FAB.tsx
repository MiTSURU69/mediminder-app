// components/ui/FAB.tsx
import React from "react";
import { Pressable, Text } from "react-native";
import tw from "../../lib/tw";
import { softShadow } from "../../lib/shadows";
;

export default function FAB({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[tw`absolute right-5 bottom-8 bg-brand rounded-full px-5 py-4`, softShadow]}
    >
      <Text style={tw`text-white text-base font-semibold`}>+ Add</Text>
    </Pressable>
  );
}
