/**
 * The collapsible card with the render settings, floating over the bottom left of the render.
 *
 * Open, it shows the sliders, number fields and shading control from `RenderSettings`, so a value can be changed while
 * the image converges behind it. The title bar collapses it to a small Settings button that restores it. Its Reset
 * button returns every setting to its default, and the focus, exposure and contrast to the loaded scene's own values,
 * after the user confirms. On a phone in portrait the open card is a bottom sheet across the full width. On a phone in
 * landscape it is wider, with the scene cards, the image settings and the tracing settings side by side, so it fits
 * without scrolling. A window too short
 * for the card scrolls it instead of letting it cover the readout. It is absolutely positioned, so opening and closing
 * it never resizes the canvas or restarts accumulation.
 */
import { useState } from 'react'
import { useAppStore } from '../lib/store/appStore'
import { Icon } from './icon'
import { RenderSettings } from './renderSettings'

// Anchors the card, and its collapsed button, to the bottom left corner, clear of a phone's rounded corners.
const position =
  'absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))] z-10'

// The icon on the title bar and on the collapsed button.
function SlidersIcon() {
  return (
    <Icon className="h-4 w-4">
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </Icon>
  )
}

// Returns every setting to its default. It sits in the title bar beside the collapse button, so it costs the card no
// height on a phone. A reset that changes a tracing setting throws away the samples traced so far, which can be a long
// finished render, so it asks first.
function ResetButton() {
  const resetSettings = useAppStore(state => state.resetSettings)

  const onReset = () => {
    if (window.confirm('Reset every setting to its default? Changing a tracing setting restarts the render.')) {
      resetSettings()
    }
  }

  return (
    <button
      type="button"
      title="Return every setting to its default"
      className="flex min-h-9 flex-none items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 hover:text-current dark:text-gray-400 dark:hover:bg-gray-800"
      onClick={onReset}
    >
      <Icon className="h-4 w-4">
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5" />
      </Icon>
      Reset
    </button>
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
        className={`${position} flex min-h-12 items-center gap-2 rounded-full bg-white/70 px-5 text-sm font-bold shadow-xl backdrop-blur-md hover:bg-white dark:bg-gray-900/70 dark:hover:bg-gray-800`}
        onClick={() => setOpen(true)}
      >
        <SlidersIcon />
        Settings
      </button>
    )
  }

  // Open: the title bar collapses the card or resets the settings, and the settings sit below it.
  return (
    <section
      aria-label="Render settings"
      className={`${position} max-h-[calc(100%-7rem)] w-72 overflow-y-auto overscroll-contain rounded-2xl bg-white/70 p-3 shadow-xl backdrop-blur-md md:w-80 max-md:portrait:right-0 max-md:portrait:bottom-0 max-md:portrait:left-0 max-md:portrait:w-auto max-md:portrait:rounded-b-none max-md:portrait:pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:bg-gray-900/70 short:landscape:w-[min(62rem,calc(100vw-1.5rem))]!`}
    >
      <div className="mb-1 flex items-center gap-1">
        <button
          type="button"
          aria-expanded
          aria-label="Hide render settings"
          className="flex min-h-9 min-w-0 flex-1 items-center justify-between rounded-lg px-1 text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-800"
          onClick={() => setOpen(false)}
        >
          <span className="flex items-center gap-2">
            <SlidersIcon />
            Render settings
          </span>
          <Icon className="h-5 w-5 text-gray-600 dark:text-gray-400">
            <path d="M6 9l6 6 6-6" />
          </Icon>
        </button>
        <ResetButton />
      </div>
      <RenderSettings />
    </section>
  )
}
