import assert from "node:assert/strict"
import {
  MAP_LAYOUT_DEFAULT,
  reduceMapLayout,
  type MapLayoutState,
} from "../mapLayout"

/** P20 地图主角布局：三面板互斥 reducer（纯函数，不触碰 store）。 */

function invariant(s: MapLayoutState) {
  if (s.pinned !== null) assert.equal(s.open, s.pinned, "pin 的面板必须处于展开态")
}

export function mapLayoutDefaultAllClosed() {
  assert.deepEqual(MAP_LAYOUT_DEFAULT, { open: null, pinned: null })
}

export function mapLayoutOpenLeftThenRightCollapsesLeft() {
  let s = MAP_LAYOUT_DEFAULT
  s = reduceMapLayout(s, { type: "toggle", panel: "left" })
  assert.deepEqual(s, { open: "left", pinned: null })
  s = reduceMapLayout(s, { type: "toggle", panel: "right" })
  assert.deepEqual(s, { open: "right", pinned: null }, "开右时左自动收回")
  s = reduceMapLayout(s, { type: "toggle", panel: "bottom" })
  assert.deepEqual(s, { open: "bottom", pinned: null }, "开下时右自动收回")
  invariant(s)
}

export function mapLayoutToggleSamePanelCloses() {
  let s = reduceMapLayout(MAP_LAYOUT_DEFAULT, { type: "toggle", panel: "left" })
  s = reduceMapLayout(s, { type: "toggle", panel: "left" })
  assert.deepEqual(s, { open: null, pinned: null })
}

export function mapLayoutPinIsExclusive() {
  let s = reduceMapLayout(MAP_LAYOUT_DEFAULT, { type: "pin", panel: "left" })
  assert.deepEqual(s, { open: "left", pinned: "left" }, "pin 即展开")
  s = reduceMapLayout(s, { type: "pin", panel: "right" })
  assert.deepEqual(s, { open: "right", pinned: "right" }, "pin 三选一：换 pin 即换展开")
  invariant(s)
}

export function mapLayoutOpenOtherUnpinsPrevious() {
  let s = reduceMapLayout(MAP_LAYOUT_DEFAULT, { type: "pin", panel: "left" })
  s = reduceMapLayout(s, { type: "toggle", panel: "bottom" })
  assert.deepEqual(
    s,
    { open: "bottom", pinned: null },
    "pin 住左后展开下：左收回且 pin 解除",
  )
  invariant(s)
}

export function mapLayoutUnpinKeepsOpen() {
  let s = reduceMapLayout(MAP_LAYOUT_DEFAULT, { type: "pin", panel: "right" })
  s = reduceMapLayout(s, { type: "pin", panel: "right" })
  assert.deepEqual(s, { open: "right", pinned: null }, "再点 pin = 解除固定但保持展开")
  invariant(s)
}

export function mapLayoutTogglePinnedPanelClosesAndUnpins() {
  let s = reduceMapLayout(MAP_LAYOUT_DEFAULT, { type: "pin", panel: "left" })
  s = reduceMapLayout(s, { type: "toggle", panel: "left" })
  assert.deepEqual(s, { open: null, pinned: null })
}

export function mapLayoutCloseClearsAll() {
  let s = reduceMapLayout(MAP_LAYOUT_DEFAULT, { type: "pin", panel: "bottom" })
  s = reduceMapLayout(s, { type: "close" })
  assert.deepEqual(s, { open: null, pinned: null })
}
