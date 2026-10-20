import { createStore, useStore } from '@/lib/store'

/**
 * PlaybackStore：只保存演示时间、速度与相机。暂停播放不改变已提交 commit。
 * 降低动画设置不影响模拟步长与事件顺序。
 */
interface PlaybackState {
  runId: string | null
  commitId: string | null
  progress: number
  paused: boolean
  durationMs: number
}

export const playbackStore = createStore<PlaybackState>({
  runId: null,
  commitId: null,
  progress: 0,
  paused: false,
  durationMs: 1000,
})

let timer: ReturnType<typeof setInterval> | null = null
let onFinish: (() => void) | null = null
const TICK = 50

export function startPlayback(runId: string, commitId: string, seconds: number, done: () => void) {
  stopTimer()
  onFinish = done
  playbackStore.setState({ runId, commitId, progress: 0, paused: false, durationMs: Math.max(200, seconds * 1000) })
  timer = setInterval(() => {
    const s = playbackStore.getState()
    if (s.paused) return
    const progress = Math.min(1, s.progress + TICK / s.durationMs)
    playbackStore.setState({ progress })
    if (progress >= 1) finish()
  }, TICK)
}

function stopTimer() {
  if (timer) clearInterval(timer)
  timer = null
}

function finish() {
  stopTimer()
  const done = onFinish
  onFinish = null
  playbackStore.setState({ runId: null, commitId: null, progress: 0, paused: false })
  done?.()
}

export function togglePlaybackPause() {
  playbackStore.setState((s) => ({ paused: !s.paused }))
}

export function usePlayback<S>(selector: (s: PlaybackState) => S): S {
  return useStore(playbackStore, selector)
}
