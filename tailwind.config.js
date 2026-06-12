/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9eaff",
          200: "#bcd9ff",
          300: "#8ec1ff",
          400: "#599dff",
          500: "#3377f5",
          600: "#1f59e0",
          700: "#1a47bd",
          800: "#1b3d99",
          900: "#1c3679",
        },
      },
    },
  },
  plugins: [],
};
