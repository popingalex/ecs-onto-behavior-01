import { useSyncExternalStore } from 'react'

/**
 * 极简外部 store：替代 egui 端的 Resource/State。
 * selector 必须返回稳定引用（原值或 store 内已有对象），否则会重复渲染。
 */
export interface Store<T> {
  getState(): T
  setState(partial: Partial<T> | ((state: T) => Partial<T>)): void
  subscribe(listener: () => void): () => void
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial
  const listeners = new Set<() => void>()
  return {
    getState: () => state,
    setState(partial) {
      const next = typeof partial === 'function' ? partial(state) : partial
      if (!next || Object.keys(next).length === 0) return
      state = { ...state, ...next }
      listeners.forEach((listener) => listener())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export function useStore<T, S>(store: Store<T>, selector: (state: T) => S): S {
  const read = () => selector(store.getState())
  return useSyncExternalStore(store.subscribe, read, read)
}
