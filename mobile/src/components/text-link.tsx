import { Pressable } from "react-native";

import { AppText } from "@/components/app-text";

/** A small underlined action inside content: Edit, Remove, Change. */
export function TextLink({ label, onPress, tone = "ink", accessibilityLabel }: { label: string; onPress: () => void; tone?: "ink" | "cloth" | "stamp"; accessibilityLabel?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} onPress={onPress} hitSlop={8} className="active:opacity-60">
      <AppText variant="semibold" size="sm" tone={tone} style={{ textDecorationLine: "underline" }}>
        {label}
      </AppText>
    </Pressable>
  );
}
