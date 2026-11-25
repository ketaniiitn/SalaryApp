import { router, type Href } from "expo-router";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/app-text";
import { ChevronLeft } from "@/components/icons";
import { useScreenPad } from "@/components/screen";
import { colors } from "@/lib/theme";

/** Back always says where it goes: "‹ Sharma Fabrication". */
export function BackButton({
  label,
  fallback,
  disabled = false,
  onPress,
}: {
  label: string;
  fallback: Href;
  disabled?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Back to ${label}`}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace(fallback)))}
      className="min-h-12 max-w-[70%] flex-row items-center px-2.5 active:opacity-60 disabled:opacity-40">
      <ChevronLeft size={20} />
      <AppText variant="medium" size="base" numberOfLines={1} className="ml-0.5 shrink">
        {label}
      </AppText>
    </Pressable>
  );
}

/**
 * One page of the book: a top bar with a labelled back button, a scrolling body,
 * and an optional dock pinned at the bottom for the screen's one main button.
 */
export function Page({
  back,
  right,
  children,
  dock,
  overlay,
  refreshing,
  onRefresh,
  keyboard = false,
  scroll = true,
  header,
}: {
  back?: { label: string; fallback: Href; disabled?: boolean; onPress?: () => void };
  right?: ReactNode;
  children: ReactNode;
  dock?: ReactNode;
  overlay?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  keyboard?: boolean;
  /** False when the screen lays out its own scrolling areas, such as a form beside a preview. */
  scroll?: boolean;
  /** Replaces the top bar, for screens that open on the cover. */
  header?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const pad = useScreenPad();

  const content = (
    <View className="flex-1 bg-paper">
      {header ?? (
        <View className="min-h-[56px] flex-row items-center justify-between pb-1 pl-1.5 pr-2.5" style={{ paddingTop: insets.top + 6 }}>
          {back ? <BackButton {...back} /> : <View />}
          {right ? <View className="mr-2.5">{right}</View> : null}
        </View>
      )}
      {scroll ? (
        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: pad, paddingTop: 8, paddingBottom: 32, gap: 24 }}
          refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.ink} /> : undefined}>
          {children}
        </ScrollView>
      ) : (
        <View className="flex-1">{children}</View>
      )}
      {dock ? (
        <View className="gap-2 border-t border-rule bg-paper pt-3.5" style={{ paddingHorizontal: pad, paddingBottom: insets.bottom + 14 }}>
          {dock}
        </View>
      ) : null}
      {overlay}
    </View>
  );

  if (!keyboard) return content;
  return (
    // Android: with edge-to-edge (SDK 58) the window no longer resizes for the keyboard, so shrink the page here.
    <KeyboardAvoidingView className="flex-1 bg-paper" behavior={Platform.OS === "ios" ? "padding" : "height"}>
      {content}
    </KeyboardAvoidingView>
  );
}

/** Where a toast sits so it clears the dock. */
export function useToastOffset(): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + 100;
}

/** The plain top of Sign in, Sign up and Home: the wordmark over a single hairline. */
export function Cover({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const pad = useScreenPad();
  return (
    <View className="border-b border-rule bg-paper" style={{ paddingTop: insets.top + 18, paddingBottom: 20, paddingHorizontal: pad }}>
      {children}
    </View>
  );
}

export function Wordmark({ size = 22 }: { size?: number }) {
  const tile = Math.round(size * 1.6);
  return (
    <View className="flex-row items-center" accessible accessibilityRole="header" accessibilityLabel="Salary">
      <View
        className="mr-2.5 items-center justify-center bg-stamp"
        style={{ width: tile, height: tile, borderRadius: Math.round(tile * 0.28) }}>
        <AppText variant="display" tone="sheet" style={{ fontSize: size * 0.95, lineHeight: size * 1.15 }}>
          ₹
        </AppText>
      </View>
      <AppText variant="display" style={{ fontSize: size, lineHeight: size * 1.25, letterSpacing: -0.4 }}>
        Salary
      </AppText>
    </View>
  );
}
