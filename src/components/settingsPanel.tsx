/**
 * The collapsible card with the render settings, floating over the bottom left of the render.
 *
 * Open, it shows the sliders, number fields and shading control from `RenderSettings`, so a value can be changed while
 * the image converges behind it. The title bar collapses it to a small Settings button that restores it. On a phone in
 * portrait the open card is a bottom sheet across the full width. It is absolutely positioned, so opening and closing
 * it never resizes the canvas or restarts accumulation.
 */
import { useState } from 'react'
import { RenderSettings } from './renderSettings'

// Anchors the card, and its collapsed button, to the bottom left corner, clear of a phone's rounded corners.
const position =
  'absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))] z-10'

// The icon on the title bar and on the collapsed button.
function SlidersIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </svg>
  )
}

export function SettingsPanel() {
  // Starts open, so the settings are visible the first time the page loads.
  const [open, setOpen] = useState(true)

  // Collapsed: just a button that opens the card again.
  if (!open) {
    return (
      <button
        type="button"
        aria-expanded={false}
        className={`${position} flex min-h-12 items-center gap-2 rounded-full bg-white/70 backdrop-blur-md px-5 text-sm font-bold shadow-xl hover:bg-white dark:bg-gray-900/70 dark:hover:bg-gray-800`}
        onClick={() => setOpen(true)}
      >
        <SlidersIcon />
        Settings
      </button>
    )
  }

  // Open: the title bar collapses the card, and the settings sit below it.
  return (
    <section
      aria-label="Render settings"
      className={`${position} w-72 rounded-2xl bg-white/70 backdrop-blur-md p-3 shadow-xl dark:bg-gray-900/70 md:w-80 max-md:portrait:right-0 max-md:portrait:bottom-0 max-md:portrait:left-0 max-md:portrait:w-auto max-md:portrait:rounded-b-none max-md:portrait:pb-[max(0.75rem,env(safe-area-inset-bottom))]`}
    >
      <button
        type="button"
        aria-expanded
        aria-label="Hide render settings"
        className="mb-1 flex min-h-9 w-full items-center justify-between rounded-lg px-1 text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-800"
        onClick={() => setOpen(false)}
      >
        <span className="flex items-center gap-2">
          <SlidersIcon />
          Render settings
        </span>
        <svg
          className="h-5 w-5 text-gray-600 dark:text-gray-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <RenderSettings />
    </section>
  )
}
