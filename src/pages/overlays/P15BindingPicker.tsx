import { useMemo, useState } from 'react'
import { Ban, Check } from 'lucide-react'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Tag } from '@/components/ui/StatusTag'
import type { Route } from '@/core/types'
import { cn } from '@/lib/cn'
import { closeOverlay } from '@/router/router'
import { commandBus } from '@/services/commandBus'
import { canEdit, useRole } from '@/stores/context'
import { toast } from '@/stores/toast'

interface Candidate {
  id: string
  label: string
  type: string
  view: string
  /** 不兼容原因；存在即不可选（BindingService 的类型检查结果）。 */
  incompatible?: string
}

/** 候选来源为示意；正式版由 BindingService 按期望类型、作用域与读取视图返回。 */
const CANDIDATES: Candidate[] = [
  { id: 'n-min.out', label: 'Min · 输出', type: 'deltaK', view: '本 system 暂存' },
  { id: 'n-room.out', label: 'CoolingRoom · 可降温额度', type: 'deltaK', view: '旧值 State[n]' },
  { id: 'param.request', label: '参数 · 单路请求降温', type: 'deltaK', view: '运行参数' },
  { id: 'thermal.temperature', label: 'Thermal · 温度', type: 'degC', view: '旧值 State[n]', incompatible: '量种不符：期望温差 K，来源为绝对温度 °C' },
  { id: 'combustion.active', label: 'Combustion · 活跃', type: 'bool', view: '旧值 State[n]' },
  { id: 'combustion.discovered', label: 'Combustion · 已发现', type: 'bool', view: '旧值 State[n]' },
  { id: 'policy.minQualified', label: '策略 · 最低合格比例', type: 'ratio', view: '策略参数' },
  { id: 'cool-B.staged', label: 'cool-B · 暂存降温', type: 'deltaK', view: '其他 system 暂存', incompatible: '不可见：同回合其他 system 的暂存值不可读取' },
]

/** P15 属性与变量绑定选择器（模态）：确认生成一次 patch；取消不产生变化。 */
export default function P15BindingPicker({ route }: { route: Route }) {
  const role = useRole()
  const expected = route.params.expectedType ?? 'deltaK'
  const options = useMemo(() => CANDIDATES.filter((c) => c.type === expected || c.incompatible), [expected])
  const [picked, setPicked] = useState<string | null>(null)
  const target = [route.params.nodeId, route.params.portId].filter(Boolean).join('.') || route.params.returnPage || '目标端口'

  const confirm = () => {
    if (!picked) return
    const ok = commandBus.draft({ type: 'BindPort', label: `绑定 ${target} ← ${picked}`, targetId: `binding:${target}`, patch: { source: picked } })
    if (!ok) return
    closeOverlay({ kind: 'confirm', payload: { target, source: picked } })
    toast(`已生成绑定 patch：${target} ← ${picked}`)
  }

  return (
    <Modal
      title="选择绑定来源"
      subtitle={
        <span>
          目标 <span className="font-mono text-ink-soft">{target}</span> · 期望 <span className="font-mono text-ink-soft">{expected}</span>
        </span>
      }
      width={640}
      onClose={() => closeOverlay({ kind: 'cancel' })}
      footer={
        <>
          <span className="mr-auto text-caption text-muted">候选为示意数据 · BindingService 待接入</span>
          <Button intent="ghost" onClick={() => closeOverlay({ kind: 'cancel' })}>
            取消
          </Button>
          <Button intent="primary" icon={Check} disabled={!picked || !canEdit(role)} onClick={confirm}>
            确认绑定
          </Button>
        </>
      }
    >
      <ul role="listbox" aria-label="绑定来源" className="divide-y divide-line">
        {options.map((c) => {
          const disabled = Boolean(c.incompatible)
          const selected = picked === c.id
          return (
            <li key={c.id} role="option" aria-selected={selected} aria-disabled={disabled || undefined}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setPicked(c.id)}
                onDoubleClick={() => {
                  setPicked(c.id)
                  if (!disabled) setTimeout(confirm, 0)
                }}
                className={cn(
                  'flex w-full items-center gap-3 px-5 py-3 text-left transition-colors',
                  disabled ? 'cursor-not-allowed bg-subtle/60' : selected ? 'bg-primary-soft' : 'hover:bg-subtle',
                )}
              >
                <span className={cn('grid h-4 w-4 shrink-0 place-items-center rounded-full border', selected ? 'border-primary bg-primary' : 'border-border bg-surface')}>
                  {selected ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-body', disabled ? 'text-muted' : 'text-ink')}>{c.label}</span>
                  <span className="block font-mono text-caption text-faint">{c.id}</span>
                  {c.incompatible ? (
                    <span className="mt-0.5 flex items-center gap-1 text-caption text-danger">
                      <Ban size={12} aria-hidden />
                      {c.incompatible}
                    </span>
                  ) : null}
                </span>
                <Tag size="sm" tone={c.type === expected ? 'primary' : 'neutral'}>
                  {c.type}
                </Tag>
                <span className="w-[108px] shrink-0 text-right text-caption text-muted">{c.view}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}
