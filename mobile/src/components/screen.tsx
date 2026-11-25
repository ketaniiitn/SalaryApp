import { useWindowDimensions } from "react-native";

/** 20 px side margins on a phone; centred column on anything wider. */
export function useScreenPad(): number {
  const { width } = useWindowDimensions();
  const maxWidth = 560;
  if (width <= maxWidth + 40) return 20;
  return (width - maxWidth) / 2;
}
