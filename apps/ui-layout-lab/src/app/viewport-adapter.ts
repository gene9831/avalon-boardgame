export type ViewportSize = Readonly<{ width: number, height: number }>

export type ViewportAdapter = Readonly<{
  measure: () => ViewportSize
  dispose: () => void
}>

export function createViewportAdapter(
  viewportElement: HTMLElement,
  onResize: (size: ViewportSize) => void,
): ViewportAdapter {
  let animationFrame = 0

  const measure = (): ViewportSize => ({
    width: Math.round(viewportElement.getBoundingClientRect().width),
    height: Math.round(viewportElement.getBoundingClientRect().height),
  })
  const observer = new ResizeObserver(() => {
    cancelAnimationFrame(animationFrame)
    animationFrame = requestAnimationFrame(() => onResize(measure()))
  })
  observer.observe(viewportElement)

  return {
    measure,
    dispose: () => {
      cancelAnimationFrame(animationFrame)
      observer.disconnect()
    },
  }
}
