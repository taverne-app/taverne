import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

// Le temps réel passe par Laravel Reverb (WebSocket auto-hébergé, service
// « reverb » du docker-compose). Le broadcaster « reverb » de laravel-echo
// s'appuie sur le protocole Pusher sans exiger de « cluster » — pas de
// dépendance ni de clé externe.
export const REALTIME_CONFIGURED = !!import.meta.env.VITE_REVERB_APP_KEY

// Le WebSocket passe par la MÊME origine que la SPA : le reverse proxy en tête
// de chaîne (Funnel / Caddy → conteneur frontend) route /app vers Reverb. On
// dérive donc hôte, port et TLS de window.location, jamais d'une variable de
// build. Sinon un joueur distant hérite du wsHost figé à la compilation
// (« localhost:8080 ») : connexion impossible, et « mixed content » depuis une
// page HTTPS. Une seule origine côté navigateur — c'est tout le principe.
const loc = typeof window !== 'undefined' ? window.location : undefined
const isHttps = loc?.protocol === 'https:'
const originPort = loc?.port ? Number(loc.port) : isHttps ? 443 : 80

const reverbBase = {
  broadcaster: 'reverb' as const,
  key: import.meta.env.VITE_REVERB_APP_KEY as string,
  wsHost: loc?.hostname || 'localhost',
  wsPort: originPort,
  wssPort: originPort,
  forceTLS: isHttps,
  disableStats: true,
  enabledTransports: ['ws', 'wss'] as ['ws', 'wss'],
  Pusher,
}

export function createEcho(token: string): Echo<'reverb'> {
  return new Echo<'reverb'>({
    ...reverbBase,
    authEndpoint: '/api/broadcasting/auth',
    auth: {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    },
  })
}

export function createPublicEcho(): Echo<'reverb'> {
  return new Echo<'reverb'>(reverbBase)
}
