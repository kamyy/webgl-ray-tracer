import { Sidebar } from '@/components/sidebar'
import { Viewport } from '@/components/viewport'
import { maxCanvasHt, maxCanvasWd } from '@/lib/webgl/renderLimits'
import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <main
      className="relative mx-auto h-dvh w-full md:max-h-(--max-canvas-ht) md:max-w-(--max-canvas-wd)"
      style={{ '--max-canvas-wd': `${maxCanvasWd}px`, '--max-canvas-ht': `${maxCanvasHt}px` } as React.CSSProperties}
    >
      <Viewport />
      <Sidebar />
    </main>
  </React.StrictMode>,
)
