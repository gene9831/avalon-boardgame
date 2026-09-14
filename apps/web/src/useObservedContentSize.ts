import { useCallback, useEffect, useRef, useState, type RefCallback } from 'react'

import {
  contentSizesEqual,
  normalizeContentSize,
  readResizeObserverContentSize,
  type ContentSize,
} from './element-content-size'

export function useObservedContentSize<T extends HTMLElement>(): {
  ref: RefCallback<T>
  size: ContentSize | null
} {
  const [element, setElement] = useState<T | null>(null)
  const [size, setSize] = useState<ContentSize | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const pendingSizeRef = useRef<ContentSize | null>(null)

  const ref = useCallback<RefCallback<T>>((node) => {
    setElement(node)
  }, [])

  useEffect(() => {
    if (element === null) return

    let active = true

    const scheduleSize = (nextSize: ContentSize | null) => {
      if (nextSize === null) return
      pendingSizeRef.current = nextSize
      if (animationFrameRef.current !== null) return

      animationFrameRef.current = requestAnimationFrame(() => {
        animationFrameRef.current = null
        if (!active || pendingSizeRef.current === null) return
        const pendingSize = pendingSizeRef.current
        setSize((previous) => contentSizesEqual(previous, pendingSize) ? previous : pendingSize)
      })
    }

    const initialSize = normalizeContentSize(element.clientWidth, element.clientHeight)
      ?? normalizeContentSize(
        element.getBoundingClientRect().width,
        element.getBoundingClientRect().height,
      )
    scheduleSize(initialSize)

    const observer = new ResizeObserver((entries) => {
      const latestEntry = entries.at(-1)
      if (latestEntry !== undefined) {
        scheduleSize(readResizeObserverContentSize(latestEntry))
      }
    })
    observer.observe(element)

    return () => {
      active = false
      observer.disconnect()
      pendingSizeRef.current = null
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [element])

  return { ref, size }
}
