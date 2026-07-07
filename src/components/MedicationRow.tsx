// components/MedicationRow.tsx
import React from "react";
import { View, Text } from "react-native";
import tw from "../lib/tw";
import Button from "./ui/Button";

type Props = {
  name: string;
  dose: string;
  nextAt: string;
  onMarkTaken?: () => void;
};

export default function MedicationRow({ name, dose, nextAt, onMarkTaken }: Props) {
  return (
    <View style={tw`flex-row items-center justify-between`}>
      <View>
        <Text style={tw`text-text text-base font-semibold`}>{name}</Text>
        <Text style={tw`text-mutetext mt-0.5`}>{dose} • Next {nextAt}</Text>
      </View>
      <Button title="Taken" variant="subtle" onPress={onMarkTaken} />
    </View>
  );
}
