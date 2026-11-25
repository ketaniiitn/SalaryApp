import { Text, type TextProps } from "react-native";

const variantClass = {
  body: "font-sans",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
  /** Geist 700: screen titles and the big money figure. */
  display: "font-display",
  /** Geist 600: amounts in rows and summary lines. */
  figure: "font-figure",
} as const;

const sizeClass = {
  xs: "text-[13px] leading-[18px]",
  sm: "text-[14px] leading-[20px]",
  base: "text-[16px] leading-[23px]",
  lg: "text-[17px] leading-[24px]",
  xl: "text-[18px] leading-[25px]",
  h2: "text-[19px] leading-[26px]",
  row: "text-[19px] leading-[26px]",
  h3: "text-[21px] leading-[28px]",
  title: "text-[28px] leading-[34px]",
  count: "text-[36px] leading-[42px]",
  md: "text-[40px] leading-[46px]",
  hero: "text-[48px] leading-[54px]",
} as const;

/** Tighter tracking as type gets larger, measured in points. */
const tracking: Record<keyof typeof sizeClass, number> = {
  xs: 0,
  sm: 0,
  base: 0,
  lg: -0.1,
  xl: -0.15,
  h2: -0.2,
  row: -0.2,
  h3: -0.35,
  title: -0.7,
  count: -1,
  md: -1.2,
  hero: -1.6,
};

const toneClass = {
  ink: "text-ink",
  ink2: "text-ink2",
  ink3: "text-ink3",
  faint: "text-faint",
  cloth: "text-cloth",
  clothink: "text-clothink",
  stamp: "text-stamp",
  sheet: "text-paper",
} as const;

export type TextTone = keyof typeof toneClass;

type Props = TextProps & {
  variant?: keyof typeof variantClass;
  size?: keyof typeof sizeClass;
  tone?: TextTone;
};

export function AppText({ variant = "body", size = "base", tone = "ink", className, style, ...props }: Props) {
  const heading = variant === "display" || variant === "figure";
  return (
    <Text
      maxFontSizeMultiplier={1.6}
      className={`${variantClass[variant]} ${sizeClass[size]} ${toneClass[tone]} ${className ?? ""}`}
      style={[heading ? { letterSpacing: tracking[size], fontVariant: ["tabular-nums"] } : undefined, style]}
      {...props}
    />
  );
}
