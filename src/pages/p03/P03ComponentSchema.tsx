import { useMemo } from 'react'
import { Crosshair, Plus, Ruler } from 'lucide-react'
import Button from '@/components/ui/Button'
import Card, { PanelHeader } from '@/components/ui/Card'
import { Tag } from '@/components/ui/StatusTag'
import Table, { Td, Th, Tr } from '@/components/ui/Table'
import ObjectLink from '@/components/domain/ObjectLink'
import PropertyGrid from '@/components/domain/PropertyGrid'
import ValidationList from '@/components/domain/ValidationList'
import { useIndex } from '@/data/store'
import { buildTransitionRoute } from '@/navigation/resolve'
import { findTransition } from '@/navigation/transitions'
import { navigate, useRoute } from '@/router/router'
import { effectiveProperty } from '@/services/coreValidation'
import { useDraft, validateDraft } from '@/stores/draft'

/** P03 组件与属性模式：属性表（C05）+ 跨对象诊断（C10）；编辑在检查器中进行。 */
export default function P03ComponentSchema() {
  const index = useIndex()
  const route = useRoute()
  const componentId = route.params.componentId
  if (!componentId) return <ComponentIndex />
  const component = index.components.get(componentId)
  if (!component) return null
  return <ComponentDetail componentId={componentId} selectedId={route.params.propertyId} />
}

function ComponentIndex() {
  const index = useIndex()
  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-6">
      <div>
        <h2 className="text-title font-semibold">组件</h2>
        <p className="mt-1 text-body text-muted">组件是属性的分组单元；选择一个组件查看属性模式。</p>
      </div>
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>组件</Th>
              <Th>说明</Th>
              <Th align="right">属性</Th>
              <Th>使用类型</Th>
            </tr>
          </thead>
          <tbody>
            {[...index.components.values()].map((c) => (
              <Tr key={c.id} onSelect={() => navigate({ pageId: 'P03', params: { componentId: c.id } })}>
                <Td>
                  <span className="font-medium">{c.label}</span>
                  <span className="ml-2 font-mono text-caption text-muted">{c.id}</span>
                </Td>
                <Td className="text-ink-soft">{c.description}</Td>
                <Td numeric>{index.propertiesByComponent.get(c.id)?.length ?? 0}</Td>
                <Td className="text-ink-soft">
                  {[...index.classes.values()]
                    .filter((cls) => cls.components.includes(c.id))
                    .map((cls) => cls.label)
                    .join('、')}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}

function ComponentDetail({ componentId, selectedId }: { componentId: string; selectedId?: string }) {
  const index = useIndex()
  const route = useRoute()
  const overlay = useDraft((s) => s.overlay)
  const diagnostics = useDraft((s) => s.diagnostics)
  const validatedRevision = useDraft((s) => s.validatedRevision)
  const revision = useDraft((s) => s.revision)
  const validating = useDraft((s) => s.validating)
  const component = index.components.get(componentId)!

  const base = index.propertiesByComponent.get(componentId) ?? []
  const properties = useMemo(() => base.map((p) => effectiveProperty(p, overlay)), [base, overlay])
  const changed = useMemo(() => {
    const out: Record<string, string[]> = {}
    for (const p of base) {
      const patch = overlay[p.id]
      if (!patch) continue
      const fields = Object.keys(patch).filter((k) => JSON.stringify(patch[k]) !== JSON.stringify((p as unknown as Record<string, unknown>)[k]))
      if (fields.length) out[p.id] = fields
    }
    return out
  }, [base, overlay])
  const usedBy = [...index.classes.values()].filter((cls) => cls.components.includes(componentId))
  const changedCount = Object.keys(changed).length

  const go = (action: string) => {
    const t = findTransition('P03', action)
    const target = t ? buildTransitionRoute(route, t) : null
    if (target) navigate(target)
  }

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-6">
      <section className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-title font-semibold">{component.label}</h2>
            <span className="rounded bg-neutral-soft px-1.5 font-mono text-label text-muted">{component.id}</span>
          </div>
          <p className="mt-1 text-body text-muted">{component.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-label text-muted">
            使用类型
            {usedBy.map((cls) => (
              <ObjectLink key={cls.id} label={cls.label} id={cls.id} route={{ pageId: 'P02', params: { classId: cls.id } }} />
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={Ruler} onClick={() => go('unit-settings')}>
            单位设置
          </Button>
          <Button icon={Crosshair} onClick={() => go('locate-reference')}>
            定位引用
          </Button>
          <Button icon={Plus} disabled title="新增属性对话框尚未接入（08_forms_and_dialogs）">
            新增属性
            <Tag size="sm" tone="neutral" className="-mr-1">
              未接入
            </Tag>
          </Button>
        </div>
      </section>

      <Card>
        <PanelHeader
          title="属性"
          meta={
            <>
              <span className="tabular">{properties.length} 项</span>
              {changedCount ? <Tag size="sm" tone="purple">草稿修改 {changedCount}</Tag> : null}
            </>
          }
          actions={<span className="text-caption text-muted">选择一行在检查器中编辑</span>}
        />
        <PropertyGrid
          properties={properties}
          changed={changed}
          units={index.units}
          diagnostics={validatedRevision === null ? [] : diagnostics}
          selectedId={selectedId}
          onSelect={(propertyId) => navigate({ ...route, params: { ...route.params, propertyId } }, { replace: true })}
        />
      </Card>

      <ValidationList
        diagnostics={diagnostics}
        validationRevision={validatedRevision}
        currentRevision={revision}
        validating={validating}
        onRevalidate={() => void validateDraft()}
      />
    </div>
  )
}
