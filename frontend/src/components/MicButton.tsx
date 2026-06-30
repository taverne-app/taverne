import { useEffect, useRef, useState } from 'react'

interface Props {
  onTranscript: (text: string) => void
  className?: string
}

interface SpeechWindow {
  SpeechRecognition?: new () => SpeechRecognition
  webkitSpeechRecognition?: new () => SpeechRecognition
}

function getSpeechRecognition(): (new () => SpeechRecognition) | undefined {
  if (typeof window === 'undefined') return undefined
  const sw = window as unknown as SpeechWindow
  return sw.SpeechRecognition ?? sw.webkitSpeechRecognition
}

export function MicButton({ onTranscript, className = '' }: Props) {
  const [listening, setListening] = useState(false)
  const recRef = useRef<SpeechRecognition | null>(null)

  useEffect(() => () => { recRef.current?.stop() }, [])

  if (!getSpeechRecognition()) return null

  function toggle() {
    if (listening) {
      recRef.current?.stop()
      setListening(false)
      return
    }
    const SR = getSpeechRecognition()
    if (!SR) return
    const rec = new SR()
    rec.lang = 'fr-FR'
    rec.continuous = true
    rec.interimResults = false
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = Array.from(e.results)
        .slice(e.resultIndex)
        .filter(r => r.isFinal)
        .map(r => r[0].transcript)
        .join(' ')
      if (transcript.trim()) onTranscript(transcript.trim())
    }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    rec.start()
    recRef.current = rec
    setListening(true)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={listening ? 'Arrêter la dictée' : 'Dicter'}
      className={`px-2 py-1 rounded-lg border text-xs transition-colors ${
        listening
          ? 'bg-red-900/50 border-red-600/60 text-red-300 animate-pulse'
          : 'bg-stone-800 border-stone-700 text-stone-500 hover:text-stone-300 hover:border-stone-500'
      } ${className}`}
    >
      🎤
    </button>
  )
}
