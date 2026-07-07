import React, { PropsWithChildren } from "react";
import { View, ViewStyle } from "react-native";
import tw from "../../lib/tw";
import { softShadow } from "../../lib/shadows";

type Props = PropsWithChildren<{ style?: ViewStyle | ViewStyle[] }>;

export default function Card({ children, style }: Props) {
  return (
    <View style={[tw`bg-card rounded-2xl p-4 border border-border`, softShadow, style]}>
      {children}
    </View>
  );
}
