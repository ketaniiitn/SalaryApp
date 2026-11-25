/** Ledger palette for places that need a raw colour (SVG, status bar, inline styles). Keep in sync with tailwind.config.js. */
export const colors = {
  paper: "#FFFFFF",
  sheet: "#F4F5F6",
  rule: "#E3E5E8",
  rule2: "#C4C8CE",
  ink: "#15171B",
  ink2: "#3D424B",
  ink3: "#646A74",
  faint: "#A2A7AF",
  cloth: "#B3261E",
  clothInk: "#FFFFFF",
  stamp: "#0B6E5F",
  stampSoft: "#E3F1EE",
  skel: "#ECEEF0",
  off: "#E3E5E8",
} as const;

export const fonts = {
  display: "Geist_700Bold",
  figure: "Geist_600SemiBold",
  sans: "Geist_400Regular",
  medium: "Geist_500Medium",
  semibold: "Geist_600SemiBold",
  bold: "Geist_600SemiBold",
} as const;
