import { useEffect, useRef, type RefObject } from 'react'

const focusableSelector =
  'input, button, select, textarea, summary, [href], [tabindex]:not([tabindex="-1"])'

function getFocusableElements(panel: HTMLElement) {
  return Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) => {
      const closedDisclosure = element.closest('details:not([open])')
      const isDisclosureSummary = closedDisclosure?.querySelector('summary') === element

      return !element.hasAttribute('disabled')
        && !element.hidden
        && element.getClientRects().length > 0
        && (closedDisclosure === null || isDisclosureSummary)
    },
  )
}

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
    const panel = panelRef.current
    if (panel !== null) getFocusableElements(panel)[0]?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab' || panelRef.current === null) return

      const focusable = getFocusableElements(panelRef.current)
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
