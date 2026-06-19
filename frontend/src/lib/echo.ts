import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

export const REVERB_CONFIGURED = !!import.meta.env.VITE_REVERB_APP_KEY

const reverbBase = {
  broadcaster: 'reverb' as const,
  key: import.meta.env.VITE_REVERB_APP_KEY as string,
  wsHost: import.meta.env.VITE_REVERB_HOST as string,
  wsPort: Number(import.meta.env.VITE_REVERB_PORT ?? 8080),
  wssPort: Number(import.meta.env.VITE_REVERB_PORT ?? 8080),
  forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'http') === 'https',
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
