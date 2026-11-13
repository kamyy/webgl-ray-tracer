/**
 * The floating heads-up display over the render: the progress pill and its buttons.
 *
 * The round buttons sit in one row at the bottom right, and their popovers open above it. Which popover is open lives
 * in the store's `openPanel`, shared with the settings card, so opening one card closes the others. The pill's ring and
 * counters are read-only. Their values come from the app store, where `PathTracer` writes them a few times a second. Everything is absolutely positioned over the render view, so the render keeps the whole screen
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
import { WireframeSettings } from './wireframeSettings'

// The floating elements stay clear of a phone's notch and rounded corners with the safe-area insets.
const topEdge = 'top-[max(0.75rem,env(safe-area-inset-top))]'
const bottomEdge = 'bottom-[max(0.75rem,env(safe-area-inset-bottom))]'
const leftEdge = 'left-[max(0.75rem,env(safe-area-inset-left))]'
const rightEdge = 'right-[max(0.75rem,env(safe-area-inset-right))]'

// The translucent, blurred look shared by the pill and the round buttons, so the render stays visible behind them.
const glass = 'bg-white/70 shadow-xl backdrop-blur-md dark:bg-gray-900/70'
const roundButton = `grid size-12 place-items-center rounded-full hover:bg-white dark:hover:bg-gray-800 ${glass}`

const mutedText = 'text-gray-600 dark:text-gray-400'

// Places a popover above the button row, level with the row's right end, whichever button opened it. The buttons'
// wrappers have no position of their own, so the row is the popover's positioning parent. The width leaves the screen
// margins, so a phone in portrait shows the whole card.
const popoverAbove = 'bottom-full right-0 mb-2 w-[min(30rem,calc(100vw-1.5rem))]'

// The icons the About and wireframe buttons share with their popovers' title bars.
const aboutIcon = (
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </>
)
// A cube drawn with its hidden edges, as a wireframe shows it.
const wireframeIcon = (
  <>
    <path d="M4 8l8-4 8 4v8l-8 4-8-4z" />
    <path d="M4 8l8 4 8-4M12 12v8" />
    <path d="M4 16l8-4 8 4M12 4v8" strokeDasharray="1.5 2" />
  </>
)

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
  let label = 'Enable dark mode'
  if (theme === 'dark') {
    icon = (
      <Icon strokeWidth={1.8}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
      </Icon>
    )
    label = 'Enable light mode'
  }

  return (
    <button type="button" aria-label={label} title={label} className={roundButton} onClick={toggleTheme}>
      {icon}
    </button>
  )
}

// Saves the render as a PNG, without any BVH boxes drawn over it. It is disabled until the render reaches 100%, so the
// file is always the finished image. It is also disabled while the mesh wireframe replaces the render on screen.
function ScreenshotButton() {
  const complete = useAppStore(state => state.samplesDone >= state.numSamples)
  const wireframeShown = useAppStore(state => state.showMeshWireframe)

  let title = 'Download screenshot'
  if (wireframeShown) {
    title = 'Available when the mesh wireframe is off'
  } else if (!complete) {
    title = 'Available when the render reaches 100%'
  }

  return (
    <button
      type="button"
      aria-label="Download screenshot"
      disabled={!complete || wireframeShown}
      title={title}
      className={`${roundButton} disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/70 dark:disabled:hover:bg-gray-900/70`}
      onClick={saveScreenshot}
    >
      <Icon strokeWidth={1.8}>
        <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14" />
      </Icon>
    </button>
  )
}

// Opens the About popover above the button row. It stays open while the camera is dragged, so the gestures
// it lists can be tried with it in view.
function AboutButton() {
  const open = useAppStore(state => state.openPanel === 'about')
  const setOpenPanel = useAppStore(state => state.setOpenPanel)
  const close = useCallback(() => setOpenPanel(null), [setOpenPanel])

  let popover: React.ReactNode = null
  if (open) {
    popover = (
      <Popover title="Mouse and touch controls" icon={aboutIcon} className={popoverAbove} onClose={close}>
        <About />
      </Popover>
    )
  }

  return (
    <div>
      <button
        type="button"
        data-popover-toggle // tells the popover that a press on this button is not an outside click
        aria-expanded={open}
        aria-label="About"
        title="Mouse and touch controls"
        className={roundButton}
        onClick={() => setOpenPanel(open ? null : 'about')}
      >
        <Icon strokeWidth={1.8}>{aboutIcon}</Icon>
      </button>
      {popover}
    </div>
  )
}

// Opens the wireframe controls above the button row. They stay open while the camera is dragged, so the view can be
// turned while the depth band is adjusted. While either wireframe is shown, the button wears an accent ring and its
// label ends in "on", so a closed popover still shows that one is on. The button only opens the popover, so it is not
// marked as a toggle.
function WireframeButton() {
  const open = useAppStore(state => state.openPanel === 'wireframe')
  const setOpenPanel = useAppStore(state => state.setOpenPanel)
  const close = useCallback(() => setOpenPanel(null), [setOpenPanel])
  const shown = useAppStore(state => state.showMeshWireframe || state.showBvhWireframe)

  let popover: React.ReactNode = null
  if (open) {
    popover = (
      <Popover
        title="Wireframe debugging"
        icon={wireframeIcon}
        className={`${popoverAbove} short:w-[min(40rem,calc(100vw-1.5rem))]`}
        onClose={close}
      >
        <WireframeSettings />
      </Popover>
    )
  }

  return (
    <div>
      <button
        type="button"
        data-popover-toggle // tells the popover that a press on this button is not an outside click
        aria-expanded={open}
        aria-label={shown ? 'Wireframe, on' : 'Wireframe'}
        title="Wireframe debugging"
        className={`${roundButton} ${shown ? 'ring-2 ring-(--accent)' : ''}`}
        onClick={() => setOpenPanel(open ? null : 'wireframe')}
      >
        <Icon strokeWidth={1.6}>{wireframeIcon}</Icon>
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

      {/* One row at the bottom right. The settings card stays clear of it, and it sits above the card, so a popover
          that opens over the card stays in front of it. */}
      <div className={`absolute z-20 flex gap-2 ${bottomEdge} ${rightEdge}`}>
        <WireframeButton />
        <ScreenshotButton />
        <ThemeButton />
        <AboutButton />
      </div>
    </>
  )
}
