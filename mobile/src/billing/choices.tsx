import { Pressable, View } from "react-native";

import { AppText } from "@/components/app-text";
import { colors } from "@/lib/theme";

/** An outlined tab bar. Up to four sit on one row; longer sets wrap into rows of three or four. */
export function Choices<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (id: T) => void;
}) {
  const perRow = options.length <= 4 ? options.length : options.length <= 6 ? 3 : 4;
  const rows: { id: T; label: string }[][] = [];
  for (let index = 0; index < options.length; index += perRow) rows.push(options.slice(index, index + perRow));

  return (
    <View className="mb-5">
      <AppText variant="medium" size="sm" tone="ink2" className="mb-1.5">
        {label}
      </AppText>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} className="overflow-hidden rounded-md border-2 border-ink bg-paper">
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} className="flex-row" style={rowIndex > 0 ? { borderTopWidth: 1.5, borderTopColor: colors.ink } : undefined}>
            {row.map((option, index) => {
              const selected = option.id === value;
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => onChange(option.id)}
                  className={`h-[46px] items-center justify-center px-2 ${selected ? "bg-ink" : "active:bg-sheet"}`}
                  style={{
                    flex: 1,
                    borderLeftWidth: index > 0 ? 1.5 : 0,
                    borderLeftColor: colors.ink,
                  }}>
                  <AppText variant="semibold" size="sm" tone={selected ? "sheet" : "ink"} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                    {option.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}
