// src/components/ui/Button.tsx
import React, { memo } from "react";
import { Pressable, Text, type StyleProp, type ViewStyle, type TextStyle } from "react-native";
import tw from "../../lib/tw";

type ButtonVariant = "primary" | "outline" | "subtle";

export type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
  testID?: string;
  accessible?: boolean;
  accessibilityLabel?: string;
};

const Button = memo(function Button({
  title,
  onPress,
  variant = "primary",
  style,
  textStyle,
  disabled = false,
  testID,
  accessible,
  accessibilityLabel,
}: ButtonProps) {
  // base container
  const base = tw`rounded-2xl py-3 px-4 items-center justify-center`;

  // variant styles
  const containerStyle =
    variant === "primary"
      ? tw.style(base, disabled ? `bg-brand/50` : `bg-brand`)
      : variant === "outline"
      ? tw.style(base, `bg-transparent border border-brand`)
      : tw.style(base, `bg-brandSoft`);

  // text styles
  const titleStyle =
    variant === "primary"
      ? tw`text-white text-base font-semibold`
      : variant === "outline"
      ? tw`text-brand text-base font-semibold`
      : tw`text-brandDark text-base font-semibold`;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessible={accessible}
      accessibilityLabel={accessibilityLabel ?? title}
      style={[containerStyle, style]}
    >
      <Text style={[titleStyle, textStyle]}>{title}</Text>
    </Pressable>
  );
});

export default Button;
