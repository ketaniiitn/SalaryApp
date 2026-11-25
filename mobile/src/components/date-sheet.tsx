import { useEffect, useState, type ReactNode } from "react";
import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { MonthGrid } from "@/components/month-calendar";
import { useScreenPad } from "@/components/screen";
import { shiftMonth, todayIso } from "@/lib/pay";

/** A bottom sheet over a dimmed page. */
export function BottomSheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const pad = useScreenPad();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 justify-end">
        <Pressable accessibilityLabel="Close" onPress={onClose} className="absolute inset-0" style={{ backgroundColor: "rgba(21,23,27,0.42)" }} />
        <View className="rounded-t-3xl bg-paper pt-2.5" style={{ paddingHorizontal: pad, paddingBottom: insets.bottom + 18 }}>
          <View className="mb-4 h-1 w-10 self-center rounded-full bg-rule2" />
          {children}
        </View>
      </View>
    </Modal>
  );
}

/** Pick one day between min and max. Tapping a day picks it and closes the sheet. */
export function DateSheet({
  visible,
  title,
  value,
  min,
  max,
  onPick,
  onClose,
}: {
  visible: boolean;
  title: string;
  value: string;
  min?: string;
  max?: string;
  onPick: (iso: string) => void;
  onClose: () => void;
}) {
  const [month, setMonth] = useState(value.slice(0, 7));
  useEffect(() => {
    if (visible) setMonth(value.slice(0, 7));
  }, [visible, value]);

  const minMonth = min?.slice(0, 7);
  const maxMonth = max?.slice(0, 7);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <AppText variant="display" size="h3" className="mb-3">
        {title}
      </AppText>
      <MonthGrid
        month={month}
        today={todayIso()}
        dayState={(iso) => {
          if ((min && iso < min) || (max && iso > max)) return "faded";
          return iso === value ? "selected" : "open";
        }}
        onDayPress={(iso) => {
          onPick(iso);
          onClose();
        }}
        onPrev={() => setMonth((m) => shiftMonth(m, -1))}
        onNext={() => setMonth((m) => shiftMonth(m, 1))}
        canPrev={!minMonth || month > minMonth}
        canNext={!maxMonth || month < maxMonth}
      />
      <Button label="Cancel" variant="text" onPress={onClose} />
    </BottomSheet>
  );
}
