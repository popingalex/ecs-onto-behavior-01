import path from "node:path"
import { fileURLToPath } from "node:url"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const here = path.dirname(fileURLToPath(import.meta.url))

// W5.1 StrictMode 隔离宿主专用：独立 root，不带 figma-make 插件；
// alias @ 指向仓库 src（本最小复现不依赖它，仅为可扩展）。
export default defineConfig({
  root: here,
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(here, "../../../../src") } },
  server: { port: 8555, strictPort: true },
})
