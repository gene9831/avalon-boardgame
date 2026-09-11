import { useCallback, useEffect, useState } from 'react'

export interface ElementSize {
  height: number
  width: number
}

const emptySize: ElementSize = { height: 0, width: 0 }

export function useElementSize<T extends HTMLElement>() {
  const [element, setElement] = useState<T | null>(null)
  const [size, setSize] = useState<ElementSize>(emptySize)
  const ref = useCallback((node: T | null) => setElement(node), [])

  useEffect(() => {
    if (element === null) {
      setSize(emptySize)
      return
    }

    const observer = new ResizeObserver(([entry]) => {
      if (entry === undefined) return
      setSize({
        height: entry.contentRect.height,
        width: entry.contentRect.width,
      })
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [element])

  return { ref, size }
}
