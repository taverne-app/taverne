export const TIME_OF_DAY = ['none', 'dawn', 'morning', 'noon', 'afternoon', 'dusk', 'night', 'midnight'] as const
export type TimeOfDay = typeof TIME_OF_DAY[number]

export interface TimeOfDayConfig {
  label: string
  emoji: string
  overlay: string | null
  isDark: boolean
}

export const TIME_OF_DAY_CONFIG: Record<TimeOfDay, TimeOfDayConfig> = {
  none:      { label: 'Aucun',      emoji: '—',   overlay: null,                      isDark: false },
  dawn:      { label: 'Aube',       emoji: '🌅',  overlay: 'rgba(249,115,22,0.25)',   isDark: false },
  morning:   { label: 'Matin',      emoji: '🌤',  overlay: 'rgba(251,191,36,0.18)',   isDark: false },
  noon:      { label: 'Midi',       emoji: '☀️',  overlay: 'rgba(255,248,200,0.10)',  isDark: false },
  afternoon: { label: 'Après-midi', emoji: '🌤',  overlay: 'rgba(245,158,11,0.22)',   isDark: false },
  dusk:      { label: 'Crépuscule', emoji: '🌇',  overlay: 'rgba(180,50,10,0.38)',    isDark: true  },
  night:     { label: 'Nuit',       emoji: '🌙',  overlay: 'rgba(15,30,80,0.55)',     isDark: true  },
  midnight:  { label: 'Minuit',     emoji: '🌑',  overlay: 'rgba(5,5,20,0.75)',       isDark: true  },
}
