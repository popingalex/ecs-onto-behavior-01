// 纯 TS 行为测试入口：用 Vite SSR 加载 src/**/__tests__/*.test.ts（复用 @ 别名与 TS 转译），
// 依次执行每个导出函数；任一失败则以非零码退出。
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const files = readdirSync(path.join(root, 'src'), { recursive: true })
  .map(String)
  .filter((f) => /(^|[\\/])__tests__[\\/].+\.test\.ts$/.test(f))
  .sort()

const server = await createServer({
  root,
  configFile: false,
  logLevel: 'error',
  resolve: { alias: { '@': path.join(root, 'src') } },
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
})

let passed = 0
let failed = 0
try {
  for (const file of files) {
    const mod = await server.ssrLoadModule(path.join(root, 'src', file))
    for (const [name, fn] of Object.entries(mod)) {
      if (typeof fn !== 'function') continue
      try {
        await fn()
        passed++
        console.log(`  ok   ${file} › ${name}`)
      } catch (error) {
        failed++
        console.error(`  FAIL ${file} › ${name}\n${error?.stack ?? error}`)
      }
    }
  }
} finally {
  await server.close()
}
console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0 || passed === 0) process.exitCode = 1
