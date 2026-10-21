import { CircleAlert } from "lucide-react"
import ObjectLink from "@/components/domain/ObjectLink"
import { Notice } from "@/components/ui/Card"
import type { RefHit } from "./refs"

/** 删除被引用阻止时的统一展示：原因 + 引用位置列表（可跳转）。 */
export default function RefsNotice({
  message,
  refs,
}: {
  message: string
  refs?: RefHit[]
}) {
  return (
    <Notice tone="danger" icon={<CircleAlert size={15} aria-hidden />}>
      <div>{message}</div>
      {refs?.length ? (
        <ul className="mt-1.5 flex flex-col gap-1 text-label">
          {refs.map((r, i) => (
            <li
              key={`${r.kind}:${r.id}:${i}`}
              className="flex flex-wrap items-center gap-x-2"
            >
              {r.route ? (
                <ObjectLink label={r.label} id={r.id} route={r.route} />
              ) : (
                <span className="font-medium">{r.label}</span>
              )}
              <span className="text-danger/80">{r.detail}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </Notice>
  )
}
