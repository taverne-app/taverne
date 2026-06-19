import { useEffect, useRef } from 'react'

// Manages document.title: steady updates + blinking when tab is hidden.
export function useTabNotify() {
  const blinkInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const baseTitle = useRef(document.title)

  function stopBlink() {
    if (blinkInterval.current) {
      clearInterval(blinkInterval.current)
      blinkInterval.current = null
    }
  }

  // Set a stable title (no blink).
  function setTitle(title: string) {
    stopBlink()
    baseTitle.current = title
    document.title = title
  }

  // Flash title when tab is hidden; stop when it becomes visible again.
  function notify(flashMessage: string) {
    stopBlink()
    if (!document.hidden) {
      document.title = flashMessage
      baseTitle.current = flashMessage
      return
    }
    let toggle = true
    blinkInterval.current = setInterval(() => {
      document.title = toggle ? flashMessage : baseTitle.current
      toggle = !toggle
    }, 800)

    const onVisible = () => {
      if (!document.hidden) {
        stopBlink()
        document.title = baseTitle.current
        document.removeEventListener('visibilitychange', onVisible)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
  }

  useEffect(() => () => stopBlink(), [])

  return { setTitle, notify }
}
