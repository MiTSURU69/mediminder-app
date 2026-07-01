// src/components/AppHeader.tsx
import React from "react";
import { Appbar } from "react-native-paper";

type Props = {
  title: string;
  onAdd?: () => void;
  onHistory?: () => void;
  canGoBack?: boolean;
  onBack?: () => void;
};

export default function AppHeader({ title, onAdd, onHistory, canGoBack, onBack }: Props) {
  return (
    <Appbar.Header mode="center-aligned" elevated>
      {canGoBack ? <Appbar.BackAction onPress={onBack} /> : null}
      <Appbar.Content title={title} />
      {onHistory ? <Appbar.Action icon="history" onPress={onHistory} /> : null}
      {onAdd ? <Appbar.Action icon="plus" onPress={onAdd} /> : null}
    </Appbar.Header>
  );
}
