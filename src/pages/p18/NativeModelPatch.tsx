import { useState } from "react"
import { CircleCheck, Play, RefreshCw, ShieldAlert } from "lucide-react"
import { KeyValue, Notice, SectionLabel } from "@/components/ui/Card"
import { Tag } from "@/components/ui/StatusTag"
import Button from "@/components/ui/Button"
import Field, { TextInput } from "@/components/ui/Field"
import Table, { Td, Th, Tr } from "@/components/ui/Table"
import {
  DEFAULT_PATCH_BASE,
  nativeModelPatchClient,
  type ApplyReplyDto,
  type ValidateReplyDto,
} from "@/services/modelPatch/nativeClient"
import type { ModelPatch } from "@/services/modelPatch/protocol"

/**
 * REAL_IMPORT_READ_ONLY 的 P18 内容:W1 原生事务化模型补丁面板。
 * 只连隔离实例(默认 18081;绝不指向 18080 共享服务);
 * validate 零写入预览 → apply 事务提交(乐观锁+幂等) → 引擎原生 revision。
 * 首批范围=replaceAttribute(引擎 W1 契约);dryRun/apply 事实可复核于引擎审计表。
 */
export default function NativeModelPatch() {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_PATCH_BASE)
  const [sceneId, setSceneId] = useState("chem-roaded-w1lab")
  const [instanceId, setInstanceId] = useState("tank-1")
  const [attributePath, setAttributePath] = useState("health/durability")
  const [newValue, setNewValue] = useState("30")
  const [revision, setRevision] = useState<string | null>(null)
  const [validateResult, setValidateResult] = useState<ValidateReplyDto | null>(null)
  const [applyResult, setApplyResult] = useState<ApplyReplyDto | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const endpoints = { baseUrl }
  const patchId = `wb-${Date.now().toString(36)}`
  const idemKey = `wb-key-${Date.now().toString(36)}`

  const buildPatch = (expectedRevision: string): ModelPatch => ({
    patchId,
    sourceSystemId: "mas-rust",
    targetSceneId: sceneId,
    expectedRevision,
    idempotencyKey: idemKey,
    operations: [
      {
        op: "replaceAttribute",
        entityId: instanceId,
        attributePath,
        newValue: Number.isNaN(Number(newValue)) ? newValue : Number(newValue),
      },
    ],
  })

  const run = async (name: string, fn: () => Promise<void>) => {
    setBusy(name)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-6">
      <section>
        <div className="flex items-center gap-2">
          <ShieldAlert size={18} className="text-muted" aria-hidden />
          <h2 className="text-title font-semibold">原生模型补丁(W1 · 事务化)</h2>
          <Tag size="sm" tone="purple">原生引擎</Tag>
        </div>
        <p className="mt-1 text-body text-muted">
          引擎侧 /cm/model-patch(单事务:乐观锁+幂等摘要+原子回滚);首批范围=replaceAttribute。
          仅连隔离实例,18080 共享服务不可作为目标。
        </p>
      </section>

      <Notice tone="warning">
        本面板直接写引擎 PG 中的目标场景(经事务端点)。生产场景请勿用作目标——
        使用试验场景副本(如 chem-roaded-w1lab);每次 apply 都可在引擎 s_model_patch 审计表复核。
      </Notice>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KeyValue label="引擎实例"><span className="font-mono">{baseUrl}</span></KeyValue>
        <KeyValue label="当前修订">
          {revision ?? (
            <Button size="sm" intent="ghost" disabled={busy !== null} onClick={() =>
              run("revision", async () => setRevision((await nativeModelPatchClient.revision(endpoints, sceneId)).revision))
            }>
              拉取
            </Button>
          )}
        </KeyValue>
        <KeyValue label="patchId"><span className="font-mono">{patchId}</span></KeyValue>
        <KeyValue label="idempotencyKey"><span className="font-mono">{idemKey}</span></KeyValue>
      </div>

      <section>
        <SectionLabel>补丁构造(replaceAttribute)</SectionLabel>
        <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Field label="引擎地址">
            <TextInput value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          </Field>
          <Field label="目标场景">
            <TextInput value={sceneId} onChange={(e) => setSceneId(e.target.value)} />
          </Field>
          <Field label="实例 ID">
            <TextInput value={instanceId} onChange={(e) => setInstanceId(e.target.value)} />
          </Field>
          <Field label="属性路径">
            <TextInput value={attributePath} onChange={(e) => setAttributePath(e.target.value)} />
          </Field>
          <Field label="新值(数值/字符串)">
            <TextInput value={newValue} onChange={(e) => setNewValue(e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        <Button
          icon={Play}
          intent="secondary"
          disabled={busy !== null || revision === null}
          onClick={() =>
            run("validate", async () => {
              const r = await nativeModelPatchClient.validate(endpoints, buildPatch(revision!))
              setValidateResult(r)
            })
          }
        >
          {busy === "validate" ? "校验中…" : "validate(零写入预览)"}
        </Button>
        <Button
          icon={CircleCheck}
          intent="primary"
          disabled={busy !== null || revision === null || validateResult?.ok !== true}
          onClick={() =>
            run("apply", async () => {
              const r = await nativeModelPatchClient.apply(endpoints, buildPatch(revision!))
              setApplyResult(r)
              if (r.status === "APPLIED" && r.nativeRevision) {
                setRevision(r.nativeRevision)
                setValidateResult(null)
              }
            })
          }
        >
          {busy === "apply" ? "提交中…" : "apply(事务提交)"}
        </Button>
        <Button
          icon={RefreshCw}
          intent="ghost"
          disabled={busy !== null}
          onClick={() =>
            run("revision", async () => setRevision((await nativeModelPatchClient.revision(endpoints, sceneId)).revision))
          }
        >
          刷新修订
        </Button>
      </section>

      {error && <Notice tone="danger">请求失败:{error}</Notice>}
      {validateResult && (
        <section>
          <SectionLabel>validate 结果(未写引擎)</SectionLabel>
          {validateResult.ok ? (
            <Table className="mt-2">
              <thead>
                <tr>
                  <Th>实例</Th>
                  <Th>属性</Th>
                  <Th>before</Th>
                  <Th>after</Th>
                </tr>
              </thead>
              <tbody>
                {validateResult.changeset.map((c) => (
                  <Tr key={`${c.instanceId}:${c.attributePath}`}>
                    <Td className="font-mono text-label">{c.instanceId}</Td>
                    <Td className="font-mono text-label">{c.attributePath}</Td>
                    <Td className="font-mono">{String(JSON.stringify(c.before))}</Td>
                    <Td className="font-mono">{String(JSON.stringify(c.after))}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <Notice tone="warning">
              拒绝:{validateResult.diagnostics.map((d) => `${d.code} ${d.message}`).join(";")}
            </Notice>
          )}
        </section>
      )}
      {applyResult && (
        <section>
          <SectionLabel>apply 结果</SectionLabel>
          <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KeyValue label="状态">
              <Tag
                size="sm"
                tone={
                  applyResult.status === "APPLIED"
                    ? "success"
                    : applyResult.status === "REPLAYED"
                      ? "primary"
                      : "danger"
                }
              >
                {applyResult.status}
              </Tag>
            </KeyValue>
            <KeyValue label="原生 revision"><span className="font-mono">{applyResult.nativeRevision ?? "—"}</span></KeyValue>
            <KeyValue label="重放">{applyResult.replayed ? "是(未重复写)" : "否"}</KeyValue>
            <KeyValue label="诊断">{applyResult.diagnostics.length ? applyResult.diagnostics.map((d) => d.code).join(",") : "无"}</KeyValue>
          </div>
        </section>
      )}
    </div>
  )
}
