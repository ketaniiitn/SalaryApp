import { useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";

import { AppText } from "@/components/app-text";
import { ChevronDown } from "@/components/icons";

/** Optional fields kept out of the way until asked for. Opens by itself when something inside is filled. */
export function Disclosure({ label, summary, startOpen = false, children }: { label: string; summary?: string; startOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <View className="mb-4 border-y border-rule">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        className="min-h-[52px] flex-row items-center justify-between py-3 active:opacity-70">
        <View className="mr-3 flex-1">
          <AppText variant="semibold">{label}</AppText>
          {summary && !open ? (
            <AppText size="sm" tone="ink3" numberOfLines={1}>
              {summary}
            </AppText>
          ) : null}
        </View>
        <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
          <ChevronDown />
        </View>
      </Pressable>
      {open ? <View className="pb-1 pt-1">{children}</View> : null}
    </View>
  );
}
