// W5 性能/容量基线驱动：用 Vite SSR 加载 src/services/mock-executor/perfBaseline.ts。
// 环境信息（机器/Node/commit）在此采集，与测量结果一起打印。
import os from 'node:os'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const commit = execSync('git rev-parse HEAD', { cwd: root }).toString().trim()
const dirty = execSync('git status --porcelain', { cwd: root }).toString().trim()
console.log(`环境：${os.cpus()[0]?.model ?? os.arch()} · ${Math.round(os.totalmem() / 1024 ** 3)} GiB RAM · ${os.platform()} ${os.release()}`)
console.log(`Node ${process.version} · commit ${commit}${dirty ? '（含未提交 W1–W5 改动）' : ''}`)

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
    path.join(root, 'src/services/mock-executor/perfBaseline.ts'),
  )
  console.log(await mod.runPerfBaseline())
} finally {
  await server.close()
}
