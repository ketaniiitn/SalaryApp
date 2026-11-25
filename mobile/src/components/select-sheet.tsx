import { useEffect, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";

import { AppText } from "@/components/app-text";
import { BottomSheet } from "@/components/date-sheet";
import { SearchIcon, TickIcon } from "@/components/icons";
import { colors } from "@/lib/theme";

/** A dropdown list in a bottom sheet. Long lists get a search box. Picking closes it. */
export function SelectSheet({
  visible,
  title,
  options,
  value,
  onPick,
  onClose,
  searchable = options.length > 10,
}: {
  visible: boolean;
  title: string;
  options: readonly string[];
  value?: string;
  onPick: (value: string) => void;
  onClose: () => void;
  searchable?: boolean;
}) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (visible) setQuery("");
  }, [visible]);
  const needle = query.trim().toLowerCase();
  const shown = needle ? options.filter((option) => option.toLowerCase().includes(needle)) : options;

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <AppText variant="display" size="h3" className="mb-3">
        {title}
      </AppText>
      {searchable ? (
        <View className="mb-2 h-11 flex-row items-center rounded-md border-2 border-rule2 bg-paper px-3">
          <SearchIcon />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor={colors.faint}
            autoCorrect={false}
            accessibilityLabel={`Search ${title}`}
            className="ml-2 h-full flex-1 font-sans text-[16px] text-ink"
          />
        </View>
      ) : null}
      <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled">
        <View className="border-t border-rule">
          {shown.map((option) => {
            const on = option === value;
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => {
                  onPick(option);
                  onClose();
                }}
                className={`min-h-[50px] flex-row items-center justify-between border-b border-rule px-1 active:bg-sheet ${on ? "bg-stampsoft" : ""}`}>
                <AppText size="lg" variant={on ? "semibold" : "body"} tone={on ? "stamp" : "ink"}>
                  {option}
                </AppText>
                {on ? <TickIcon color={colors.stamp} size={16} /> : null}
              </Pressable>
            );
          })}
          {shown.length === 0 ? (
            <AppText tone="ink3" className="py-4">
              Nothing matches that.
            </AppText>
          ) : null}
        </View>
      </ScrollView>
    </BottomSheet>
  );
}
