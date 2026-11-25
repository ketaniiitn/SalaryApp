import { useState, type ReactNode } from "react";
import { Platform, Pressable, TextInput, View, type TextInputProps } from "react-native";

import { AppText } from "@/components/app-text";
import { AlertIcon, CalendarIcon, ChevronDown } from "@/components/icons";
import { colors } from "@/lib/theme";

/** Label above, never inside. Problems sit under the field in red with an icon. */
export function Field({
  label,
  hint,
  error,
  prefix,
  suffix,
  big = false,
  lines = 1,
  showLabel = true,
  onFocus,
  onBlur,
  ...input
}: {
  label: string;
  hint?: string;
  error?: string | null;
  prefix?: string;
  suffix?: ReactNode;
  big?: boolean;
  /** More than 1 makes a tall note instead of a single line. */
  lines?: number;
  /** Hide the visible label when a heading above already says it; screen readers still get it. */
  showLabel?: boolean;
} & TextInputProps) {
  const [focused, setFocused] = useState(false);
  const border = error ? "border-cloth" : focused ? "border-ink" : "border-rule2";
  const tall = lines > 1;

  return (
    <View className="mb-5">
      {showLabel ? (
        <AppText variant="medium" size="sm" tone="ink2" className="mb-1.5">
          {label}
        </AppText>
      ) : null}
      <View
        className={`rounded-md border-2 bg-paper pl-3.5 ${suffix ? "pr-1" : "pr-3.5"} ${tall ? "py-3" : "flex-row items-center"} ${tall ? "" : big ? "h-[68px]" : "h-[52px]"} ${border}`}
        style={tall ? { minHeight: lines * 26 + 24 } : undefined}>
        {prefix ? (
          <AppText variant="figure" size={big ? "title" : "lg"} tone="ink3" className="mr-2">
            {prefix}
          </AppText>
        ) : null}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.faint}
          maxFontSizeMultiplier={1.6}
          multiline={tall}
          textAlignVertical={tall ? "top" : "center"}
          className={`min-w-0 flex-1 text-ink ${tall ? "" : "h-full"} ${big && !tall ? "font-display text-[30px]" : "font-sans text-[17px]"}`}
          style={[
            tall ? { minHeight: lines * 26 } : undefined,
            Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : undefined,
          ]}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...input}
        />
        {suffix}
      </View>
      {error ? <ErrorLine message={error} /> : hint ? <Hint>{hint}</Hint> : null}
    </View>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return (
    <AppText size="sm" tone="ink3" className="mt-1.5">
      {children}
    </AppText>
  );
}

export function ErrorLine({ message }: { message: string }) {
  return (
    <View accessibilityLiveRegion="polite" className="mt-1.5 flex-row items-start">
      <View className="mr-1.5 mt-0.5">
        <AlertIcon size={17} />
      </View>
      <AppText variant="medium" size="sm" tone="cloth" className="flex-1">
        {message}
      </AppText>
    </View>
  );
}

/** A field-shaped button that opens a list or a calendar. It looks like a dropdown so it reads as one. */
export function PickerField({
  label,
  value,
  placeholder = "Choose",
  hint,
  error,
  kind = "list",
  onPress,
}: {
  label: string;
  value: string;
  placeholder?: string;
  hint?: string;
  error?: string | null;
  kind?: "list" | "date";
  onPress: () => void;
}) {
  return (
    <View className="mb-5">
      <AppText variant="medium" size="sm" tone="ink2" className="mb-1.5">
        {label}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || placeholder}. Change`}
        onPress={onPress}
        className={`h-[52px] flex-row items-center justify-between rounded-md border-2 bg-paper px-3.5 active:bg-sheet ${error ? "border-cloth" : "border-rule2"}`}>
        <AppText size="lg" tone={value ? "ink" : "faint"} numberOfLines={1} className="mr-3 flex-1">
          {value || placeholder}
        </AppText>
        {kind === "date" ? <CalendarIcon size={18} color={colors.ink2} /> : <ChevronDown size={18} color={colors.ink2} />}
      </Pressable>
      {error ? <ErrorLine message={error} /> : hint ? <Hint>{hint}</Hint> : null}
    </View>
  );
}

export function ShowToggle({ shown, onPress }: { shown: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={shown ? "Hide password" : "Show password"}
      onPress={onPress}
      className="h-11 justify-center px-3.5 active:opacity-60">
      <AppText variant="semibold" size="sm" style={{ textDecorationLine: "underline" }}>
        {shown ? "Hide" : "Show"}
      </AppText>
    </Pressable>
  );
}
