/**
 * Light or dark color theme, remembered between visits.
 *
 * The first visit follows the operating system's setting. After the user switches, the choice is saved in
 * `localStorage` and wins. The theme is applied as a `dark` class on the `<html>` element, which turns on Tailwind's
 * `dark:` variants and the color variables in `src/styles/globals.css`.
 */
import { useEffect, useState } from 'react'

// The `localStorage` key that holds the saved choice.
const storageKey = 'theme'

type Theme = 'light' | 'dark'

// The saved choice if there is one, otherwise the operating system's setting. A browser that blocks site storage
// throws when `localStorage` is touched, so that case falls back to the operating system's setting too.
function getInitialTheme(): Theme {
  let saved: string | null = null
  try {
    saved = localStorage.getItem(storageKey)
  } catch {
    // Storage is blocked, so there is no saved choice.
  }

  if (saved === 'light' || saved === 'dark') {
    return saved
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  // Mirror the theme into the `dark` class that the styles key off.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  // Switches theme and saves the choice, so the next visit starts in it.
  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    try {
      localStorage.setItem(storageKey, next)
    } catch {
      // Storage is blocked, so the choice lasts until the page closes.
    }
    setTheme(next)
  }

  return { theme, toggleTheme }
}
