import { useMemo, useState, type KeyboardEvent } from "react"
import {
  ArrowLeft,
  FlaskConical,
  Lock,
  Plus,
  Scale,
  Trash2,
} from "lucide-react"
import type { WorkbenchContext } from "@/app/useWorkbenchContext"
import type { ConstraintDef, UnitDef } from "@/schema/model"
import { SHAPE_LABEL, PRIMITIVE_LABEL } from "@/core/labels"
import ObjectLink from "@/components/domain/ObjectLink"
import TypedValueCell from "@/components/domain/TypedValueCell"
import Button from "@/components/ui/Button"
import Card, { KeyValue, Notice, PanelHeader } from "@/components/ui/Card"
import Field, { Select, TextInput } from "@/components/ui/Field"
import { Tag } from "@/components/ui/StatusTag"
import Table, { Td, Th, Tr } from "@/components/ui/Table"
import Modal from "@/components/ui/Modal"
import { toDisplay } from "@/data/world"
import { formatNumber } from "@/lib/format"
import { navigate, useRoute } from "@/router/router"
import { resolveInitialValue } from "@/schema/values"
import {
  SCHEMA_DOC,
  SYSTEMS_DOC,
  useDraftModel,
} from "@/stores/modelDocuments"
import { useEditingDocument } from "@/stores/draftRegistry"
import { toast } from "@/stores/toast"
import CommitText from "@/features/ecs/CommitText"
import RefsNotice from "@/features/ecs/RefsNotice"
import { toUnitDef } from "@/features/ecs/adapters"
import {
  applySchemaOp,
  applySystemsOp,
  useReadOnly,
  useSchemaDoc,
} from "@/features/ecs/editing"
import { validId } from "@/features/ecs/ids"
import {
  createConstraint,
  createUnit,
  deleteConstraint,
  deleteUnit,
  updateConstraint,
  updateUnit,
} from "@/features/ecs/operations"
import {
  constraintRefs,
  unitRefs,
  type RefHit,
} from "@/features/ecs/refs"
import {
  allocateProportional,
  evalQuantityOp,
} from "@/features/units/quantityMath"

/**
 * P04 量种、单位与约束：单位（SCHEMA_DOC）与约束（SYSTEMS_DOC）的列表 / 详情；
 * 测试台与约束沙盒是 ui.local 试算，实时解析但不发布、不产生 commit。
 * v0.5 契约没有单位换算公式字段：同量种单位并列展示，不做数值换算。
 */
export default function P04Units({ ctx: _ctx }: { ctx: WorkbenchContext }) {
  const route = useRoute()
  useEditingDocument(route.params.constraintId ? SYSTEMS_DOC : SCHEMA_DOC)
  const model = useDraftModel()
  const { unitId, constraintId } = route.params
  if (constraintId) {
    const constraint = model.constraints.find((c) => c.id === constraintId)
    if (!constraint)
      return (
        <div className="mx-auto w-full max-w-[1280px] px-6 py-6">
          <Notice tone="warning">
            约束 {constraintId} 不在当前草稿中；可能已被删除。
          </Notice>
        </div>
      )
    return <ConstraintDetail key={constraint.id} constraint={constraint} />
  }
  if (unitId) {
    const unit = model.units.find((u) => u.id === unitId)
    if (!unit)
      return (
        <div className="mx-auto w-full max-w-[1280px] px-6 py-6">
          <Notice tone="warning">
            单位 {unitId} 不在当前草稿中；可能已被删除。
          </Notice>
        </div>
      )
    return <UnitDetail key={unit.id} unit={unit} />
  }
  return <UnitList />
}

function UnitList() {
  const model = useDraftModel()
  const readOnly = useReadOnly()
  const [creatingUnit, setCreatingUnit] = useState(false)
  const [creatingConstraint, setCreatingConstraint] = useState(false)
  const unitRefCounts = useMemo(
    () => new Map(model.units.map((u) => [u.id, unitRefs(model, u.id).length])),
    [model],
  )
  const constraintRefCounts = useMemo(
    () =>
      new Map(
        model.constraints.map((c) => [c.id, constraintRefs(model, c.id).length]),
      ),
    [model],
  )
  const kinds = useMemo(() => {
    const map = new Map<string, UnitDef[]>()
    for (const u of model.units) {
      const list = map.get(u.quantityKind) ?? []
      list.push(u)
      map.set(u.quantityKind, list)
    }
    return map
  }, [model.units])
  // 规格示例：位置向量轴 east/north/up，显示 F01 的 [320,180,0] m
  const f01 = model.scene.entities.find((e) => e.id === "F01")
  const f01Position = f01
    ? resolveInitialValue(model, f01, "position.local")
    : null
  const meter = model.units.find((u) => u.id === "m")

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-title font-semibold">量种、单位与约束</h2>
          <p className="mt-1 text-body text-muted">
            量种与单位按草稿模型列出；v0.5
            契约不含换算公式字段，同量种单位并列展示、不做数值换算。约束的适用域与不支持场景随定义展示。
          </p>
        </div>
        <Button
          intent="secondary"
          icon={Plus}
          disabled={readOnly}
          onClick={() => setCreatingConstraint(true)}
        >
          新建约束
        </Button>
        <Button
          intent="primary"
          icon={Plus}
          disabled={readOnly}
          onClick={() => setCreatingUnit(true)}
        >
          新建单位
        </Button>
      </div>

      <Card>
        <PanelHeader
          title="量种与单位"
          meta={<span className="tabular">{model.units.length} 个单位</span>}
        />
        <Table className="min-w-[860px]">
          <thead>
            <tr>
              <Th className="w-[200px]">单位</Th>
              <Th>符号</Th>
              <Th>量种</Th>
              <Th>同量种单位</Th>
              <Th align="right">引用</Th>
            </tr>
          </thead>
          <tbody>
            {model.units.map((u) => (
              <Tr
                key={u.id}
                onSelect={() =>
                  navigate({ pageId: "P04", params: { unitId: u.id } })
                }
              >
                <Td>
                  <span className="font-mono font-medium">{u.id}</span>
                </Td>
                <Td>{u.symbol}</Td>
                <Td>
                  <span className="font-mono text-label text-muted">
                    {u.quantityKind}
                  </span>
                </Td>
                <Td>
                  {(kinds.get(u.quantityKind) ?? [])
                    .filter((x) => x.id !== u.id)
                    .map((x) => (
                      <span
                        key={x.id}
                        className="mr-2 font-mono text-label text-ink-soft"
                      >
                        {x.symbol}
                        <span className="text-faint">（{x.id}）</span>
                      </span>
                    ))}
                  {(kinds.get(u.quantityKind) ?? []).length === 1 ? (
                    <span className="text-faint">—</span>
                  ) : null}
                </Td>
                <Td numeric>{unitRefCounts.get(u.id) ?? 0}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card>
        <PanelHeader
          title="值结构"
          meta={
            <span className="tabular">{model.attributes.length} 个属性</span>
          }
          actions={
            <span className="text-caption text-muted">
              shape / primitive / 可空 / 单位 / 坐标框
            </span>
          }
        />
        <Table className="min-w-[960px]">
          <thead>
            <tr>
              <Th className="w-[260px]">属性</Th>
              <Th>值形状</Th>
              <Th>基元</Th>
              <Th align="center">可空</Th>
              <Th>单位</Th>
              <Th>坐标框</Th>
            </tr>
          </thead>
          <tbody>
            {model.attributes.map((a) => (
              <Tr
                key={a.id}
                onSelect={() =>
                  navigate({ pageId: "P29", params: { attributeId: a.id } })
                }
              >
                <Td>
                  <span className="font-medium">{a.label}</span>
                  <span className="ml-2 font-mono text-caption text-muted">
                    {a.id}
                  </span>
                </Td>
                <Td>{SHAPE_LABEL[a.type.shape]}</Td>
                <Td>
                  <span className="font-mono text-label text-muted">
                    {PRIMITIVE_LABEL[a.type.primitive]}
                  </span>
                </Td>
                <Td align="center">{a.type.nullable ? "是" : "否"}</Td>
                <Td>
                  {a.type.unitId ? (
                    <ObjectLink
                      label={model.units.find((u) => u.id === a.type.unitId)?.symbol}
                      id={a.type.unitId}
                      route={{ pageId: "P04", params: { unitId: a.type.unitId } }}
                    />
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                </Td>
                <Td>
                  {a.type.frameId ? (
                    <span className="font-mono text-label">
                      {a.type.frameId}
                    </span>
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
        {f01Position?.state === "value" && Array.isArray(f01Position.value) ? (
          <div className="border-t border-line px-4 py-3 text-label text-muted">
            位置向量轴为 east / north / up：F01 ={" "}
            <span className="tabular font-mono text-ink">
              <TypedValueCell
                align="left"
                value={toDisplay(f01Position.value)}
                unit={meter ? toUnitDef(meter) : null}
              />
            </span>{" "}
            （park-ENU，局部米坐标）
          </div>
        ) : null}
      </Card>

      <TestBench />

      <Card>
        <PanelHeader
          title="约束"
          meta={
            <span className="tabular">{model.constraints.length} 条</span>
          }
          actions={
            <span className="text-caption text-muted">
              额度分配与适用域；运行裁决只读取已固定版本
            </span>
          }
        />
        <Table className="min-w-[960px]">
          <thead>
            <tr>
              <Th className="w-[240px]">约束</Th>
              <Th>策略</Th>
              <Th align="right">冷源下限</Th>
              <Th>适用域</Th>
              <Th align="right">引用</Th>
            </tr>
          </thead>
          <tbody>
            {model.constraints.map((c) => (
              <Tr
                key={c.id}
                onSelect={() =>
                  navigate({ pageId: "P04", params: { constraintId: c.id } })
                }
              >
                <Td>
                  <span className="font-mono font-medium">
                    {c.id}@{c.version}
                  </span>
                </Td>
                <Td>
                  <Tag tone="purple" size="sm">
                    比例分配
                  </Tag>
                </Td>
                <Td numeric>{formatNumber(c.floorC)} °C</Td>
                <Td>
                  <span className="font-mono text-label text-muted">
                    {c.domain}
                  </span>
                </Td>
                <Td numeric>{constraintRefCounts.get(c.id) ?? 0}</Td>
              </Tr>
            ))}
            {model.constraints.length === 0 ? (
              <tr>
                <Td colSpan={5} className="py-8 text-center text-muted">
                  当前草稿没有约束
                </Td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </Card>

      {creatingUnit ? (
        <CreateUnitModal onClose={() => setCreatingUnit(false)} />
      ) : null}
      {creatingConstraint ? (
        <CreateConstraintModal onClose={() => setCreatingConstraint(false)} />
      ) : null}
    </div>
  )
}

/** 测试台：输入两个带单位的数值做加减，实时解析量种规则；不发布、不产生 commit。 */
function TestBench() {
  const model = useDraftModel()
  const [aValue, setAValue] = useState("100")
  const [aUnit, setAUnit] = useState("degC")
  const [bValue, setBValue] = useState("20")
  const [bUnit, setBUnit] = useState("degC")
  const [op, setOp] = useState<"add" | "sub">("sub")

  const parse = (t: string): number | null => {
    const n = Number(t.trim())
    return t.trim() !== "" && !Number.isNaN(n) ? n : null
  }
  const av = parse(aValue)
  const bv = parse(bValue)
  const symbol = (id: string) =>
    model.units.find((u) => u.id === id)?.symbol ?? id
  const result =
    av === null || bv === null
      ? null
      : evalQuantityOp(model.units, { value: av, unitId: aUnit }, op, {
          value: bv,
          unitId: bUnit,
        })
  const unitOptions = model.units.map((u) => ({
    value: u.id,
    label: `${u.symbol} · ${u.quantityKind}`,
  }))
  const presets: Array<{
    label: string
    a: string
    au: string
    op: "add" | "sub"
    b: string
    bu: string
  }> = [
    { label: "100 °C − 20 °C", a: "100", au: "degC", op: "sub", b: "20", bu: "degC" },
    { label: "100 °C + (−40 K)", a: "100", au: "degC", op: "add", b: "-40", bu: "deltaK" },
    { label: "8000 L + 5500 L", a: "8000", au: "L", op: "add", b: "5500", bu: "L" },
    { label: "10 m − 1 L（报错示例）", a: "10", au: "m", op: "sub", b: "1", bu: "L" },
  ]

  return (
    <Card>
      <PanelHeader
        title="测试台"
        meta={
          <Tag tone="primary" size="sm" icon={FlaskConical}>
            ui.local 试算 · 不发布
          </Tag>
        }
        actions={
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <Button
                key={p.label}
                size="sm"
                intent="ghost"
                onClick={() => {
                  setAValue(p.a)
                  setAUnit(p.au)
                  setOp(p.op)
                  setBValue(p.b)
                  setBUnit(p.bu)
                }}
              >
                {p.label}
              </Button>
            ))}
          </div>
        }
      />
      <div className="grid items-end gap-3 px-4 py-4 md:grid-cols-[1fr_auto_1fr_auto_1.2fr]">
        <div className="grid grid-cols-[1fr_130px] gap-2">
          <Field label="操作数 A">
            <TextInput
              value={aValue}
              mono
              inputMode="decimal"
              onChange={(e) => setAValue(e.target.value)}
            />
          </Field>
          <Field label="单位">
            <Select
              value={aUnit}
              onChange={(e) => setAUnit(e.target.value)}
              options={unitOptions}
            />
          </Field>
        </div>
        <Field label="运算">
          <Select
            value={op}
            onChange={(e) => setOp(e.target.value as "add" | "sub")}
            options={[
              { value: "add", label: "＋ 加" },
              { value: "sub", label: "− 减" },
            ]}
          />
        </Field>
        <div className="grid grid-cols-[1fr_130px] gap-2">
          <Field label="操作数 B">
            <TextInput
              value={bValue}
              mono
              inputMode="decimal"
              onChange={(e) => setBValue(e.target.value)}
            />
          </Field>
          <Field label="单位">
            <Select
              value={bUnit}
              onChange={(e) => setBUnit(e.target.value)}
              options={unitOptions}
            />
          </Field>
        </div>
        <div className="hidden md:block" aria-hidden />
        <div className="rounded-ui border border-line bg-subtle px-3 py-2.5">
          <div className="text-caption text-muted">结果</div>
          {av === null || bv === null ? (
            <div className="mt-0.5 text-body text-faint">输入无效数值</div>
          ) : result?.ok ? (
            <div className="mt-0.5 text-body">
              <span className="tabular font-semibold">
                {formatNumber(result.value)}
              </span>{" "}
              <span className="text-ink-soft">{symbol(result.unitId)}</span>
              <span className="ml-2 font-mono text-caption text-muted">
                {result.quantityKind}
              </span>
            </div>
          ) : result ? (
            <div className="mt-0.5 text-body text-danger" role="alert">
              <span className="font-mono text-label">{result.code}</span>
              <span className="ml-2">{result.message}</span>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  )
}

function UnitDetail({ unit }: { unit: UnitDef }) {
  const model = useDraftModel()
  const doc = useSchemaDoc()
  const readOnly = useReadOnly()
  const [error, setError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState<{
    message: string
    refs?: RefHit[]
  } | null>(null)
  const [confirming, setConfirming] = useState(false)

  const saved = doc?.savedContent.units.find((u) => u.id === unit.id)
  const isNew = !saved
  const dirty = saved ? JSON.stringify(saved) !== JSON.stringify(unit) : true
  const refs = useMemo(() => unitRefs(model, unit.id), [model, unit.id])
  const kindPeers = model.units.filter(
    (u) => u.quantityKind === unit.quantityKind && u.id !== unit.id,
  )

  const edit = (patch: Parameters<typeof updateUnit>[2], label: string) => {
    setBlocked(null)
    const result = applySchemaOp(label, (s) => updateUnit(s, unit.id, patch))
    setError(result.ok ? null : result.message)
  }

  const remove = () => {
    const result = applySchemaOp(`删除单位 ${unit.id}`, (s) =>
      deleteUnit(model, s, unit.id),
    )
    if (!result.ok) {
      setConfirming(false)
      setBlocked({ message: result.message, refs: result.refs })
      return
    }
    toast(`已删除单位 ${unit.id}`)
    navigate({ pageId: "P04", params: {} })
  }

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-6">
      <section className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              intent="ghost"
              icon={ArrowLeft}
              onClick={() => navigate({ pageId: "P04", params: {} })}
            >
              单位列表
            </Button>
            <h2 className="text-title font-semibold">
              {unit.symbol}
              <span className="ml-2 font-mono text-body-lg font-normal text-muted">
                {unit.id}
              </span>
            </h2>
            {isNew ? (
              <Tag tone="success" size="sm">
                草稿新增
              </Tag>
            ) : dirty ? (
              <Tag tone="purple" size="sm">
                草稿修改
              </Tag>
            ) : null}
          </div>
          <p className="mt-2 text-label text-muted">
            量种 <span className="font-mono">{unit.quantityKind}</span>
            {kindPeers.length
              ? `；同量种单位：${kindPeers
                  .map((u) => `${u.symbol}（${u.id}）`)
                  .join("、")}`
              : ""}
            。v0.5 契约不含换算公式字段。
          </p>
        </div>
        <Button
          intent="danger-ghost"
          icon={Trash2}
          disabled={readOnly}
          onClick={() =>
            refs.length
              ? setBlocked({
                  message: `单位 ${unit.id} 仍被 ${refs.length} 处引用，不能删除`,
                  refs,
                })
              : setConfirming(true)
          }
        >
          删除单位
        </Button>
      </section>

      {readOnly ? (
        <Notice tone="warning" icon={<Lock size={15} aria-hidden />}>
          观察者为只读角色，字段不可编辑。
        </Notice>
      ) : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {blocked ? (
        <RefsNotice message={blocked.message} refs={blocked.refs} />
      ) : null}

      <Card>
        <PanelHeader title="定义" />
        <div className="grid max-w-2xl gap-3 px-4 py-4 sm:grid-cols-2">
          <CommitText
            label="符号"
            value={unit.symbol}
            readOnly={readOnly}
            required
            error={!unit.symbol.trim() ? "符号不能为空" : null}
            onCommit={(v) => edit({ symbol: v }, `${unit.id} · 符号`)}
          />
          <CommitText
            label="量种"
            value={unit.quantityKind}
            readOnly={readOnly}
            required
            mono
            error={!unit.quantityKind.trim() ? "量种不能为空" : null}
            onCommit={(v) => edit({ quantityKind: v }, `${unit.id} · 量种`)}
          />
        </div>
        <div className="border-t border-line px-4 py-2.5 text-caption text-muted">
          改动量种可能使引用属性报 UNIT_KIND_MISMATCH；保存后用「重新校验」确认。
        </div>
      </Card>

      <Card>
        <PanelHeader
          title="引用位置"
          meta={<span className="tabular">{refs.length} 处</span>}
        />
        {refs.length === 0 ? (
          <div className="px-4 py-4 text-body text-muted">
            没有属性或程序端口引用该单位，可以安全删除。
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {refs.map((r, i) => (
              <li
                key={`${r.kind}:${r.id}:${i}`}
                className="flex flex-wrap items-center gap-x-3 px-4 py-2.5 text-body"
              >
                {r.route ? (
                  <ObjectLink label={r.label} id={r.id} route={r.route} />
                ) : (
                  <span className="font-medium">{r.label}</span>
                )}
                <span className="text-label text-muted">{r.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {confirming ? (
        <Modal
          title={`删除单位 ${unit.id}`}
          onClose={() => setConfirming(false)}
          footer={
            <>
              <Button intent="ghost" onClick={() => setConfirming(false)}>
                取消
              </Button>
              <Button intent="danger" onClick={remove}>
                确认删除
              </Button>
            </>
          }
        >
          <p className="px-5 py-4 text-body">
            将删除单位 {unit.id}（{unit.symbol}）。该操作可通过撤销恢复。
          </p>
        </Modal>
      ) : null}
    </div>
  )
}

function ConstraintDetail({ constraint }: { constraint: ConstraintDef }) {
  const model = useDraftModel()
  const readOnly = useReadOnly()
  const [error, setError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState<{
    message: string
    refs?: RefHit[]
  } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const refs = useMemo(
    () => constraintRefs(model, constraint.id),
    [model, constraint.id],
  )

  const edit = (
    patch: Parameters<typeof updateConstraint>[2],
    label: string,
  ) => {
    setBlocked(null)
    const result = applySystemsOp(label, (c) =>
      updateConstraint(c, constraint.id, patch),
    )
    setError(result.ok ? null : result.message)
  }

  const remove = () => {
    const result = applySystemsOp(`删除约束 ${constraint.id}`, (c) =>
      deleteConstraint(model, c, constraint.id),
    )
    if (!result.ok) {
      setConfirming(false)
      setBlocked({ message: result.message, refs: result.refs })
      return
    }
    toast(`已删除约束 ${constraint.id}`)
    navigate({ pageId: "P04", params: {} })
  }

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-6">
      <section className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              intent="ghost"
              icon={ArrowLeft}
              onClick={() => navigate({ pageId: "P04", params: {} })}
            >
              约束列表
            </Button>
            <h2 className="text-title font-semibold">
              {constraint.id}
              <span className="ml-2 font-mono text-body-lg font-normal text-muted">
                @{constraint.version}
              </span>
            </h2>
            <Tag tone="purple" size="sm" icon={Scale}>
              比例分配
            </Tag>
          </div>
          <p className="mt-2 text-label text-muted">
            该下限只适用于声明的冷却模型，不是混合物理过程的通用下限；运行裁决只读取已固定版本。
          </p>
        </div>
        <Button
          intent="danger-ghost"
          icon={Trash2}
          disabled={readOnly}
          onClick={() =>
            refs.length
              ? setBlocked({
                  message: `约束 ${constraint.id} 仍被 ${refs.length} 处引用，不能删除`,
                  refs,
                })
              : setConfirming(true)
          }
        >
          删除约束
        </Button>
      </section>

      {readOnly ? (
        <Notice tone="warning" icon={<Lock size={15} aria-hidden />}>
          观察者为只读角色，字段不可编辑。
        </Notice>
      ) : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {blocked ? (
        <RefsNotice message={blocked.message} refs={blocked.refs} />
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <PanelHeader title="规则参数" />
          <div className="flex flex-col gap-3 px-4 py-4">
            <CommitNumber
              label="冷源下限（°C）"
              value={constraint.floorC}
              readOnly={readOnly}
              onCommit={(v) =>
                edit({ floorC: v }, `${constraint.id} · 冷源下限`)
              }
            />
            <CommitText
              label="适用域"
              value={constraint.domain}
              readOnly={readOnly}
              required
              mono
              error={!constraint.domain.trim() ? "适用域不能为空" : null}
              onCommit={(v) => edit({ domain: v }, `${constraint.id} · 适用域`)}
            />
            <CommitText
              label="不支持的场景"
              value={constraint.unsupported}
              readOnly={readOnly}
              mono
              onCommit={(v) =>
                edit({ unsupported: v }, `${constraint.id} · 不支持场景`)
              }
            />
          </div>
        </Card>
        <Card>
          <PanelHeader title="假设与适用域" />
          <dl className="px-4 py-3">
            <KeyValue label="策略">比例分配（proportional）</KeyValue>
            <KeyValue label="额度口径">
              max(旧值 − 冷源下限, 0)，按 |请求| 比例限幅
            </KeyValue>
            <KeyValue label="适用域" mono>
              {constraint.domain}
            </KeyValue>
            <KeyValue label="不支持" mono>
              {constraint.unsupported || "—"}
            </KeyValue>
          </dl>
          <div className="border-t border-line px-4 py-3 text-caption text-muted">
            运行中的贡献裁决记录见 P23（需运行上下文与已固定 constraintVersion）。
          </div>
        </Card>
      </div>

      <ConstraintSandbox constraint={constraint} />

      <Card>
        <PanelHeader
          title="引用位置"
          meta={<span className="tabular">{refs.length} 处</span>}
          actions={
            <span className="text-caption text-muted">
              更改约束版本需重新校验引用 system
            </span>
          }
        />
        {refs.length === 0 ? (
          <div className="px-4 py-4 text-body text-muted">
            没有属性、调度节点或程序引用该约束，可以安全删除。
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {refs.map((r, i) => (
              <li
                key={`${r.kind}:${r.id}:${i}`}
                className="flex flex-wrap items-center gap-x-3 px-4 py-2.5 text-body"
              >
                {r.route ? (
                  <ObjectLink label={r.label} id={r.id} route={r.route} />
                ) : (
                  <span className="font-medium">{r.label}</span>
                )}
                <span className="text-label text-muted">{r.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {confirming ? (
        <Modal
          title={`删除约束 ${constraint.id}`}
          onClose={() => setConfirming(false)}
          footer={
            <>
              <Button intent="ghost" onClick={() => setConfirming(false)}>
                取消
              </Button>
              <Button intent="danger" onClick={remove}>
                确认删除
              </Button>
            </>
          }
        >
          <p className="px-5 py-4 text-body">
            将删除约束 {constraint.id}@{constraint.version}
            。引用它的属性与调度节点会报 CONSTRAINT_REF_MISSING。该操作可通过撤销恢复。
          </p>
        </Modal>
      ) : null}
    </div>
  )
}

/** 约束沙盒试算：额度 / 比例 / 逐请求获准；sandbox 标记，不写任何文档。 */
function ConstraintSandbox({ constraint }: { constraint: ConstraintDef }) {
  const [previousC, setPreviousC] = useState("100")
  const [requestsText, setRequestsText] = useState("-50, -50")
  const prev = Number(previousC.trim())
  const prevValid = previousC.trim() !== "" && !Number.isNaN(prev)
  const parts = requestsText
    .split(/[,，\s]+/)
    .filter(Boolean)
    .map((t) => Number(t))
  const requestsValid = parts.every((n) => !Number.isNaN(n))
  const result =
    prevValid && requestsValid
      ? allocateProportional({
          floorC: constraint.floorC,
          previousC: prev,
          requests: parts,
        })
      : null

  return (
    <Card>
      <PanelHeader
        title="沙盒试算"
        meta={
          <Tag tone="primary" size="sm" icon={FlaskConical}>
            sandbox · 不产生 commit
          </Tag>
        }
        actions={
          <span className="text-caption text-muted">
            按当前草稿参数 {constraint.id}@{constraint.version} 试算
          </span>
        }
      />
      <div className="grid items-end gap-3 px-4 py-4 md:grid-cols-[200px_1fr]">
        <Field label="旧值（°C）">
          <TextInput
            value={previousC}
            mono
            inputMode="decimal"
            invalid={!prevValid}
            onChange={(e) => setPreviousC(e.target.value)}
          />
        </Field>
        <Field
          label="冷却请求（K，逗号分隔的负值）"
          hint="正向（升温）请求属于不支持域，会被拒绝"
        >
          <TextInput
            value={requestsText}
            mono
            invalid={!requestsValid}
            onChange={(e) => setRequestsText(e.target.value)}
          />
        </Field>
      </div>
      {result ? (
        result.ok ? (
          <div className="border-t border-line px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body">
              <span>
                额度{" "}
                <span className="tabular font-semibold">
                  {formatNumber(result.quota)} K
                </span>
              </span>
              <span>
                比例{" "}
                <span className="tabular font-semibold">
                  {formatNumber(result.ratio)}
                </span>
              </span>
              {result.ratio < 1 ? (
                <Tag tone="warning" size="sm">
                  按比例限幅
                </Tag>
              ) : (
                <Tag tone="success" size="sm">
                  全额获准
                </Tag>
              )}
            </div>
            {result.approved.length ? (
              <Table className="mt-3 max-w-xl">
                <thead>
                  <tr>
                    <Th>请求</Th>
                    <Th align="right">请求量（K）</Th>
                    <Th align="right">获准（K）</Th>
                  </tr>
                </thead>
                <tbody>
                  {result.approved.map((approved, i) => (
                    <tr key={i}>
                      <Td className="text-muted">请求 {i + 1}</Td>
                      <Td numeric>{formatNumber(parts[i])}</Td>
                      <Td numeric>{formatNumber(approved)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : null}
          </div>
        ) : (
          <div className="border-t border-line px-4 py-3" role="alert">
            <span className="font-mono text-label text-danger">
              {result.code}
            </span>
            <span className="ml-2 text-body text-danger">{result.message}</span>
          </div>
        )
      ) : (
        <div className="border-t border-line px-4 py-3 text-body text-faint">
          输入无效：旧值与请求必须是数值。
        </div>
      )}
    </Card>
  )
}

/** 数值提交字段：失焦 / Enter 提交一次；非有限数拒绝并保留输入。 */
function CommitNumber({
  label,
  value,
  readOnly,
  onCommit,
}: {
  label: string
  value: number
  readOnly?: boolean
  onCommit: (value: number) => void
}) {
  const [text, setText] = useState(String(value))
  const [synced, setSynced] = useState(value)
  const [error, setError] = useState<string | null>(null)
  if (synced !== value) {
    setSynced(value)
    setText(String(value))
    setError(null)
  }
  const commit = () => {
    const n = Number(text.trim())
    if (text.trim() === "" || !Number.isFinite(n)) {
      setError("必须是有限数值，NaN / Infinity 不能入库")
      return
    }
    setError(null)
    if (n !== value) onCommit(n)
  }
  const keys = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === "Enter") {
      e.preventDefault()
      commit()
    } else if (e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      setText(String(value))
      setError(null)
    }
  }
  return (
    <Field label={label} required error={error}>
      <TextInput
        value={text}
        readOnly={readOnly}
        invalid={Boolean(error)}
        mono
        inputMode="decimal"
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={keys}
      />
    </Field>
  )
}

function CreateUnitModal({ onClose }: { onClose: () => void }) {
  const model = useDraftModel()
  const [id, setId] = useState("")
  const [symbol, setSymbol] = useState("")
  const [quantityKind, setQuantityKind] = useState("")
  const [error, setError] = useState<string | null>(null)
  const kinds = [...new Set(model.units.map((u) => u.quantityKind))]

  const submit = () => {
    if (!validId(id))
      return setError(
        "ID 只能包含字母、数字、点、下划线与连字符，并以字母开头",
      )
    const result = applySchemaOp(`新建单位 ${id}`, (s) =>
      createUnit(s, { id, symbol, quantityKind }),
    )
    if (!result.ok) return setError(result.message)
    navigate({ pageId: "P04", params: { unitId: id } })
  }

  return (
    <Modal
      title="新建单位"
      subtitle="量种必填；v0.5 契约没有换算公式字段，同量种单位并列展示"
      onClose={onClose}
      footer={
        <>
          <Button intent="ghost" onClick={onClose}>
            取消
          </Button>
          <Button intent="primary" onClick={submit}>
            创建单位
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 px-5 py-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="单位 ID" required hint="例如 degF、kPa">
            <TextInput value={id} mono onChange={(e) => setId(e.target.value)} />
          </Field>
          <Field label="符号" required hint="例如 °F">
            <TextInput
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            />
          </Field>
        </div>
        <Field label="量种" required hint="可输入新量种；已有量种见下列">
          <TextInput
            value={quantityKind}
            mono
            placeholder={kinds.join(" / ")}
            onChange={(e) => setQuantityKind(e.target.value)}
          />
        </Field>
        {error ? (
          <p role="alert" className="text-label text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  )
}

function CreateConstraintModal({ onClose }: { onClose: () => void }) {
  const model = useDraftModel()
  const readOnly = useReadOnly()
  const [id, setId] = useState("")
  const [floorC, setFloorC] = useState("20")
  const [domain, setDomain] = useState("cooling-only-fixed-equal-sources")
  const [unsupported, setUnsupported] = useState("")
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    if (!validId(id))
      return setError(
        "ID 只能包含字母、数字、点、下划线与连字符，并以字母开头",
      )
    const floor = Number(floorC.trim())
    const result = applySystemsOp(`新建约束 ${id}`, (c) =>
      createConstraint(c, {
        id,
        floorC: floor,
        domain,
        unsupported,
      }),
    )
    if (!result.ok) return setError(result.message)
    navigate({ pageId: "P04", params: { constraintId: id } })
  }

  return (
    <Modal
      title="新建约束"
      subtitle="策略固定为比例分配（v0.5 契约唯一策略），版本从 c1 起"
      onClose={onClose}
      footer={
        <>
          <Button intent="ghost" onClick={onClose}>
            取消
          </Button>
          <Button intent="primary" disabled={readOnly} onClick={submit}>
            创建约束
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 px-5 py-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="约束 ID" required hint="例如 cooling-floor-b">
            <TextInput value={id} mono onChange={(e) => setId(e.target.value)} />
          </Field>
          <Field label="冷源下限（°C）" required>
            <TextInput
              value={floorC}
              mono
              inputMode="decimal"
              onChange={(e) => setFloorC(e.target.value)}
            />
          </Field>
        </div>
        <Field label="适用域" required hint="该约束成立的场景范围">
          <TextInput
            value={domain}
            mono
            onChange={(e) => setDomain(e.target.value)}
          />
        </Field>
        <Field label="不支持的场景" hint="逗号分隔；留空表示无额外声明">
          <TextInput
            value={unsupported}
            mono
            onChange={(e) => setUnsupported(e.target.value)}
          />
        </Field>
        {error ? (
          <p role="alert" className="text-label text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  )
}
