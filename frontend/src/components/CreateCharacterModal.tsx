import { useState, type FormEvent } from 'react'
import { createCharacter, type CreateCharacterPayload } from '../api/characters'
import { ApiError } from '../api/client'

interface Props {
  onCreated: () => void
  onClose: () => void
}

const RACES = [
  'Humain', 'Elfe', 'Nain', 'Halfelin', 'Gnome', 'Demi-Elfe',
  'Demi-Orc', 'Tiefelin', 'Dragonnet', 'Aasimar',
]

const CLASSES = [
  'Barbare', 'Barde', 'Clerc', 'Druide', 'Guerrier', 'Moine',
  'Paladin', 'Rôdeur', 'Roublard', 'Ensorceleur', 'Occultiste', 'Magicien',
]

export function CreateCharacterModal({ onCreated, onClose }: Props) {
  const [form, setForm] = useState<CreateCharacterPayload>({
    name: '',
    race: '',
    character_class: '',
    max_hp: 10,
    armor_class: 10,
    level: 1,
  })
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(false)

  function set<K extends keyof CreateCharacterPayload>(key: K, value: CreateCharacterPayload[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErrors({})
    setLoading(true)
    try {
      await createCharacter(form)
      onCreated()
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setErrors((err.data.errors as Record<string, string[]>) ?? {})
      }
    } finally {
      setLoading(false)
    }
  }

  const fieldError = (field: string) =>
    errors[field]?.[0] ? (
      <p className="text-red-400 text-xs mt-1">{errors[field][0]}</p>
    ) : null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-stone-900 border border-stone-700 rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800">
          <h2 className="text-white font-semibold">Nouveau personnage</h2>
          <button
            onClick={onClose}
            className="text-stone-500 hover:text-stone-300 transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-stone-300 text-sm font-medium mb-1.5">Nom *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              required
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
            />
            {fieldError('name')}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-stone-300 text-sm font-medium mb-1.5">Race *</label>
              <select
                value={form.race}
                onChange={e => set('race', e.target.value)}
                required
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
              >
                <option value="">Choisir…</option>
                {RACES.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              {fieldError('race')}
            </div>

            <div>
              <label className="block text-stone-300 text-sm font-medium mb-1.5">Classe *</label>
              <select
                value={form.character_class}
                onChange={e => set('character_class', e.target.value)}
                required
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
              >
                <option value="">Choisir…</option>
                {CLASSES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {fieldError('character_class')}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-stone-300 text-sm font-medium mb-1.5">Niveau</label>
              <input
                type="number"
                min={1}
                max={20}
                value={form.level}
                onChange={e => set('level', Number(e.target.value))}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-stone-300 text-sm font-medium mb-1.5">PV max *</label>
              <input
                type="number"
                min={1}
                value={form.max_hp}
                onChange={e => set('max_hp', Number(e.target.value))}
                required
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
              {fieldError('max_hp')}
            </div>

            <div>
              <label className="block text-stone-300 text-sm font-medium mb-1.5">CA *</label>
              <input
                type="number"
                min={1}
                value={form.armor_class}
                onChange={e => set('armor_class', Number(e.target.value))}
                required
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
              {fieldError('armor_class')}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-stone-800 hover:bg-stone-700 text-stone-300 font-medium rounded-lg py-2.5 text-sm transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-950 font-semibold rounded-lg py-2.5 text-sm transition-colors"
            >
              {loading ? 'Création…' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
