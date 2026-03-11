import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    // Polyfill process.env for @opencomputer/sdk browser compatibility
    "process.env": JSON.stringify({}),
  },
});
