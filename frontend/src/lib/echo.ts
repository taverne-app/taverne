import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

export const REALTIME_CONFIGURED = !!import.meta.env.VITE_ABLY_KEY

// Ably exposes a Pusher-compatible endpoint — no extra npm package needed.
// Key format: the full Ably key "appId.keyId:secret" — only the public part
// (before ":") goes in VITE_ABLY_KEY; the full key stays server-side.
const ablyBase = {
  broadcaster: 'pusher' as const,
  key: import.meta.env.VITE_ABLY_KEY as string,
  wsHost: 'realtime-pusher.ably.io',
  wsPort: 443,
  wssPort: 443,
  forceTLS: true,
  disableStats: true,
  enabledTransports: ['ws', 'wss'] as ['ws', 'wss'],
  Pusher,
}

export function createEcho(token: string): Echo<'pusher'> {
  return new Echo<'pusher'>({
    ...ablyBase,
    authEndpoint: '/api/broadcasting/auth',
    auth: {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    },
  })
}

export function createPublicEcho(): Echo<'pusher'> {
  return new Echo<'pusher'>(ablyBase)
}
