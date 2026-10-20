import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { PAGE_SPECS } from '@/navigation/pages'
import { cancelPendingNavigation, usePendingNavigation } from '@/router/router'

/** 离开守卫：保存并继续 / 放弃修改 / 留在此页。 */
export default function LeaveGuardDialog() {
  const pending = usePendingNavigation()
  const [saving, setSaving] = useState(false)
  if (!pending) return null
  const target = PAGE_SPECS[pending.to.pageId]
  return (
    <Modal
      title={pending.reason}
      width={480}
      onClose={cancelPendingNavigation}
      footer={
        <>
          <Button intent="ghost" onClick={cancelPendingNavigation}>
            留在此页
          </Button>
          <Button
            intent="danger-ghost"
            onClick={() => {
              pending.discard()
              pending.proceed()
            }}
          >
            放弃修改并离开
          </Button>
          <Button
            intent="primary"
            busy={saving}
            onClick={async () => {
              setSaving(true)
              const ok = await pending.save()
              setSaving(false)
              if (ok) pending.proceed()
            }}
          >
            保存并继续
          </Button>
        </>
      }
    >
      <div className="flex gap-3 px-5 py-4">
        <TriangleAlert size={20} className="mt-0.5 shrink-0 text-warning" aria-hidden />
        <div className="text-body text-ink-soft">
          <p>{pending.detail}</p>
          <p className="mt-2 text-label text-muted">
            目标：<span className="font-mono">{target.id}</span> {target.title}
          </p>
        </div>
      </div>
    </Modal>
  )
}
