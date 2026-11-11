/**
 * The floating heads-up display over the render: the progress pill and the screenshot, theme and About buttons.
 *
 * The pill's ring and counters are read-only. Their values come from the app store, where `PathTracer` writes them a
 * few times a second. Everything is absolutely positioned over the render view, so the render keeps the whole screen
 * and opening the About popover never resizes the canvas. On a phone the pill shrinks to the ring, the sample count and
 * the time left. Pressing the pill folds it down to the ring alone.
 */
import { useCallback, useState } from 'react'
import { useTheme } from '../lib/hooks/useTheme'
import { useAppStore } from '../lib/store/appStore'
import { saveScreenshot } from '../lib/webgl/screenshot'
import { About } from './about'
import { Icon } from './icon'
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

// --- Progress pill -------------------------------------------------------------------

// One counter: a small label over a large value. A value that changes while the render runs has no width of its own, so
// a changing number never moves the columns and the label sets the width. A steady value sets the width itself, so a
// value wider than its label is not clipped by the edge of the pill.
function Stat({ label, value, steady = false }: { label: string; value: string; steady?: boolean }) {
  const valueWidth = steady ? '' : 'w-0'

  return (
    <div className="flex flex-col leading-tight">
      <span className={`text-sm ${mutedText}`}>{label}</span>
      <span className={`text-lg whitespace-nowrap tabular-nums ${valueWidth}`}>{value}</span>
    </div>
  )
}

// The pill at the top left. It re-renders only when `PathTracer` writes new counters to the store.
function ProgressPill() {
  const samplesDone = useAppStore(state => state.samplesDone)
  const numSamples = useAppStore(state => state.numSamples)
  const elapsedTime = useAppStore(state => state.elapsedTime)
  const etaTime = useAppStore(state => state.etaTime)
  const avgTime = useAppStore(state => state.avgTime)
  const resolution = useAppStore(state => state.resolution)
  const proportion = Math.min(samplesDone / numSamples, 1)

  // Pressing the pill folds it down to just the ring, and pressing it again unfolds the counters.
  const [collapsed, setCollapsed] = useState(false)

  let counters: React.ReactNode = null
  if (!collapsed) {
    counters = (
      <>
        {/* The sample counter. The number has a minimum width so a 1 digit and a 2 digit count take the same room. */}
        <div className="leading-tight">
          <div className="font-medium tabular-nums">
            <span className="inline-block min-w-[3ch] text-right text-xl md:text-3xl">{samplesDone}</span>
            <span className={`text-base ${mutedText}`}> / {numSamples} samples</span>
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
          <Stat label="Avg. per sample" value={avgTime} />
          <Stat label="Resolution" value={resolution} steady />
        </div>
      </>
    )
  }

  const padding = collapsed ? '' : 'pr-5 md:pr-7'

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={!collapsed}
      aria-label={collapsed ? 'Show render stats' : 'Hide render stats'}
      className={`absolute z-10 flex cursor-pointer items-center gap-3 rounded-full p-1.5 select-none md:gap-5 ${padding} ${topEdge} ${leftEdge} ${glass}`}
      onClick={() => setCollapsed(!collapsed)}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          setCollapsed(!collapsed)
        }
      }}
    >
      <ProgressRing proportion={proportion} className="size-13 md:size-16" />
      {counters}
    </div>
  )
}

// --- Buttons -------------------------------------------------------------------------

// Switches between light and dark. Its icon shows the mode a press switches to: a sun in dark mode and a moon in light.
function ThemeButton() {
  const { theme, toggleTheme } = useTheme()

  let icon = (
    <Icon strokeWidth={1.8}>
      <path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" />
    </Icon>
  )
  let label = 'Switch to dark mode'
  if (theme === 'dark') {
    icon = (
      <Icon strokeWidth={1.8}>
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

// Saves the render as a PNG. It is disabled until the render reaches 100%, so the file is always the finished image.
function ScreenshotButton() {
  const complete = useAppStore(state => state.samplesDone >= state.numSamples)

  return (
    <button
      type="button"
      aria-label="Save screenshot"
      disabled={!complete}
      title={complete ? 'Save screenshot' : 'Available when the render reaches 100%'}
      className={`${roundButton} disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/70 dark:disabled:hover:bg-gray-900/70`}
      onClick={saveScreenshot}
    >
      <Icon strokeWidth={1.8}>
        <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14" />
      </Icon>
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
        <Icon strokeWidth={1.8}>
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
        <ScreenshotButton />
        <ThemeButton />
        <AboutButton />
      </div>
    </>
  )
}
