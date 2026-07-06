export const TIME_OF_DAY = ['none', 'dawn', 'morning', 'noon', 'afternoon', 'dusk', 'night', 'midnight'] as const
export type TimeOfDay = typeof TIME_OF_DAY[number]

export interface TimeOfDayConfig {
  label: string
  emoji: string
  overlay: string | null
}

export const TIME_OF_DAY_CONFIG: Record<TimeOfDay, TimeOfDayConfig> = {
  none:      { label: 'Aucun',      emoji: '—',   overlay: null                      },
  dawn:      { label: 'Aube',       emoji: '🌅',  overlay: 'rgba(249,115,22,0.25)'   },
  morning:   { label: 'Matin',      emoji: '🌤',  overlay: 'rgba(251,191,36,0.18)'   },
  noon:      { label: 'Midi',       emoji: '☀️',  overlay: 'rgba(255,248,200,0.10)'  },
  afternoon: { label: 'Après-midi', emoji: '🌤',  overlay: 'rgba(245,158,11,0.22)'   },
  dusk:      { label: 'Crépuscule', emoji: '🌇',  overlay: 'rgba(180,50,10,0.38)'    },
  night:     { label: 'Nuit',       emoji: '🌙',  overlay: 'rgba(15,30,80,0.55)'     },
  midnight:  { label: 'Minuit',     emoji: '🌑',  overlay: 'rgba(5,5,20,0.75)'       },
}
