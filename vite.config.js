import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    open: true,
    // 👇 重点：代理配置
    proxy: {
      "/api": {
        target: "https://new.inmad.cn", // 你的后端域名
        changeOrigin: true, // 允许跨域
        rewrite: (path) => path.replace(/^\/api/, ""), // 去掉 /api 前缀
      },
    },
  },
});
