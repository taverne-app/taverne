import { useCallback, useEffect, useState } from 'react'

export type Theme = 'A' | 'B'
export type ThemeChoice = 'dark' | 'light' | 'system'

const STORAGE_KEY = 'shared-theme'
const EVENT = 'shared-theme-change'

export function resolveTheme(choice: ThemeChoice): Theme {
  if (choice === 'dark') return 'A'
  if (choice === 'light') return 'B'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'A' : 'B'
}

function readChoice(): ThemeChoice {
  return (localStorage.getItem(STORAGE_KEY) as ThemeChoice) ?? 'system'
}

/**
 * Theme preference for the public (shared) pages. Persisted in localStorage and
 * synced across independently-mounted components (page + sidebar) through a
 * custom window event, so the sidebar's settings and the character sheet stay
 * in lockstep without a shared React provider.
 */
export function useSharedTheme() {
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>(readChoice)
  const [theme, setTheme] = useState<Theme>(() => resolveTheme(readChoice()))

  // React to changes made by another component in the same tab.
  useEffect(() => {
    const handler = () => {
      const c = readChoice()
      setThemeChoice(c)
      setTheme(resolveTheme(c))
    }
    window.addEventListener(EVENT, handler)
    return () => window.removeEventListener(EVENT, handler)
  }, [])

  // Follow the OS preference while on "system".
  useEffect(() => {
    if (themeChoice !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const h = (e: MediaQueryListEvent) => setTheme(e.matches ? 'A' : 'B')
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [themeChoice])

  const chooseTheme = useCallback((choice: ThemeChoice) => {
    localStorage.setItem(STORAGE_KEY, choice)
    setThemeChoice(choice)
    setTheme(resolveTheme(choice))
    window.dispatchEvent(new Event(EVENT))
  }, [])

  return { theme, themeChoice, chooseTheme }
}
