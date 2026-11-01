/**
 * The floating heads-up display over the render: the progress pill and the theme and About buttons.
 *
 * The pill's ring and counters are read-only. Their values come from the app store, where `PathTracer` writes them a
 * few times a second. Everything is absolutely positioned over the render view, so the render keeps the whole screen
 * and opening the About popover never resizes the canvas. On a phone the pill shrinks to the ring, the pass count and
 * the time left.
 */
import { useCallback, useState } from 'react'
import { useTheme } from '../lib/hooks/useTheme'
import { useAppStore } from '../lib/store/appStore'
import { About } from './about'
import { Popover } from './popover'
import { ProgressRing } from './progressRing'

// The floating elements stay clear of a phone's notch and rounded corners with the safe-area insets.
const topEdge = 'top-[max(0.75rem,env(safe-area-inset-top))]'
const leftEdge = 'left-[max(0.75rem,env(safe-area-inset-left))]'
const rightEdge = 'right-[max(0.75rem,env(safe-area-inset-right))]'

// The translucent, blurred look shared by the pill and the round buttons, so the render stays visible behind them.
const glass = 'bg-white/70 shadow-xl backdrop-blur-md dark:bg-gray-900/70'
const roundButton = `grid size-12 place-items-center rounded-full hover:bg-white dark:hover:bg-gray-800 ${glass}`

const mutedText = 'text-gray-600 dark:text-gray-400'

// --- Shared --------------------------------------------------------------------------

// A 20 px line icon. The caller supplies the SVG shapes, drawn on a 24 by 24 grid.
function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

// --- Progress pill -------------------------------------------------------------------

// One timing counter: a small label over a large value.
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className={`text-sm ${mutedText}`}>{label}</span>
      {/* The value has no width of its own, so a changing number never moves the columns. The label sets the width. */}
      <span className="w-0 text-lg whitespace-nowrap tabular-nums">{value}</span>
    </div>
  )
}

// The pill at the top left. It re-renders only when `PathTracer` writes new counters to the store.
function ProgressPill() {
  const renderingPass = useAppStore(state => state.renderingPass)
  const numSamples = useAppStore(state => state.numSamples)
  const elapsedTime = useAppStore(state => state.elapsedTime)
  const etaTime = useAppStore(state => state.etaTime)
  const avgTime = useAppStore(state => state.avgTime)
  const proportion = Math.min(renderingPass / numSamples, 1)

  return (
    <div
      className={`absolute z-10 flex items-center gap-3 rounded-full p-1.5 pr-5 md:gap-5 md:pr-7 ${topEdge} ${leftEdge} ${glass}`}
    >
      <ProgressRing proportion={proportion} className="size-13 md:size-16" />

      {/* The pass counter. The number has a minimum width so a 1 digit and a 2 digit count take the same room. */}
      <div className="leading-tight">
        <div className="font-medium tabular-nums">
          <span className="inline-block min-w-[3ch] text-right text-xl md:text-3xl">{renderingPass}</span>
          <span className={`text-base ${mutedText}`}> / {numSamples} passes</span>
        </div>
        <div className={`text-sm ${mutedText}`}>
          {/* A phone has no room for the three counters, so its second line shows the time left instead of the name. */}
          <span className="md:hidden">{etaTime} left</span>
          <span className="hidden md:inline">WebGL Ray Tracer</span>
        </div>
      </div>

      {/* The timing counters, from the tablet breakpoint up. */}
      <div className="hidden gap-10 md:flex">
        <Stat label="Elapsed" value={elapsedTime} />
        <Stat label="Remaining" value={etaTime} />
        <Stat label="Avg. per pass" value={avgTime} />
      </div>
    </div>
  )
}

// --- Buttons -------------------------------------------------------------------------

// Switches between light and dark. Its icon shows the mode a press switches to: a sun in dark mode and a moon in light.
function ThemeButton() {
  const { theme, toggleTheme } = useTheme()

  let icon = (
    <Icon>
      <path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" />
    </Icon>
  )
  let label = 'Switch to dark mode'
  if (theme === 'dark') {
    icon = (
      <Icon>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
      </Icon>
    )
    label = 'Switch to light mode'
  }

  return (
    <button type="button" aria-label={label} className={roundButton} onClick={toggleTheme}>
      {icon}
    </button>
  )
}

// Opens the About popover below the button. The wrapper is the popover's positioning parent.
function AboutButton() {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])

  let popover: React.ReactNode = null
  if (open) {
    popover = (
      <Popover title="About" className="top-full right-0 mt-2" onClose={close}>
        <About />
      </Popover>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        data-popover-toggle // tells the popover that a press on this button is not an outside click
        aria-expanded={open}
        aria-label="About"
        className={roundButton}
        onClick={() => setOpen(!open)}
      >
        <Icon>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </Icon>
      </button>
      {popover}
    </div>
  )
}

// --- Heads-up display ----------------------------------------------------------------

export function Hud() {
  return (
    <>
      <ProgressPill />

      <div className={`absolute z-10 flex gap-2 ${topEdge} ${rightEdge}`}>
        <ThemeButton />
        <AboutButton />
      </div>
    </>
  )
}
