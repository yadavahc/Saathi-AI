/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./dashboard/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 950: "#07090d", 900: "#0b0f15", 850: "#10151d", 800: "#151b25", 700: "#1d2531", 600: "#2a3442", 500: "#3b4757" },
        brand: { 300: "#7ee0c3", 400: "#3fd0a6", 500: "#16b88a", 600: "#0e9470" },
        saffron: { 400: "#ffb547", 500: "#f59e0b" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular"],
      },
      keyframes: {
        pulseRing: { "0%": { boxShadow: "0 0 0 0 rgba(63,208,166,.55)" }, "100%": { boxShadow: "0 0 0 14px rgba(63,208,166,0)" } },
        slideUp: { "0%": { opacity: 0, transform: "translateY(8px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
        flow: { "0%": { backgroundPosition: "0% 50%" }, "100%": { backgroundPosition: "200% 50%" } },
      },
      animation: {
        pulseRing: "pulseRing 1.4s ease-out infinite",
        slideUp: "slideUp .35s ease-out both",
        flow: "flow 2.2s linear infinite",
      },
    },
  },
  plugins: [],
};
