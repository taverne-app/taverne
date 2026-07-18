import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Dictée vocale, via l'API Web Speech du navigateur.
 *
 * TROIS LIMITES QU'AUCUN CODE D'ICI NE PEUT LEVER — à connaître avant d'y toucher :
 *
 * 1. Contexte sécurisé obligatoire. Rien ne fonctionne en `http://`, sauf sur
 *    localhost. Une Taverne auto-hébergée servie en http nu n'aura pas le bouton.
 * 2. Firefox n'implémente pas l'API (Chrome, Edge et Safari oui). D'où la détection
 *    de capacité : on cache le bouton plutôt que d'afficher une erreur au clic.
 * 3. Chrome envoie l'audio à des serveurs Google pour le transcrire. Ce n'est donc
 *    PAS de la reconnaissance locale : contrairement au reste de Taverne, ce qui est
 *    dicté sort de la machine. C'est dit à l'utilisateur dans l'infobulle du bouton.
 */

interface RecognitionAlternative { transcript: string }
interface RecognitionResult { isFinal: boolean; 0: RecognitionAlternative }
interface RecognitionEvent {
  resultIndex: number
  results: { length: number; [index: number]: RecognitionResult }
}
interface RecognitionErrorEvent { error: string }

interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: RecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

type RecognitionCtor = new () => Recognition

function ctor(): RecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor
    webkitSpeechRecognition?: RecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** Vrai si le navigateur sait dicter ici. Faux en http nu et sur Firefox. */
export const DICTATION_SUPPORTED = typeof window !== 'undefined' && !!ctor()

const ERRORS: Record<string, string> = {
  'not-allowed': 'Micro refusé. Autorisez-le dans les réglages du navigateur.',
  'service-not-allowed': 'Micro refusé. Autorisez-le dans les réglages du navigateur.',
  'no-speech': 'Rien entendu.',
  'audio-capture': 'Aucun micro détecté.',
  network: 'La reconnaissance vocale n’a pas pu joindre le réseau.',
}

/**
 * `onText` reçoit les phrases terminées, une par une, à ajouter au texte existant.
 * On ignore volontairement les résultats intermédiaires : ils sont réécrits au fil
 * de la phrase et les recoller produirait des doublons.
 */
export function useDictation(onText: (chunk: string) => void) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<Recognition | null>(null)

  // `onText` change à chaque rendu (closure sur le brouillon en cours). On le garde
  // dans une ref : recréer la reconnaissance à chaque frappe couperait la dictée.
  const onTextRef = useRef(onText)
  useEffect(() => { onTextRef.current = onText })

  const stop = useCallback(() => {
    recRef.current?.stop()
    setListening(false)
  }, [])

  const start = useCallback(() => {
    const Ctor = ctor()
    if (!Ctor) return
    setError(null)

    const rec = new Ctor()
    rec.lang = 'fr-FR'
    rec.continuous = true
    rec.interimResults = false

    rec.onresult = e => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) onTextRef.current(r[0].transcript.trim())
      }
    }
    rec.onerror = e => {
      // « Rien entendu » n'est pas une panne : le silence arrive, on continue.
      if (e.error === 'no-speech') return
      setError(ERRORS[e.error] ?? 'La dictée s’est interrompue.')
      setListening(false)
    }
    rec.onend = () => setListening(false)

    recRef.current = rec
    rec.start()
    setListening(true)
  }, [])

  const toggle = useCallback(() => {
    if (listening) stop()
    else start()
  }, [listening, start, stop])

  // Quitter la page en dictant laisserait le micro ouvert.
  useEffect(() => () => recRef.current?.abort(), [])

  return { supported: DICTATION_SUPPORTED, listening, error, toggle, stop }
}
