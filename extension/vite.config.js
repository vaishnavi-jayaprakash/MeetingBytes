import { defineConfig } from "vite";

export default defineConfig({
  base: "",
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        popup: "popup.html"
      }
    }
  }
});
