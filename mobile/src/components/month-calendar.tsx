import { useRef, type ReactNode } from "react";
import { PanResponder, Pressable, View } from "react-native";

import { AppText } from "@/components/app-text";
import { ChevronLeft, ChevronRight } from "@/components/icons";
import { formatShortDate, monthLastDay, monthName } from "@/lib/pay";
import { colors } from "@/lib/theme";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

export type DayState = "present" | "away" | "faded" | "join" | "selected" | "open";

/**
 * A month of days, Sunday first. The caller decides how each day looks and whether it can be tapped.
 * Presence only: no money, notes or settings ever go in here.
 */
export function MonthGrid({
  month,
  today,
  dayState,
  onDayPress,
  isPending,
  onPrev,
  onNext,
  canPrev,
  canNext,
  title,
}: {
  month: string;
  today: string;
  dayState: (iso: string) => DayState;
  onDayPress?: (iso: string) => void;
  isPending?: (iso: string) => boolean;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  title?: string;
}) {
  const swipe = useRef({ onPrev, onNext, canPrev, canNext });
  swipe.current = { onPrev, onNext, canPrev, canNext };
  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_, g) => {
        if (g.dx > 60 && swipe.current.canPrev) swipe.current.onPrev();
        if (g.dx < -60 && swipe.current.canNext) swipe.current.onNext();
      },
    }),
  ).current;

  const [year, mon] = month.split("-").map(Number);
  const lead = new Date(year, mon - 1, 1).getDay();
  const last = Number(monthLastDay(month).slice(8));
  const cells: (string | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= last; d++) cells.push(`${month}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <View {...responder.panHandlers}>
      <View className="mb-1 flex-row items-center justify-between">
        <MonthArrow label="Earlier month" disabled={!canPrev} onPress={onPrev}>
          <ChevronLeft color={canPrev ? colors.ink : colors.faint} />
        </MonthArrow>
        <AppText variant="semibold" size="lg" accessibilityRole="header" accessibilityLiveRegion="polite">
          {title ?? `${monthName(month)} ${year}`}
        </AppText>
        <MonthArrow label="Later month" disabled={!canNext} onPress={onNext}>
          <ChevronRight color={canNext ? colors.ink : colors.faint} />
        </MonthArrow>
      </View>
      <View className="mb-1 flex-row border-b border-rule">
        {DOW.map((d, i) => (
          <AppText key={i} variant="medium" size="xs" tone="ink3" className="flex-1 pb-2 pt-1 text-center" importantForAccessibility="no">
            {d}
          </AppText>
        ))}
      </View>
      {weeks.map((week, w) => (
        <View key={w} className="mb-1.5 flex-row">
          {week.map((iso, i) => (
            <View key={i} className="flex-1 items-center">
              {iso ? (
                <Day
                  iso={iso}
                  state={dayState(iso)}
                  today={iso === today}
                  pending={isPending?.(iso) ?? false}
                  onPress={onDayPress}
                />
              ) : (
                <View style={{ width: 48, height: 48 }} />
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function MonthArrow({ label, disabled, onPress, children }: { label: string; disabled: boolean; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`h-10 w-10 items-center justify-center rounded-md border-2 active:bg-sheet ${disabled ? "border-rule" : "border-ink"}`}>
      {children}
    </Pressable>
  );
}

function Day({
  iso,
  state,
  today,
  pending,
  onPress,
}: {
  iso: string;
  state: DayState;
  today: boolean;
  pending: boolean;
  onPress?: (iso: string) => void;
}) {
  const day = String(Number(iso.slice(8)));
  const tappable = Boolean(onPress) && state !== "faded" && state !== "join";
  const words =
    state === "present" ? "present" : state === "away" ? "not here" : state === "join" ? "joining day" : state === "selected" ? "selected" : state === "open" ? "" : "not counted";

  const circle =
    state === "present"
      ? { backgroundColor: colors.stamp }
      : state === "selected"
        ? { backgroundColor: colors.ink }
        : state === "away"
          ? { borderWidth: 1.5, borderStyle: "dashed" as const, borderColor: colors.ink3 }
          : state === "join"
            ? { borderWidth: 1.5, borderColor: colors.stamp, borderRadius: 6 }
            : {};
  const textTone = state === "present" || state === "selected" ? "sheet" : state === "away" ? "ink2" : state === "join" ? "stamp" : state === "open" ? "ink" : "faint";

  const inner = (
    <View
      className="items-center justify-center rounded-full"
      style={[{ width: 40, height: 40, opacity: pending ? 0.5 : 1 }, circle]}>
      <AppText variant={state === "faded" ? "body" : "medium"} size="base" tone={textTone}>
        {day}
      </AppText>
      {today && state !== "present" && state !== "selected" ? (
        <View className="absolute bottom-1 h-1 w-1 rounded-full bg-stamp" />
      ) : null}
    </View>
  );

  const ring = today ? { borderWidth: 1.5, borderColor: colors.ink, borderRadius: 999, padding: 2.5 } : { padding: 4 };

  return (
    <Pressable
      accessibilityRole={tappable ? "button" : "text"}
      accessibilityLabel={`${formatShortDate(iso)}${today ? ", today" : ""}${words ? `, ${words}` : ""}`}
      accessibilityHint={tappable && (state === "present" || state === "away") ? "Double tap to switch Present and Not here" : undefined}
      disabled={!tappable}
      onPress={() => onPress?.(iso)}
      style={ring}
      className="active:opacity-70">
      {inner}
    </Pressable>
  );
}
