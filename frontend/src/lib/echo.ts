import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

// Le temps réel passe par Laravel Reverb (WebSocket auto-hébergé, service
// « reverb » du docker-compose). Le broadcaster « reverb » de laravel-echo
// s'appuie sur le protocole Pusher sans exiger de « cluster » — pas de
// dépendance ni de clé externe.
export const REALTIME_CONFIGURED = !!import.meta.env.VITE_REVERB_APP_KEY

const reverbBase = {
  broadcaster: 'reverb' as const,
  key: import.meta.env.VITE_REVERB_APP_KEY as string,
  wsHost: (import.meta.env.VITE_REVERB_HOST as string) || 'localhost',
  wsPort: Number(import.meta.env.VITE_REVERB_PORT ?? 8080),
  wssPort: Number(import.meta.env.VITE_REVERB_PORT ?? 8080),
  forceTLS: ((import.meta.env.VITE_REVERB_SCHEME as string) ?? 'http') === 'https',
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
