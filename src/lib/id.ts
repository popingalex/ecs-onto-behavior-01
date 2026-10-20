let counter = 0

/** 本地生成的稳定 token / 命令 ID。正式版由 core 分配。 */
export function createId(prefix: string): string {
  counter += 1
  const rand = Math.random().toString(36).slice(2, 6)
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}${rand}`
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
