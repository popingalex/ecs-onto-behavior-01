import { useMemo, useState } from "react"
import { Group, Panel, Separator } from "react-resizable-panels"
import { navigate, type OverlayResult } from "@/router/router"
import type {
  Binding,
  LogicGraphDocument,
  TargetBinding,
} from "@/schema/model"
import {
  bindInput,
  bindSlot,
  checkEdge,
  connect,
  createNode,
  nextNodeId,
  nodeTypeDef,
  validateProgram,
  type BindTarget,
} from "@/services/domainBindingService"
import { defaultPosition } from "@/services/logicGraphCodec"
import { applyEdit } from "@/stores/draftRegistry"
import {
  useDraftModel,
  useModelDocument,
  type ProgramContent,
} from "@/stores/modelDocuments"
import { toast } from "@/stores/toast"
import DiagnosticsDock from "./DiagnosticsDock"
import LogicCanvas from "./LogicCanvas"
import NodeForm from "./NodeForm"
import NodeLibrary from "./NodeLibrary"
import { LogicEditorContext, type LogicEditorApi } from "./editorContext"

interface PickedCandidate {
  key: string
  label: string
  binding?: Binding | TargetBinding
  upstream?: { nodeId: string; portId: string }
}

const HANDLE =
  "bg-line transition-colors hover:bg-primary/40 data-[separator=active]:bg-primary/60"

/** System 内部逻辑编辑器：左节点库 / 中画布 / 右节点表单 / 下诊断，四区可调大小。 */
export default function LogicEditor({
  docId,
  programId,
  readOnly,
}: {
  docId: string
  programId: string
  readOnly: boolean
}) {
  const model = useDraftModel()
  const doc = useModelDocument<ProgramContent>(docId)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [focusRequest, setFocusRequest] = useState<{
    nodeId: string
    seq: number
  } | null>(null)

  const program = doc?.content.program
  const diagnostics = useMemo(
    () => (program ? validateProgram(model, program) : []),
    [model, program],
  )

  const api = useMemo<LogicEditorApi | null>(() => {
    if (!program) return null
    const edit = (
      label: string,
      fn: (p: LogicGraphDocument) => LogicGraphDocument,
    ) =>
      applyEdit<ProgramContent>(docId, label, (c) => ({
        ...c,
        program: fn(c.program),
      }))
    const onPicked = (target: BindTarget, result: OverlayResult) => {
      if (result.kind !== "confirm") return
      const candidate = result.payload.candidate as PickedCandidate | undefined
      if (!candidate) return
      if (target.kind === "slot") {
        if (!candidate.binding) return
        const binding = candidate.binding
        edit(`绑定 ${target.nodeId}.${target.slotId} ← ${candidate.label}`, (p) =>
          bindSlot(p, model, target.nodeId, target.slotId, binding),
        )
        return
      }
      if (candidate.upstream) {
        const source = candidate.upstream
        const chk = checkEdge(model, program, source, {
          nodeId: target.nodeId,
          portId: target.portId,
        })
        if (!chk.ok) {
          toast(chk.reason, "warning")
          return
        }
        edit(
          `连接 ${source.nodeId}.${source.portId} → ${target.nodeId}.${target.portId}`,
          (p) =>
            connect(p, model, source, {
              nodeId: target.nodeId,
              portId: target.portId,
            }),
        )
        return
      }
      if (candidate.binding)
        edit(
          `绑定 ${target.nodeId}.${target.portId} ← ${candidate.label}`,
          (p) =>
            bindInput(
              p,
              model,
              target.nodeId,
              target.portId,
              candidate.binding as Binding,
            ),
        )
    }
    const openPicker = (target: BindTarget) => {
      const params: Record<string, string> =
        target.kind === "input"
          ? { programId, nodeId: target.nodeId, portId: target.portId }
          : { programId, nodeId: target.nodeId, slotId: target.slotId }
      navigate(
        { pageId: "P15", params },
        { onResult: (r) => onPicked(target, r) },
      )
    }
    return {
      programId,
      readOnly,
      openInputPicker: (nodeId, portId) =>
        openPicker({ kind: "input", nodeId, portId }),
      openSlotPicker: (nodeId, slotId) =>
        openPicker({ kind: "slot", nodeId, slotId }),
      focusNode: (nodeId) => {
        setSelectedNodeId(nodeId)
        setFocusRequest((prev) => ({ nodeId, seq: (prev?.seq ?? 0) + 1 }))
      },
    }
  }, [docId, model, program, programId, readOnly])

  if (!doc || !program || !api) return null

  const addNode = (type: string) => {
    const def = nodeTypeDef(type)
    if (!def?.available) return
    const id = nextNodeId(program, type)
    try {
      const node = createNode(model, program, type, id)
      const base = defaultPosition(program.nodes.length)
      applyEdit<ProgramContent>(docId, `添加节点 ${def.label} ${id}`, (c) => ({
        ...c,
        program: { ...c.program, nodes: [...c.program.nodes, node] },
        layout: {
          ...c.layout,
          positions: { ...c.layout.positions, [id]: base },
        },
      }))
      setSelectedNodeId(id)
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error), "warning")
    }
  }

  return (
    <LogicEditorContext.Provider value={api}>
      <Group orientation="vertical" className="min-h-0 flex-1">
        <Panel defaultSize="72%" minSize="40%" className="min-h-0">
          <Group orientation="horizontal" className="h-full">
            <Panel
              defaultSize="240px"
              minSize="180px"
              maxSize="320px"
              className="min-h-0 border-r border-border bg-surface"
            >
              <NodeLibrary onAdd={addNode} />
            </Panel>
            <Separator className={`w-1 ${HANDLE}`} />
            <Panel minSize="30%" className="min-w-0">
              <LogicCanvas
                docId={docId}
                model={model}
                program={program}
                diagnostics={diagnostics}
                readOnly={readOnly}
                onSelectionChange={setSelectedNodeId}
                focusRequest={focusRequest}
              />
            </Panel>
            <Separator className={`w-1 ${HANDLE}`} />
            <Panel
              defaultSize="320px"
              minSize="260px"
              maxSize="480px"
              className="min-h-0 border-l border-border bg-surface"
            >
              <NodeForm
                docId={docId}
                model={model}
                program={program}
                selectedNodeId={selectedNodeId}
                readOnly={readOnly}
              />
            </Panel>
          </Group>
        </Panel>
        <Separator className={`h-1 ${HANDLE}`} />
        <Panel
          defaultSize="28%"
          minSize="120px"
          maxSize="50%"
          className="min-h-0 border-t border-border bg-surface"
        >
          <DiagnosticsDock diagnostics={diagnostics} />
        </Panel>
      </Group>
    </LogicEditorContext.Provider>
  )
}
