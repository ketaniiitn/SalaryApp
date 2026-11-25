import { Pressable, View } from "react-native";

import { AppText } from "@/components/app-text";
import { TickIcon } from "@/components/icons";
import { colors } from "@/lib/theme";

export function CheckRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      className="mb-4 min-h-[44px] flex-row items-center active:opacity-70">
      <View className={`mr-3 h-6 w-6 items-center justify-center rounded border-2 ${checked ? "border-stamp bg-stamp" : "border-ink bg-paper"}`}>
        {checked ? <TickIcon size={14} color={colors.paper} /> : null}
      </View>
      <View className="flex-1">
        <AppText>{label}</AppText>
        {hint ? (
          <AppText size="sm" tone="ink3">
            {hint}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}
