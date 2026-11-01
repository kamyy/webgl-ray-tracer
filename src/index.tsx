/**
 * The app's entry point: mounts the render view with the floating controls over it.
 *
 * `main` fills the window and is capped at the largest render size from `src/lib/webgl/renderLimits.ts`. The cap is
 * passed as CSS variables, which Tailwind classes read. The progress display and the settings card are positioned over
 * the view, so neither takes room from it.
 */
import { Hud } from '@/components/hud'
import { SettingsPanel } from '@/components/settingsPanel'
import { Viewport } from '@/components/viewport'
import { maxCanvasHt, maxCanvasWd } from '@/lib/webgl/renderLimits'
import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Centers `main` when the window is larger than the cap. */}
    <div className="flex h-dvh items-center justify-center">
      <main
        className="relative size-full md:max-h-(--max-canvas-ht) md:max-w-(--max-canvas-wd)"
        style={{ '--max-canvas-wd': `${maxCanvasWd}px`, '--max-canvas-ht': `${maxCanvasHt}px` } as React.CSSProperties}
      >
        {/* The render fills `main`. The two floating layers sit over it. */}
        <Viewport />
        <Hud />
        <SettingsPanel />
      </main>
    </div>
  </React.StrictMode>,
)
