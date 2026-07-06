export const TIME_OF_DAY = ['none', 'dawn', 'morning', 'noon', 'afternoon', 'dusk', 'night', 'midnight'] as const
export type TimeOfDay = typeof TIME_OF_DAY[number]

export interface TimeOfDayConfig {
  label: string
  emoji: string
  // Background color applied to the parchment card itself
  parchmentColor: string
}

export const TIME_OF_DAY_CONFIG: Record<TimeOfDay, TimeOfDayConfig> = {
  none:      { label: 'Aucun',      emoji: '—',   parchmentColor: '#fefefe' },
  dawn:      { label: 'Aube',       emoji: '🌅',  parchmentColor: '#fdf2e4' },
  morning:   { label: 'Matin',      emoji: '🌤',  parchmentColor: '#fdfce8' },
  noon:      { label: 'Midi',       emoji: '☀️',  parchmentColor: '#fefef5' },
  afternoon: { label: 'Après-midi', emoji: '🌤',  parchmentColor: '#fdf5e4' },
  dusk:      { label: 'Crépuscule', emoji: '🌇',  parchmentColor: '#fdeae4' },
  night:     { label: 'Nuit',       emoji: '🌙',  parchmentColor: '#eef0fd' },
  midnight:  { label: 'Minuit',     emoji: '🌑',  parchmentColor: '#e8eafc' },
}
