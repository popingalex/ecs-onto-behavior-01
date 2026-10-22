import assert from "node:assert/strict"
import { buildIndex } from "@/data/index"
import { loadSeed } from "@/mock/seed"
import { checkRoute } from "@/navigation/resolve"
import { nextBundleId, publishBundle, publishStore } from "@/stores/publish"

/**
 * Bug2 回归：P19 深链 bundleId 必须识别本地发布 bundle（publishStore），
 * 不只是种子 bundles；未知 bundle 仍必须报「目标对象不存在」。
 */
function fixture() {
  const seed = loadSeed()
  return {
    index: buildIndex(seed),
    history: {
      branches: Object.fromEntries(seed.branches.map((b) => [b.id, b])),
      commits: Object.fromEntries(seed.commits.map((c) => [c.id, c])),
    },
  }
}

export function localPublishedBundleResolves() {
  const { index, history } = fixture()
  const id = nextBundleId(publishStore.getState().bundles.map((b) => b.id))
  publishBundle({
    id,
    label: "深链测试包",
    revision: 1,
    createdAt: new Date().toISOString(),
    actorId: "u-test",
    modelHash: "hash-test",
    manifest: [],
    warnings: 0,
  })
  const check = checkRoute(
    { pageId: "P19", params: { bundleId: id } },
    index,
    history,
  )
  assert.deepEqual(check, { status: "ok" })
}

export function seedBundleStillResolves() {
  const { index, history } = fixture()
  const check = checkRoute(
    { pageId: "P19", params: { bundleId: "bundle-04" } },
    index,
    history,
  )
  assert.deepEqual(check, { status: "ok" })
}

export function unknownBundleStillRejected() {
  const { index, history } = fixture()
  const check = checkRoute(
    { pageId: "P19", params: { bundleId: "bundle-local-999" } },
    index,
    history,
  )
  assert.equal(check.status, "missingTarget")
  if (check.status === "missingTarget") {
    assert.equal(check.items.length, 1)
    assert.equal(check.items[0].param, "bundleId")
    assert.equal(check.items[0].id, "bundle-local-999")
  }
}
