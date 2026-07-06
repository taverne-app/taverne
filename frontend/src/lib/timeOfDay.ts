export const TIME_OF_DAY = ['none', 'dawn', 'morning', 'noon', 'afternoon', 'dusk', 'night', 'midnight'] as const
export type TimeOfDay = typeof TIME_OF_DAY[number]

export interface TimeOfDayConfig {
  label: string
  emoji: string
  // Pre-blended with stone-950 (rgb 12 10 9) for direct background-color application
  bgColor: string
}

export const TIME_OF_DAY_CONFIG: Record<TimeOfDay, TimeOfDayConfig> = {
  none:      { label: 'Aucun',      emoji: '—',   bgColor: 'rgb(12,10,9)'  },
  dawn:      { label: 'Aube',       emoji: '🌅',  bgColor: 'rgb(71,36,12)' },
  morning:   { label: 'Matin',      emoji: '🌤',  bgColor: 'rgb(55,43,14)' },
  noon:      { label: 'Midi',       emoji: '☀️',  bgColor: 'rgb(36,34,28)' },
  afternoon: { label: 'Après-midi', emoji: '🌤',  bgColor: 'rgb(63,43,9)'  },
  dusk:      { label: 'Crépuscule', emoji: '🌇',  bgColor: 'rgb(76,25,9)'  },
  night:     { label: 'Nuit',       emoji: '🌙',  bgColor: 'rgb(14,21,48)' },
  midnight:  { label: 'Minuit',     emoji: '🌑',  bgColor: 'rgb(7,6,17)'   },
}
