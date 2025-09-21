import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // .env ファイルをロード
  console.log(mode);
  const basePath = mode === "login" ? "/login" : "/app";
  const distPath = mode === "login" ? "dist/login" : "functions/app";
  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        "/api": "http://localhost:5002",
      },
    },
    // 環境変数をViteに渡す
    base: basePath,
    build: {
      outDir: distPath,
    },
  };
});
