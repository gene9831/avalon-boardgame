import { useObservedContentSize } from './useObservedContentSize'

export interface ElementSize {
  height: number
  width: number
}

const emptySize: ElementSize = { height: 0, width: 0 }

export function useElementSize<T extends HTMLElement>() {
  const observed = useObservedContentSize<T>()
  return { ref: observed.ref, size: observed.size ?? emptySize }
}
