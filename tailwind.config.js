/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#FF8FB4",
        primaryDark: "#E56B9A",
        secondary: "#B794F6",
        accent: "#7EE8FA",
        background: "#1A1525",
        surface: "#241D33",
        surfaceLight: "#3A2E4D",
        text: "#FFF5FA",
        textMuted: "#A89BB8",
        danger: "#FF5C7A",
        success: "#7EE8FA",
      },
      fontFamily: {
        heading: ["TsukimiRounded_400Regular"],
        headingBold: ["TsukimiRounded_600SemiBold"],
        body: ["Nunito_400Regular"],
        bodyBold: ["Nunito_700Bold"],
        accent: ["PottaOne_400Regular"],
      },
      borderRadius: {
        "2xl": "20px",
        "3xl": "28px",
        "4xl": "36px",
      },
    },
  },
  plugins: [],
};