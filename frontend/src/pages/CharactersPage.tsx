import { useEffect, useState } from 'react'
import { listCharacters, deleteCharacter, type Character } from '../api/characters'
import { logout } from '../api/auth'
import { useAuth } from '../contexts/AuthContext'
import { Link, useNavigate } from 'react-router-dom'
import { CreateCharacterModal } from '../components/CreateCharacterModal'

function HpBar({ current, max }: { current: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100))
  const color =
    pct > 50 ? 'bg-emerald-500' : pct > 25 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-stone-400 mb-1">
        <span>PV</span>
        <span>
          {current} / {max}
        </span>
      </div>
      <div className="h-1.5 bg-stone-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function CharacterCard({
  character,
  onDelete,
}: {
  character: Character
  onDelete: (id: number) => void
}) {
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 hover:border-amber-700/50 transition-colors group relative">
      <Link to={`/characters/${character.id}`} className="absolute inset-0 rounded-xl" />
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-white font-semibold text-base leading-tight">{character.name}</h3>
          <p className="text-stone-400 text-xs mt-0.5">
            {character.race} · {character.character_class}
          </p>
        </div>
        <span className="text-amber-400 text-sm font-semibold bg-stone-800 rounded-lg px-2 py-0.5">
          Niv.&nbsp;{character.level}
        </span>
      </div>

      <div className="mt-3 flex gap-3 text-center">
        <div className="flex-1 bg-stone-800 rounded-lg py-2">
          <p className="text-stone-400 text-xs">CA</p>
          <p className="text-white font-bold text-lg leading-tight">{character.combat.armor_class}</p>
        </div>
        <div className="flex-1 bg-stone-800 rounded-lg py-2">
          <p className="text-stone-400 text-xs">Init.</p>
          <p className="text-white font-bold text-lg leading-tight">
            {character.combat.initiative >= 0 ? '+' : ''}{character.combat.initiative}
          </p>
        </div>
        <div className="flex-1 bg-stone-800 rounded-lg py-2">
          <p className="text-stone-400 text-xs">Maît.</p>
          <p className="text-white font-bold text-lg leading-tight">
            +{character.proficiency_bonus}
          </p>
        </div>
      </div>

      <HpBar current={character.combat.current_hp} max={character.combat.max_hp} />

      {character.state.conditions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {character.state.conditions.map(c => (
            <span
              key={c}
              className="text-xs bg-purple-900/50 border border-purple-700 text-purple-300 rounded px-1.5 py-0.5 capitalize"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-stone-800 flex justify-end relative z-10">
        {confirming ? (
          <div className="flex gap-2 text-xs">
            <button
              onClick={() => setConfirming(false)}
              className="text-stone-400 hover:text-stone-200 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={() => onDelete(character.id)}
              className="text-red-400 hover:text-red-300 font-medium transition-colors"
            >
              Confirmer la suppression
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="text-stone-600 hover:text-red-400 text-xs transition-colors opacity-0 group-hover:opacity-100"
          >
            Supprimer
          </button>
        )}
      </div>
    </div>
  )
}

export function CharactersPage() {
  const { user, clearAuth } = useAuth()
  const navigate = useNavigate()

  const [characters, setCharacters] = useState<Character[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  async function load() {
    setLoading(true)
    try {
      setCharacters(await listCharacters())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleDelete(id: number) {
    await deleteCharacter(id)
    setCharacters(cs => cs.filter(c => c.id !== id))
  }

  async function handleLogout() {
    try { await logout() } catch { /* ignore */ }
    clearAuth()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-stone-950">
      {/* Header */}
      <header className="border-b border-stone-800 bg-stone-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="text-amber-400 font-bold text-lg">🍺 Taverne</span>
          <div className="flex items-center gap-4">
            <Link
              to="/combat"
              className="text-stone-400 hover:text-amber-400 text-sm transition-colors font-medium"
            >
              ⚔ Combat
            </Link>
            <span className="text-stone-400 text-sm hidden sm:block">{user?.name}</span>
            <button
              onClick={handleLogout}
              className="text-stone-400 hover:text-stone-200 text-sm transition-colors"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-white text-xl font-semibold">Mes personnages</h1>
            <p className="text-stone-500 text-sm mt-0.5">
              {characters.length} personnage{characters.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-sm rounded-lg px-4 py-2 transition-colors flex items-center gap-1.5"
          >
            <span className="text-lg leading-none">+</span>
            Nouveau
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : characters.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-stone-500 text-4xl mb-4">⚔️</p>
            <p className="text-stone-400 font-medium">Aucun personnage pour l'instant</p>
            <p className="text-stone-600 text-sm mt-1">
              Créez votre premier aventurier pour commencer.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {characters.map(c => (
              <CharacterCard key={c.id} character={c} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </main>

      {showCreate && (
        <CreateCharacterModal
          onCreated={() => { setShowCreate(false); load() }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}
