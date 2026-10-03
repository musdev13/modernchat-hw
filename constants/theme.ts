// constants/theme.ts
export const COLORS = {
  primary: "#FF8FB4",
  primaryDark: "#E56B9A",
  secondary: "#B794F6",
  accent: "#7EE8FA",
  background: "#1A1525",
  surface: "#241D33",
  surfaceLight: "#3A2E4D",
  white: "#FFFFFF",
  text: "#FFF5FA",
  textMuted: "#A89BB8",
  danger: "#FF5C7A",
  success: "#7EE8FA",
} as const;

export const GRADIENTS = {
  primary: ["#FF8FB4", "#B794F6"] as const,
  accent: ["#7EE8FA", "#B794F6"] as const,
  bubbleMine: ["#FF8FB4", "#E56B9A"] as const,
  bubbleOther: ["#241D33", "#2E2540"] as const,
} as const;

export const FONTS = {
  heading: "TsukimiRounded_400Regular",
  headingBold: "TsukimiRounded_600SemiBold",
  body: "Nunito_400Regular",
  bodyBold: "Nunito_700Bold",
  accent: "PottaOne_400Regular",
} as const;