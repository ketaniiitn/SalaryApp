/** @type {import('tailwindcss').Config} */
// Ledger palette. Keep in sync with src/lib/theme.ts.
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  // The app is light only. "class" stops NativeWind on web from throwing when the browser flips the page's colour scheme.
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        paper: "#FFFFFF", // the page
        sheet: "#F4F5F6", // panels, fields, boxes
        rule: "#E3E5E8", // hairlines between rows
        rule2: "#C4C8CE", // field borders at rest
        ink: "#15171B", // text, outlines, selected tabs
        ink2: "#3D424B", // secondary text
        ink3: "#646A74", // labels and hints
        faint: "#A2A7AF", // future days, placeholders
        cloth: "#B3261E", // problems only
        clothink: "#FFFFFF", // text on a filled button
        stamp: "#0B6E5F", // the one colour: main action, present, today, saved
        stampsoft: "#E3F1EE", // quiet green fill
        skel: "#ECEEF0", // loading blocks
        off: "#E3E5E8", // disabled button
      },
      fontFamily: {
        display: ["Geist_700Bold"],
        figure: ["Geist_600SemiBold"],
        sans: ["Geist_400Regular"],
        medium: ["Geist_500Medium"],
        semibold: ["Geist_600SemiBold"],
        bold: ["Geist_600SemiBold"],
      },
      // Thin, precise outlines and small corners. Screens keep their class names; these values set the look.
      borderWidth: {
        2: "1.5px",
      },
      borderRadius: {
        md: "4px",
        lg: "6px",
        xl: "6px",
        "2xl": "8px",
        "3xl": "14px",
      },
    },
  },
  plugins: [],
};
