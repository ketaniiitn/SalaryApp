import Svg, { Circle, Path, Rect } from "react-native-svg";

import { colors } from "@/lib/theme";

type IconProps = { size?: number; color?: string };

export function TickIcon({ size = 16, color = colors.paper }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function DashIcon({ size = 14, color = colors.ink3 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14">
      <Path d="M3 7h8" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
}

export function ClockIcon({ size = 16, color = colors.ink3 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Circle cx={8} cy={8} r={5.5} fill="none" stroke={color} strokeWidth={1.6} />
      <Path d="M8 5v3.2l2 1.4" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

export function ChevronLeft({ size = 22, color = colors.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Path d="M12 4l-6 6 6 6" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ChevronRight({ size = 22, color = colors.ink3 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Path d="M8 4l6 6-6 6" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ChevronDown({ size = 20, color = colors.ink2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Path d="M5 8l5 5 5-5" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SearchIcon({ size = 18, color = colors.ink3 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Circle cx={9} cy={9} r={5.5} fill="none" stroke={color} strokeWidth={1.8} />
      <Path d="M13.2 13.2L17 17" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function PlusIcon({ size = 20, color = colors.paper }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Path d="M10 4v12M4 10h12" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
}

export function AlertIcon({ size = 20, color = colors.cloth }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Circle cx={10} cy={10} r={8.5} fill="none" stroke={color} strokeWidth={2} />
      <Path d="M10 5.5v5.5M10 14v.5" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

export function InfoIcon({ size = 22, color = colors.stamp }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Circle cx={8} cy={8} r={6.5} fill="none" stroke={color} strokeWidth={1.6} />
      <Path d="M8 7v4M8 4.8v.2" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function GearIcon({ size = 16, color = colors.ink3 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Circle cx={8} cy={8} r={2.4} fill="none" stroke={color} strokeWidth={1.6} />
      <Path
        d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function CalendarIcon({ size = 20, color = colors.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Rect x={3} y={4.5} width={14} height={12} rx={2} fill="none" stroke={color} strokeWidth={1.8} />
      <Path d="M3 8.5h14M7 2.5v4M13 2.5v4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function ReceiptIcon({ size = 44, color = colors.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M18 17H6v-2h12v2zm0-4H6v-2h12v2zm0-4H6V7h12v2zM3 22l1.5-1.5L6 22l1.5-1.5L9 22l1.5-1.5L12 22l1.5-1.5L15 22l1.5-1.5L18 22l1.5-1.5L21 22V2l-1.5 1.5L18 2l-1.5 1.5L15 2l-1.5 1.5L12 2l-1.5 1.5L9 2 7.5 3.5 6 2 4.5 3.5 3 2v20z"
      />
    </Svg>
  );
}

export function GroupIcon({ size = 44, color = colors.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
      />
    </Svg>
  );
}

export function BuildingIcon({ size = 44, color = colors.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"
      />
    </Svg>
  );
}

export function StoreIcon({ size = 30, color = colors.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M4.2 3.5h15.6l1.7 5.3a2.5 2.5 0 0 1-5 .2 2.25 2.25 0 0 1-4.5 0 2.25 2.25 0 0 1-4.5 0 2.5 2.5 0 0 1-5-.2z"
      />
      <Path d="M4.5 12.5V20.5h15v-8" fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
      <Path d="M8.5 15v3" stroke={color} strokeWidth={2.2} strokeLinecap="square" />
      <Rect x={13.2} y={14.6} width={3.4} height={6} fill={color} />
    </Svg>
  );
}

export function HomeIcon({ size = 44, color = colors.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
    </Svg>
  );
}

export function BookArt() {
  return (
    <Svg width={132} height={92} viewBox="0 0 132 92">
      <Path
        d="M66 18c-14-10-34-12-58-8v72c24-4 44-2 58 8 14-10 34-12 58-8V10c-24-4-44-2-58 8z"
        fill={colors.sheet}
        stroke={colors.ink}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path d="M66 18v72" stroke={colors.ink} strokeWidth={1.8} />
      <Path d="M20 30h34M20 42h34M20 54h26M78 30h34M78 42h34M78 54h20" stroke={colors.rule2} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M84 66l5 5 10-11" fill="none" stroke={colors.stamp} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function PeopleArt() {
  return (
    <Svg width={96} height={96} viewBox="0 0 96 96">
      <Circle cx={34} cy={34} r={14} fill="none" stroke={colors.ink} strokeWidth={1.8} />
      <Path d="M10 80c2-14 12-24 24-24s22 10 24 24" fill="none" stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={68} cy={40} r={11} fill="none" stroke={colors.rule2} strokeWidth={1.8} strokeDasharray="5 5" />
      <Path d="M54 78c2-10 8-17 16-18" fill="none" stroke={colors.rule2} strokeWidth={1.8} strokeLinecap="round" strokeDasharray="5 5" />
      <Path d="M76 66v16M68 74h16" stroke={colors.stamp} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

export function CashArt() {
  return (
    <Svg width={112} height={80} viewBox="0 0 112 80">
      <Rect x={10} y={18} width={80} height={46} rx={6} fill={colors.sheet} stroke={colors.ink} strokeWidth={1.8} />
      <Circle cx={50} cy={41} r={11} fill="none" stroke={colors.ink} strokeWidth={1.8} />
      <Path d="M20 28v26M80 28v26" stroke={colors.rule2} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M96 46v20M86 56h20" stroke={colors.stamp} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}
