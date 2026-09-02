/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brandBlue: "#1e3a5f",
        brandGold: "#c9a84c",
      },
    },
  },
  plugins: [],
};
