import React, { useState } from "react";
import { Button } from "react-native-paper";
import * as Haptics from "expo-haptics";

type PaperBtnProps = React.ComponentProps<typeof Button>;

type Props = Omit<PaperBtnProps, "onPress" | "loading"> & {
  onPressAsync?: () => Promise<any>; // ✅ backend async support
  onPress?: PaperBtnProps["onPress"];
  haptic?: boolean;
  successHaptic?: boolean;
};

export default function PrimaryButton({
  haptic = true,
  successHaptic = false,
  onPressAsync,
  onPress,
  disabled,
  children,
  ...rest
}: Props) {
  const [busy, setBusy] = useState(false);

  async function handlePress(...args: any[]) {
    if (haptic) {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }

    if (onPressAsync) {
      try {
        setBusy(true);
        await onPressAsync();
        if (successHaptic) {
          try {
            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success
            );
          } catch {}
        }
      } catch (e) {
        console.warn("[PrimaryButton] async action failed:", e);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (onPress) {
      (onPress as any)(...args);
    }
  }

  return (
    <Button
      mode="contained"
      loading={busy}
      disabled={disabled || busy}
      onPress={handlePress}
      {...rest}
    >
      {children}
    </Button>
  );
}
