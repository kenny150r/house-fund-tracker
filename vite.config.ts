import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// `base` must match the GitHub Pages path. For a project page served at
// https://<user>.github.io/<repo>/ set VITE_BASE="/<repo>/" at build time.
// For a user/org page (https://<user>.github.io/) leave it as "/".
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    base: env.VITE_BASE || "/",
    plugins: [react()],
  };
});
