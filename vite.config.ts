import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Minify for production
    minify: "esbuild",
    // Code splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor libraries
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-radix": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-label",
            "@radix-ui/react-select",
            "@radix-ui/react-toggle-group",
          ],
          "vendor-icons": ["lucide-react"],
        },
      },
    },
    // Target modern browsers for smaller bundles
    target: "esnext",
    // Enable CSS code splitting
    cssCodeSplit: true,
  },
  server: {
    proxy: {
      "/shorten": "http://localhost:3006",
      "/auth": "http://localhost:3006",
      "/api": "http://localhost:3006",
    },
  },
});
