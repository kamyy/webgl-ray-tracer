import Canvas from '@/components/canvas'
import Forms from '@/components/forms'
import { Progress } from '@/components/progress'
import StoreProvider from '@/components/storeProvider'
import { defaultCanvasVars } from '@/types/canvasVars'
import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StoreProvider>
      <main
        style={{
          margin: 'auto',
          width: `${defaultCanvasVars.canvasWd}px`,
        }}
      >
        <Canvas />
        <Progress />
        <Forms />
      </main>
    </StoreProvider>
  </React.StrictMode>,
)
