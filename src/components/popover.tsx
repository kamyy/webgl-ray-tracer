/**
 * A small card that floats next to its anchor and closes on Escape or on a click outside it.
 *
 * The caller positions it with a `className` such as `top-full right-0`. The card is absolutely placed inside the
 * nearest positioned ancestor, so it overlaps the render view instead of resizing it.
 */
import { ReactNode, useEffect, useRef } from 'react'

interface PopoverProps {
  title: string // read aloud by screen readers, not drawn
  className: string
  onClose: () => void
  children: ReactNode
}

// The `title` is the dialog's accessible name. The card has no visible heading.
export function Popover({ title, className, onClose, children }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Escape closes the card.
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    // A press anywhere outside the card closes it.
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Element
      // The button that opens the popover also closes it, so a press on it is left for its own handler.
      if (!ref.current?.contains(target) && !target.closest('[data-popover-toggle]')) {
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={title}
      className={`absolute z-20 w-[min(30rem,calc(100vw-1.5rem))] rounded-2xl border border-gray-300 bg-white p-3.5 dark:border-gray-600 dark:bg-gray-900 shadow-xl ${className}`}
    >
      {children}
    </div>
  )
}
