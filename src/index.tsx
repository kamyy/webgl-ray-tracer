import Forms from '@/components/forms'
import { Progress } from '@/components/progress'
import { Viewport } from '@/components/viewport'
import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <main className="m-auto w-[1280px]">
      <Viewport />
      <Progress />
      <Forms />
    </main>
  </React.StrictMode>,
)
