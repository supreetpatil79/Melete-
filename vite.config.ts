import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
      },
      "/healthz": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
      },
      "/readyz": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
      },
      "/metrics": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
      },
    },
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "es2020",
    sourcemap: mode === "development",
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("@monaco-editor") || id.includes("monaco-editor")) return "editor-vendor";
          if (id.includes("recharts")) return "charts-vendor";
          return "vendor";
        },
      },
    },
  },
}));
