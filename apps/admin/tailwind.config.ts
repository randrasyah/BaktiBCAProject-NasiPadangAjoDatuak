import type { Config } from "tailwindcss";

// Tema cream → brown. Hex persis dari CLAUDE.md §9. (Sama dengan customer app.)
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          50: "#FBF7F0", // background utama
          100: "#F5EDE0",
        },
        tan: {
          200: "#E8D8C3", // border / card surface
        },
        brown: {
          400: "#B08968", // aksen sekunder
          600: "#8B5E3C", // tombol utama / aksen
          800: "#5C3D2E", // teks utama / heading
          900: "#3E2A20", // teks gelap
        },
        accent: "#C77F43", // highlight / harga / CTA hover (terracotta)
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
