import * as React from "react";
import { View } from "react-native";
import { Card, Text, Badge, Icon } from "react-native-paper";
import * as Haptics from "expo-haptics";
import PrimaryButton from "./PrimaryButton";
import type { Dose } from "../lib/types";
import tw from "../lib/tw";
import { softShadow } from "../lib/shadows";

type Props = {
  medName: string;
  dose: Dose;
  onTaken: () => Promise<void>;
  onMissed: () => Promise<void>;
};

function statusMeta(status: Dose["status"]) {
  if (status === "taken")
    return { label: "Taken", bg: tw.color("green-600") as string };
  if (status === "missed")
    return { label: "Missed", bg: tw.color("red-600") as string };
  return { label: "Scheduled", bg: tw.color("slate-500") as string };
}

export default function DoseCard({ medName, dose, onTaken, onMissed }: Props) {
  const at = new Date(dose.whenISO);
  const time = at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const s = statusMeta(dose.status);

  return (
    <Card
      mode="elevated"
      style={[
        tw`rounded-2xl bg-card border border-border mb-4 overflow-hidden`,
        softShadow,
      ]}
    >
      <View style={tw`p-4`}>
        {/* top row */}
        <View style={tw`flex-row items-center justify-between`}>
          <View style={tw`flex-row items-center`}>
            <Icon source="pill" size={26} color={tw.color("brand") as string} />
            <View style={tw`ml-3`}>
              <Text
                variant="titleMedium"
                style={[tw`text-text`, { fontFamily: "Inter_600SemiBold" }]}
              >
                {medName}
              </Text>
              <Text variant="bodySmall" style={tw`text-mutetext`}>
                {time}
              </Text>
            </View>
          </View>

          <Badge style={[{ backgroundColor: s.bg }, tw`text-white`]}>
            {s.label}
          </Badge>
        </View>

        {/* actions */}
        <View style={tw`flex-row justify-end mt-3`}>
          <View style={tw`mr-2`}>
            <PrimaryButton
              mode="outlined"
              icon="close-circle-outline"
              onPressAsync={onMissed}
            >
              Missed
            </PrimaryButton>
          </View>
          <PrimaryButton
            mode="contained"
            icon="check-circle-outline"
            onPressAsync={onTaken}
            successHaptic
          >
            Taken
          </PrimaryButton>
        </View>
      </View>
    </Card>
  );
}
