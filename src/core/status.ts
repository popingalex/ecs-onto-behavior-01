/**
 * 状态标签词表（01_layout「状态标签最少区分」）。
 * 每个状态都有文字；颜色只是辅助，不单独承担含义。
 */
export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'purple'

export type StatusKey =
  | 'draft'
  | 'dirty'
  | 'saving'
  | 'saved'
  | 'saveFailed'
  | 'unvalidated'
  | 'validating'
  | 'valid'
  | 'validationStale'
  | 'validationFailed'
  | 'published'
  | 'publishing'
  | 'queued'
  | 'waitingInputs'
  | 'frozen'
  | 'computing'
  | 'committing'
  | 'committed'
  | 'playing'
  | 'playbackPaused'
  | 'failed'
  | 'history'
  | 'head'
  | 'offline'
  | 'readonly'
  | 'pendingDecision'
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'selfPreview'
  | 'draftChange'
  | 'stub'
  | 'checkpoint'
  | 'noPosition'

export interface StatusMeta {
  label: string
  tone: Tone
}

export const STATUS: Record<StatusKey, StatusMeta> = {
  draft: { label: '草稿', tone: 'neutral' },
  dirty: { label: '未保存', tone: 'warning' },
  saving: { label: '保存中', tone: 'primary' },
  saved: { label: '已保存', tone: 'success' },
  saveFailed: { label: '保存失败', tone: 'danger' },
  unvalidated: { label: '未校验', tone: 'neutral' },
  validating: { label: '校验中', tone: 'primary' },
  valid: { label: '校验通过', tone: 'success' },
  validationStale: { label: '校验过期', tone: 'warning' },
  validationFailed: { label: '校验失败', tone: 'danger' },
  published: { label: '已发布', tone: 'primary' },
  publishing: { label: '发布中', tone: 'primary' },
  queued: { label: '排队', tone: 'neutral' },
  waitingInputs: { label: '等待输入', tone: 'neutral' },
  frozen: { label: '已冻结', tone: 'purple' },
  computing: { label: '计算中', tone: 'primary' },
  committing: { label: '提交中', tone: 'primary' },
  committed: { label: '已提交', tone: 'success' },
  playing: { label: '播放中', tone: 'primary' },
  playbackPaused: { label: '播放暂停', tone: 'warning' },
  failed: { label: '失败', tone: 'danger' },
  history: { label: '历史查看', tone: 'warning' },
  head: { label: '分支头', tone: 'success' },
  offline: { label: '离线', tone: 'danger' },
  readonly: { label: '只读', tone: 'neutral' },
  pendingDecision: { label: '待裁决', tone: 'neutral' },
  requested: { label: '请求', tone: 'purple' },
  approved: { label: '已获准', tone: 'success' },
  rejected: { label: '已拒绝', tone: 'danger' },
  selfPreview: { label: '暂存预览', tone: 'purple' },
  draftChange: { label: '草稿修改', tone: 'warning' },
  stub: { label: '规格待接入', tone: 'neutral' },
  checkpoint: { label: '检查点', tone: 'neutral' },
  noPosition: { label: '无位置', tone: 'neutral' },
}
