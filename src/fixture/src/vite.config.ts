import { defineConfig } from "vite";
import preactPlugin from "@preact/preset-vite";

export default defineConfig({
  base: "",
  plugins: [preactPlugin()],
});
