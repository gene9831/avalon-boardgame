import { useEffect, useRef, type RefObject } from 'react'

const focusableSelector =
  'input, button, select, textarea, [href], [tabindex]:not([tabindex="-1"])'

export function useModalLayer({
  onClose,
  open,
  panelRef,
  triggerRef,
}: {
  onClose: () => void
  open: boolean
  panelRef: RefObject<HTMLElement | null>
  triggerRef: RefObject<HTMLElement | null>
}) {
  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) triggerRef.current?.focus()
      wasOpenRef.current = false
      return
    }

    wasOpenRef.current = true
    const previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab' || panelRef.current === null) return

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => !element.hasAttribute('disabled'))
      if (focusable.length === 0) return

      const first = focusable[0]!
      const last = focusable.at(-1)!
      const activeElement = document.activeElement
      if (!panelRef.current.contains(activeElement)) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousBodyOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, open, panelRef, triggerRef])
}
