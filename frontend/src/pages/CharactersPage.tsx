import { useCallback, useEffect, useState } from 'react'
import { listCharacters, deleteCharacter, type Character } from '../api/characters'
import { Link, useNavigate } from 'react-router-dom'
import { useCampaigns } from '../contexts/CampaignContext'
import { CreateCharacterModal } from '../components/CreateCharacterModal'
import { canLevelUp } from '../data/xp'
import { PartyStats } from '../components/PartyStats'

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
        <div className="flex items-center gap-1.5">
          {canLevelUp(character.level, character.experience_points) && (
            <span className="text-xs bg-amber-500/20 border border-amber-500/50 text-amber-400 rounded px-1.5 py-0.5 font-semibold animate-pulse">
              ↑ Niv.
            </span>
          )}
          <span className="text-amber-400 text-sm font-semibold bg-stone-800 rounded-lg px-2 py-0.5">
            Niv.&nbsp;{character.level}
          </span>
        </div>
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
  const { current, loading: campaignLoading } = useCampaigns()
  const navigate = useNavigate()
  const [characters, setCharacters] = useState<Character[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')

  const campaignId = current?.id

  const load = useCallback(async () => {
    if (!campaignId) return
    setLoading(true)
    try {
      setCharacters(await listCharacters(campaignId))
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  useEffect(() => { load() }, [load])

  // Un personnage vit dans une campagne : sans campagne courante, on renvoie à la liste.
  useEffect(() => {
    if (!campaignLoading && !campaignId) navigate('/campaigns?all=1', { replace: true })
  }, [campaignLoading, campaignId, navigate])

  async function handleDelete(id: number) {
    await deleteCharacter(id)
    setCharacters(cs => cs.filter(c => c.id !== id))
  }

  return (
    <div className="min-h-screen bg-stone-950">
      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-white text-xl font-display font-semibold tracking-wide">Personnages</h1>
            <p className="text-stone-500 text-sm mt-0.5">
              {characters.length} personnage{characters.length !== 1 ? 's' : ''}
              {current && <> · {current.name}</>}
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

        {characters.length > 4 && (
          <input
            type="text"
            placeholder="Rechercher par nom, race ou classe…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full mb-4 bg-stone-900 border border-stone-800 rounded-lg px-4 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
          />
        )}

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
            {characters
              .filter(c => {
                if (!search.trim()) return true
                const q = search.toLowerCase()
                return (
                  c.name.toLowerCase().includes(q) ||
                  c.race.toLowerCase().includes(q) ||
                  c.character_class.toLowerCase().includes(q)
                )
              })
              .map(c => (
                <CharacterCard key={c.id} character={c} onDelete={handleDelete} />
              ))}
          </div>
        )}

        {/* Les stats du groupe ne parlent que des personnages : leur place est ici. */}
        {characters.length > 0 && (
          <div className="mt-8">
            <PartyStats characters={characters} />
          </div>
        )}
      </main>

      {showCreate && campaignId && (
        <CreateCharacterModal
          campaignId={campaignId}
          onCreated={() => { setShowCreate(false); load() }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}
