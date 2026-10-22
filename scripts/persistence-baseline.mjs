// W4 持久化体积/恢复基线：用 Vite SSR 加载 src/stores/persistence/baseline.ts 并打印报告。
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const server = await createServer({
  root,
  configFile: false,
  logLevel: 'error',
  resolve: { alias: { '@': path.join(root, 'src') } },
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
})

try {
  const mod = await server.ssrLoadModule(
    path.join(root, 'src/stores/persistence/baseline.ts'),
  )
  console.log(await mod.runPersistenceBaseline())
} finally {
  await server.close()
}
