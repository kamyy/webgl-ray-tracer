/**
 * A small card that floats next to its anchor, with a title bar that closes it, like the settings card's.
 *
 * The caller positions and sizes it with a `className` such as `top-0 right-full w-80`. The card is absolutely placed
 * inside the nearest positioned ancestor, so it overlaps the render view instead of resizing it. The title bar, Escape
 * and a press outside the card close it. A press on the render view leaves the card open, so the camera can be dragged
 * while the card is in view.
 */
import { ReactNode, useEffect, useRef } from 'react'
import { Icon } from './icon'

interface PopoverProps {
  title: string // shown in the title bar, and the dialog's accessible name
  icon: ReactNode // the SVG shapes of the icon beside the title, the same as the button that opens the card
  className: string
  onClose: () => void
  children: ReactNode
}

export function Popover({ title, icon, className, onClose, children }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Escape closes the card.
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    // A press outside the card closes it, except on the render view. The button that opens the popover also closes
    // it, so a press on it is left for its own handler.
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Element
      if (
        ref.current?.contains(target) ||
        target.closest('[data-popover-toggle]') ||
        target instanceof HTMLCanvasElement
      ) {
        return
      }
      onClose()
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
      className={`absolute z-20 rounded-2xl border border-gray-300 bg-white p-3 shadow-xl dark:border-gray-600 dark:bg-gray-900 ${className}`}
    >
      <button
        type="button"
        aria-label={`Hide ${title}`}
        className="mb-1 flex min-h-9 w-full items-center justify-between rounded-lg px-1 text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-800"
        onClick={onClose}
      >
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4">{icon}</Icon>
          {title}
        </span>
        <Icon className="h-5 w-5 text-gray-600 dark:text-gray-400">
          <path d="M6 9l6 6 6-6" />
        </Icon>
      </button>
      {children}
    </div>
  )
}
