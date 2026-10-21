import { useState } from "react"
import { Copy, Pencil, Plus } from "lucide-react"
import type { WorkbenchContext } from "@/app/useWorkbenchContext"
import Button from "@/components/ui/Button"
import Card, { Notice, PanelHeader } from "@/components/ui/Card"
import Field, { Select } from "@/components/ui/Field"
import Modal from "@/components/ui/Modal"
import { Tag } from "@/components/ui/StatusTag"
import Table, { Td, Th, Tr } from "@/components/ui/Table"
import { navigate } from "@/router/router"
import { canEdit, useRole } from "@/stores/context"
import { isDocumentDirty, useDraftDocuments } from "@/stores/draftRegistry"
import {
  createProgramDocument,
  duplicateProgramDocument,
  programDocId,
  useDraftModel,
} from "@/stores/modelDocuments"
import { toast } from "@/stores/toast"

/** P30 程序资产库：program 文档清单（含用户新建 / 复制），P14 编辑器的入口。 */
export default function P30ProgramLibrary({
  ctx: _ctx,
}: {
  ctx: WorkbenchContext
}) {
  const model = useDraftModel()
  const docs = useDraftDocuments()
  const role = useRole()
  const readOnly = !canEdit(role)
  const [creating, setCreating] = useState(false)
  const [scopeType, setScopeType] = useState("")

  const referencedBy = (programId: string) =>
    model.systems.filter((s) => s.programRef.id === programId)

  const doCreate = () => {
    const scope = scopeType || model.entityTypes[0]?.id
    if (!scope) return
    const id = createProgramDocument(scope)
    setCreating(false)
    toast(`已新建空程序 ${id}（作用域 ${scope}），已本地保存`)
    navigate({ pageId: "P14", params: { programId: id } })
  }

  const doDuplicate = (programId: string) => {
    try {
      const id = duplicateProgramDocument(programId)
      toast(`已复制 ${programId} → ${id}，已本地保存`)
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error), "warning")
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-title font-semibold">程序资产库</h2>
          <p className="mt-1 text-body text-muted">
            逻辑图程序（entity-program）的版本化清单；新建 / 复制的程序立即本地保存，可在 P14 打开编辑。
          </p>
        </div>
        <Button
          intent="primary"
          icon={Plus}
          disabled={readOnly}
          onClick={() => setCreating(true)}
        >
          新建空程序
        </Button>
      </div>
      <Card>
        <PanelHeader
          title="全部程序"
          meta={<span className="tabular">{model.programs.length} 项</span>}
        />
        <Table>
          <thead>
            <tr>
              <Th>程序 id</Th>
              <Th>版本</Th>
              <Th>作用域</Th>
              <Th align="right">节点数</Th>
              <Th align="right">连线数</Th>
              <Th>被引用</Th>
              <Th>状态</Th>
              <Th align="right">操作</Th>
            </tr>
          </thead>
          <tbody>
            {model.programs.map((p) => {
              const doc = docs[programDocId(p.id)]
              const dirty = isDocumentDirty(doc)
              const refs = referencedBy(p.id)
              return (
                <Tr
                  key={p.id}
                  onSelect={() =>
                    navigate({ pageId: "P14", params: { programId: p.id } })
                  }
                >
                  <Td className="font-mono text-label">{p.id}</Td>
                  <Td className="font-mono text-label">{p.version}</Td>
                  <Td className="font-mono text-label">{p.scopeType}</Td>
                  <Td numeric>{p.nodes.length}</Td>
                  <Td numeric>{p.edges.length}</Td>
                  <Td>
                    {refs.length > 0 ? (
                      <span className="font-mono text-label text-ink-soft">
                        {refs.map((s) => s.id).join("、")}
                      </span>
                    ) : (
                      <span className="text-caption text-muted">未被引用</span>
                    )}
                  </Td>
                  <Td>
                    {dirty ? (
                      <Tag size="sm" tone="warning">
                        未保存
                      </Tag>
                    ) : (
                      <Tag size="sm" tone="success">
                        已保存
                      </Tag>
                    )}
                  </Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        intent="ghost"
                        icon={Pencil}
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate({
                            pageId: "P14",
                            params: { programId: p.id },
                          })
                        }}
                      >
                        编辑
                      </Button>
                      <Button
                        size="sm"
                        intent="ghost"
                        icon={Copy}
                        disabled={readOnly}
                        onClick={(e) => {
                          e.stopPropagation()
                          doDuplicate(p.id)
                        }}
                      >
                        复制
                      </Button>
                    </div>
                  </Td>
                </Tr>
              )
            })}
          </tbody>
        </Table>
      </Card>
      {model.programs.length === 0 ? (
        <Notice tone="info">还没有程序；点“新建空程序”开始。</Notice>
      ) : null}
      {creating ? (
        <Modal
          title="新建空程序"
          subtitle="创建后立即本地保存；之后在 P14 编辑节点图"
          width={440}
          onClose={() => setCreating(false)}
          footer={
            <>
              <Button intent="ghost" onClick={() => setCreating(false)}>
                取消
              </Button>
              <Button intent="primary" icon={Plus} onClick={doCreate}>
                创建
              </Button>
            </>
          }
        >
          <div className="px-5 py-4">
            <Field label="作用域实体类型" required>
              <Select
                value={scopeType || model.entityTypes[0]?.id || ""}
                options={model.entityTypes.map((t) => ({
                  value: t.id,
                  label: `${t.id}（${t.label}）`,
                }))}
                onChange={(e) => setScopeType(e.currentTarget.value)}
              />
            </Field>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
