import { ActivityIndicator, Pressable, View, type PressableProps } from "react-native";

import { AppText } from "@/components/app-text";
import { PlusIcon, TickIcon } from "@/components/icons";
import { colors } from "@/lib/theme";

type Variant = "primary" | "line" | "text" | "danger";

const shell: Record<Variant, string> = {
  primary: "border-2 border-stamp bg-stamp",
  line: "border-2 border-ink bg-paper",
  text: "border-2 border-transparent bg-transparent",
  danger: "border-2 border-cloth bg-paper",
};

const ink: Record<Variant, string> = {
  primary: colors.clothInk,
  line: colors.ink,
  text: colors.ink,
  danger: colors.cloth,
};

/**
 * One filled green button per screen (primary), black outline for the second action (line),
 * underlined text for a quiet one (text). 54 px tall, or 44 px when small.
 */
export function Button({
  label,
  variant = "primary",
  small = false,
  icon,
  loading = false,
  disabled,
  className,
  ...props
}: PressableProps & {
  label: string;
  variant?: Variant;
  small?: boolean;
  icon?: "plus" | "tick";
  loading?: boolean;
  className?: string;
}) {
  const off = Boolean(disabled) || loading;
  const tint = off && variant === "primary" ? colors.ink3 : ink[variant];
  const box = off && variant === "primary" ? "border-2 border-off bg-off" : shell[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: loading }}
      disabled={off}
      className={`flex-row items-center justify-center rounded-md active:opacity-80 ${small ? "h-11 px-3" : "h-[54px] px-5"} ${box} ${
        off && variant !== "primary" ? "opacity-50" : ""
      } ${className ?? ""}`}
      {...props}>
      {loading ? (
        <ActivityIndicator color={tint} style={{ marginRight: 10 }} />
      ) : icon ? (
        <View className="mr-2.5">{icon === "plus" ? <PlusIcon color={tint} size={small ? 18 : 20} /> : <TickIcon color={tint} size={small ? 18 : 22} />}</View>
      ) : null}
      <AppText
        variant="bold"
        size={small ? "base" : "lg"}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
        style={{ color: tint, textDecorationLine: variant === "text" ? "underline" : "none" }}>
        {label}
      </AppText>
    </Pressable>
  );
}
