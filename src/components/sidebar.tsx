/**
 * The floating panel over the ray-traced view, with the render settings and progress.
 *
 * The panel sits on top of the canvas instead of beside it, so opening or closing it never resizes the render. The
 * header always shows the pass counter and a progress bar. The rest collapses away, leaving a small pill. On a
 * desktop the panel is a column on the left, on a phone in landscape it is a narrower column, and on a phone in
 * portrait it is a sheet along the bottom.
 */
import classnames from 'classnames'
import { useState } from 'react'
import { useAppStore } from '../lib/store/appStore'
import { ControlsAndAbout } from './controlsAndAbout'
import { RenderingParams } from './renderingParams'
import { RenderingStatus } from './renderingStatus'

const panelClass =
  'absolute z-10 flex flex-col overflow-hidden rounded-2xl border border-gray-300 bg-white shadow-xl backdrop-blur-md supports-[backdrop-filter]:bg-white/90'
const expandedClass =
  'inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] h-[56%] landscape:max-lg:inset-x-auto landscape:max-lg:top-2 landscape:max-lg:left-[max(1.25rem,env(safe-area-inset-left))] landscape:max-lg:h-auto landscape:max-lg:w-[252px] lg:inset-x-auto lg:top-3 lg:left-3 lg:h-auto lg:w-[300px]'
const collapsedClass =
  'bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-2 landscape:max-lg:top-2 landscape:max-lg:bottom-auto landscape:max-lg:left-[max(1.25rem,env(safe-area-inset-left))] lg:top-3 lg:bottom-auto lg:left-3'
const sectionTitleClass = 'text-[0.9rem] font-bold'

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const renderingPass = useAppStore(state => state.renderingPass)
  const numSamples = useAppStore(state => state.numSamples)
  const proportion = Math.min(renderingPass / numSamples, 1) // 0.0 - 1.0

  let body: React.ReactNode = null
  if (!collapsed) {
    body = (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <section className="px-4 pb-3.5">
          <h2 className={sectionTitleClass}>Status</h2>
          <RenderingStatus />
        </section>
        <section className="border-t border-gray-300 px-4 pb-3.5">
          <h2 className={classnames(sectionTitleClass, 'pt-3')}>Rendering</h2>
          <RenderingParams />
        </section>
        <ControlsAndAbout />
      </div>
    )
  }

  return (
    <aside className={classnames(panelClass, collapsed ? collapsedClass : expandedClass)} aria-label="Render settings">
      <div className="flex min-h-13 flex-none items-center gap-2.5 pr-1.5 pl-4">
        <span className="h-4.5 w-4.5 rounded-full bg-[darkgreen]" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate font-bold">Ray Tracer</span>
        <span className="flex-none text-[0.9rem] tabular-nums">
          {renderingPass} / {numSamples}
        </span>
        <div className="h-1.5 w-12 flex-none overflow-hidden rounded-full bg-green-100">
          <div className="h-full bg-[darkgreen]" style={{ width: `${proportion * 100}%` }} />
        </div>
        <button
          type="button"
          className="grid min-h-11 min-w-11 place-items-center rounded-lg hover:bg-gray-100"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
          onClick={() => setCollapsed(!collapsed)}
        >
          <svg
            className={classnames('h-5 w-5', { 'rotate-180': collapsed })}
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
      </div>
      {body}
    </aside>
  )
}
