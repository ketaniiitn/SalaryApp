import { useEffect, useRef, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import Animated, { FadeIn, FadeOut, useReducedMotion } from "react-native-reanimated";

import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { AlertIcon, ClockIcon, DashIcon, InfoIcon, TickIcon } from "@/components/icons";
import { formatRupees } from "@/lib/pay";
import { colors } from "@/lib/theme";

/* ---------------- money ---------------- */

/** The one number on a screen: a quiet label, then the amount large. */
export function Total({ label, amount, size = "hero" }: { label: string; amount: number; size?: "hero" | "md" }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${formatRupees(amount)}`}>
      <AppText variant="medium" size="sm" tone="ink3">
        {label}
      </AppText>
      <View className="mt-1 flex-row items-start">
        <AppText variant="figure" tone="ink2" style={{ fontSize: size === "hero" ? 28 : 22, lineHeight: size === "hero" ? 40 : 34, marginRight: 2 }}>
          ₹
        </AppText>
        <AppText variant="display" size={size}>
          {formatRupees(amount).slice(1)}
        </AppText>
      </View>
    </View>
  );
}

/** "Earned so far          ₹26,677", with a hairline under each pair. */
export function Leader({ label, value }: { label: string; value: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} className="flex-row items-center justify-between border-b border-rule py-2.5">
      <AppText size="base" tone="ink2">
        {label}
      </AppText>
      <AppText variant="figure" size="lg">
        {value}
      </AppText>
    </View>
  );
}

/** A small green tag for the date, "Saved", "Created". */
export function Stamp({ label, tick = false, big = false }: { label: string; tick?: boolean; big?: boolean }) {
  return (
    <View className={`flex-row items-center self-start rounded-md bg-stampsoft ${big ? "px-3 py-1.5" : "px-2 py-1"}`}>
      {tick ? (
        <View className="mr-1.5">
          <TickIcon color={colors.stamp} size={big ? 16 : 13} />
        </View>
      ) : null}
      <AppText variant="semibold" size={big ? "base" : "xs"} tone="stamp">
        {label}
      </AppText>
    </View>
  );
}

/** Never a minus sign. If they got more than they earned, it is tagged "Given ahead". */
export function AheadStamp({ amount, big = false }: { amount: number; big?: boolean }) {
  return (
    <View
      accessible
      accessibilityLabel={`Given ahead ${formatRupees(amount)}`}
      className={`rounded-md bg-stampsoft ${big ? "items-start self-start px-4 py-2.5" : "items-end px-2.5 py-1"}`}>
      <AppText variant="semibold" size="xs" tone="stamp">
        Given ahead
      </AppText>
      <AppText variant="display" size={big ? "md" : "h2"} tone="stamp">
        {formatRupees(amount)}
      </AppText>
    </View>
  );
}

/* ---------------- presence marks ---------------- */

export type MarkKind = "present" | "away" | "waiting";

/** Present: solid green circle with a tick. Not here: dashed empty circle. Joins later: square with a clock. */
export function Mark({ kind, size = 32 }: { kind: MarkKind; size?: number }) {
  if (kind === "present") {
    return (
      <View className="items-center justify-center rounded-full bg-stamp" style={{ width: size, height: size }}>
        <TickIcon size={size / 2} />
      </View>
    );
  }
  if (kind === "away") {
    return (
      <View
        className="items-center justify-center rounded-full"
        style={{ width: size, height: size, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.ink3 }}>
        <DashIcon size={size * 0.44} />
      </View>
    );
  }
  return (
    <View className="items-center justify-center rounded-md" style={{ width: size, height: size, borderWidth: 1.5, borderColor: colors.faint }}>
      <ClockIcon size={size / 2} />
    </View>
  );
}

/** The right side of an attendance row. */
export function Pill({ kind, label, faded = false }: { kind: MarkKind; label: string; faded?: boolean }) {
  const style =
    kind === "present"
      ? "bg-stamp border-2 border-stamp"
      : kind === "away"
        ? "border-2 border-dashed border-ink3"
        : "border-2 border-rule2";
  return (
    <View className={`h-[46px] min-w-[132px] flex-row items-center justify-center rounded-md px-3.5 ${style} ${faded ? "opacity-60" : ""}`}>
      <View className="mr-2">
        {kind === "present" ? <TickIcon size={18} /> : kind === "away" ? <DashIcon size={16} /> : <ClockIcon size={16} />}
      </View>
      <AppText variant="bold" tone={kind === "present" ? "sheet" : kind === "away" ? "ink2" : "ink3"}>
        {label}
      </AppText>
    </View>
  );
}

/* ---------------- rows ---------------- */

export function RowLine({ first = false }: { first?: boolean }) {
  return <View className={first ? "border-t border-rule" : ""} />;
}

/** At least 76 px tall. The whole row is the tap target. */
export function Row({
  left,
  title,
  subtitle,
  right,
  onPress,
  accessibilityLabel,
  titleStyle = "name",
  highlight = false,
}: {
  left?: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  titleStyle?: "name" | "book" | "amount";
  highlight?: boolean;
}) {
  const body = (
    <>
      {left ? <View className="mr-3.5">{left}</View> : null}
      <View className="flex-1">
        <AppText
          variant={titleStyle === "name" ? "semibold" : titleStyle === "book" ? "semibold" : "figure"}
          size={titleStyle === "name" ? "lg" : titleStyle === "book" ? "xl" : "h3"}
          numberOfLines={2}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText tone="ink3" size="sm" className="mt-0.5">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right ? <View className="ml-3">{right}</View> : null}
    </>
  );
  const cls = `min-h-[68px] flex-row items-center border-b border-rule py-3 ${highlight ? "-mx-5 bg-stampsoft px-5" : ""}`;
  if (!onPress) return <View className={cls}>{body}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} className={`${cls} active:opacity-70`}>
      {body}
    </Pressable>
  );
}

/** Right side of a person row: what is still to pay, given ahead, or when they join. */
export function Owed({ payable, joinsOn }: { payable: number; joinsOn?: string | null }) {
  if (joinsOn) {
    return (
      <View className="items-end">
        <AppText variant="bold">{`Joins ${joinsOn}`}</AppText>
        <AppText size="xs" tone="ink3" variant="medium">
          nothing yet
        </AppText>
      </View>
    );
  }
  if (payable < 0) return <AheadStamp amount={-payable} />;
  return (
    <View className="items-end">
      <AppText variant="figure" size="row">
        {formatRupees(payable)}
      </AppText>
      <AppText size="xs" tone="ink3" variant="medium">
        to pay
      </AppText>
    </View>
  );
}

export function SectionHead({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View className="mb-1 flex-row items-center justify-between border-b border-ink pb-2">
      <AppText variant="semibold" size="lg" accessibilityRole="header">
        {title}
      </AppText>
      {right}
    </View>
  );
}

/* ---------------- messages ---------------- */

export function Banner({
  tone = "error",
  title,
  children,
  actions,
}: {
  tone?: "error" | "calm" | "info";
  title?: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  const edge = tone === "error" ? colors.cloth : tone === "info" ? colors.stamp : colors.rule2;
  return (
    <View
      accessibilityLiveRegion={tone === "error" ? "assertive" : "polite"}
      className="rounded-md bg-sheet px-4 py-3.5"
      style={{ borderLeftWidth: 3, borderLeftColor: edge }}>
      <View className="flex-row items-start">
        {tone === "error" ? (
          <View className="mr-3 mt-0.5">
            <AlertIcon size={22} />
          </View>
        ) : tone === "info" ? (
          <View className="mr-3 mt-0.5">
            <InfoIcon />
          </View>
        ) : null}
        <AppText className="flex-1" size="base">
          {title ? <AppText variant="bold">{`${title} `}</AppText> : null}
          {children}
        </AppText>
      </View>
      {actions ? <View className="mt-3 flex-row gap-2.5">{actions}</View> : null}
    </View>
  );
}

/** Error banner with a full-width Try again. */
export function LoadError({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <Banner title={title} actions={<Button label="Try again" variant="line" small className="flex-1" onPress={onRetry} />}>
      {message}
    </Banner>
  );
}

/** Dark strip near the bottom. Fades away on its own; the action (Undo) stays tappable until then. */
export function Toast({
  message,
  actionLabel,
  onAction,
  onDone,
  bottom,
  duration = 6000,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDone: () => void;
  bottom: number;
  duration?: number;
}) {
  const reducedMotion = useReducedMotion();
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const timer = setTimeout(() => done.current(), duration);
    return () => clearTimeout(timer);
  }, [duration, message]);

  return (
    // Position lives in style: NativeWind classes don't reach Reanimated's Animated.View.
    <Animated.View
      entering={reducedMotion ? undefined : FadeIn.duration(160)}
      exiting={reducedMotion ? undefined : FadeOut.duration(160)}
      style={{ position: "absolute", left: 16, right: 16, bottom }}>
      <View
        accessibilityLiveRegion="polite"
        className="flex-row items-center justify-between rounded-lg bg-ink py-2.5 pl-[18px] pr-2.5"
        style={{ elevation: 4, shadowColor: colors.ink, shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
      <AppText variant="semibold" tone="sheet" className="flex-1 pr-3">
        {message}
      </AppText>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          className="h-10 items-center justify-center rounded-md border-2 border-paper px-3.5 active:opacity-70">
          <AppText variant="bold" tone="sheet">
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
      </View>
    </Animated.View>
  );
}

export function Skeleton({ width, height, round = false, className }: { width: number | `${number}%`; height: number; round?: boolean; className?: string }) {
  return <View className={`bg-skel ${round ? "rounded-full" : "rounded-md"} ${className ?? ""}`} style={{ width, height }} />;
}

export function Empty({ art, title, children }: { art: ReactNode; title: string; children: ReactNode }) {
  return (
    <View className="items-center px-2 py-6">
      {art}
      <AppText variant="display" size="h3" className="mt-4 text-center">
        {title}
      </AppText>
      <AppText size="base" tone="ink2" className="mt-2 max-w-[320px] text-center">
        {children}
      </AppText>
    </View>
  );
}

/* ---------------- inputs ---------------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View accessibilityRole="radiogroup" className="h-[50px] flex-row overflow-hidden rounded-md border-2 border-ink bg-paper">
      {options.map((option, index) => {
        const on = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(option.value)}
            className={`flex-1 items-center justify-center ${on ? "bg-ink" : "active:bg-sheet"}`}
            style={index > 0 ? { borderLeftWidth: 1.5, borderLeftColor: colors.ink } : undefined}>
            <AppText variant="semibold" tone={on ? "sheet" : "ink"}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  error = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  error?: boolean;
}) {
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "increment") onChange(Math.min(max, value + 1));
        if (event.nativeEvent.actionName === "decrement") onChange(Math.max(min, value - 1));
      }}
      className={`h-[54px] flex-row overflow-hidden rounded-md border-2 bg-paper ${error ? "border-cloth" : "border-rule2"}`}>
      <Pressable
        accessibilityLabel="One less"
        disabled={value <= min}
        onPress={() => onChange(Math.max(min, value - 1))}
        className="w-[58px] items-center justify-center active:bg-skel disabled:opacity-30">
        <AppText variant="bold" size="title">
          −
        </AppText>
      </Pressable>
      <View className="flex-1 items-center justify-center border-x border-rule">
        <AppText variant="display" size="h3">
          {value}
        </AppText>
      </View>
      <Pressable
        accessibilityLabel="One more"
        disabled={value >= max}
        onPress={() => onChange(Math.min(max, value + 1))}
        className="w-[58px] items-center justify-center active:bg-skel disabled:opacity-30">
        <AppText variant="bold" size="title">
          +
        </AppText>
      </Pressable>
    </View>
  );
}
