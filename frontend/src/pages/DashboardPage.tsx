import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listCampaigns, type Campaign } from '../api/campaigns'
import { listCharacters, type Character } from '../api/characters'
import { logout } from '../api/auth'
import { useAuth } from '../contexts/AuthContext'
import { CreateCharacterModal } from '../components/CreateCharacterModal'

function hpColor(current: number, max: number) {
  const pct = max > 0 ? current / max : 0
  if (pct > 0.5) return 'bg-emerald-500'
  if (pct > 0.25) return 'bg-amber-500'
  return 'bg-red-500'
}

function CharacterMini({ c }: { c: Character }) {
  const hpPct = Math.max(0, Math.min(100, (c.combat.current_hp / c.combat.max_hp) * 100))
  const isDying = c.combat.current_hp <= 0
  return (
    <Link
      to={`/characters/${c.id}`}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-stone-800/60 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isDying ? 'text-red-400' : 'text-white'}`}>{c.name}</p>
        <p className="text-stone-500 text-xs truncate">{c.character_class} · Niv.{c.level}</p>
        <div className="mt-1.5 h-1.5 bg-stone-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${hpColor(c.combat.current_hp, c.combat.max_hp)}`}
            style={{ width: `${hpPct}%` }}
          />
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-bold tabular-nums ${isDying ? 'text-red-400' : 'text-stone-300'}`}>
          {c.combat.current_hp}
        </p>
        <p className="text-stone-600 text-xs">/{c.combat.max_hp}</p>
      </div>
    </Link>
  )
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const characters = campaign.characters ?? []
  const dying = characters.filter(c => c.combat.current_hp <= 0)

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden hover:border-amber-700/40 transition-colors">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-stone-800">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              to={`/campaigns/${campaign.id}`}
              className="text-white font-semibold hover:text-amber-300 transition-colors truncate block"
            >
              {campaign.name}
            </Link>
            {campaign.description && (
              <p className="text-stone-500 text-xs mt-0.5 truncate">{campaign.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {dying.length > 0 && (
              <span className="text-xs bg-red-900/50 border border-red-700/50 text-red-400 rounded px-1.5 py-0.5">
                {dying.length} à terre
              </span>
            )}
            <Link
              to={`/combat?campaign=${campaign.id}`}
              className="text-xs bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg px-3 py-1.5 transition-colors"
            >
              ⚔ Combat
            </Link>
          </div>
        </div>
      </div>

      {/* Characters */}
      {characters.length === 0 ? (
        <div className="px-5 py-4 text-stone-600 text-sm">
          Aucun personnage dans cette campagne.
        </div>
      ) : (
        <div className="px-2 py-2">
          {characters.map(c => (
            <CharacterMini key={c.id} c={c} />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="px-5 py-2.5 border-t border-stone-800 flex items-center justify-between">
        <span className="text-stone-600 text-xs">
          {characters.length} personnage{characters.length !== 1 ? 's' : ''}
        </span>
        <Link
          to={`/campaigns/${campaign.id}`}
          className="text-stone-500 hover:text-amber-400 text-xs transition-colors"
        >
          Gérer la campagne →
        </Link>
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { user, clearAuth } = useAuth()
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [characters, setCharacters] = useState<Character[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    Promise.all([listCampaigns(), listCharacters()])
      .then(([cgs, chars]) => {
        setCampaigns(cgs)
        setCharacters(chars)
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleLogout() {
    try { await logout() } catch { /* ignore */ }
    clearAuth()
    navigate('/login')
  }

  // Characters not in any campaign
  const standalone = characters.filter(c => !c.campaign_id)
  // Any dying characters
  const dying = characters.filter(c => c.combat.current_hp <= 0)

  return (
    <div className="min-h-screen bg-stone-950">
      {/* Header */}
      <header className="border-b border-stone-800 bg-stone-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="text-amber-400 font-bold text-lg">🍺 Taverne</span>
          <div className="flex items-center gap-4">
            <Link to="/campaigns" className="text-stone-400 hover:text-amber-400 text-sm transition-colors font-medium">
              🗺 Campagnes
            </Link>
            <Link to="/characters" className="text-stone-400 hover:text-amber-400 text-sm transition-colors font-medium">
              Personnages
            </Link>
            <Link to="/combat" className="text-stone-400 hover:text-amber-400 text-sm transition-colors font-medium">
              ⚔ Combat
            </Link>
            <span className="text-stone-400 text-sm hidden sm:block">{user?.name}</span>
            <button onClick={handleLogout} className="text-stone-400 hover:text-stone-200 text-sm transition-colors">
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* Hero */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white text-2xl font-bold">
              Bienvenue, {user?.name?.split(' ')[0]} !
            </h1>
            <p className="text-stone-500 text-sm mt-1">
              {campaigns.length} campagne{campaigns.length !== 1 ? 's' : ''}
              {' · '}
              {characters.length} personnage{characters.length !== 1 ? 's' : ''}
              {dying.length > 0 && (
                <span className="text-red-400 ml-2">
                  · {dying.length} à terre
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-sm rounded-lg px-4 py-2 transition-colors flex items-center gap-1.5"
          >
            <span className="text-lg leading-none">+</span>
            Personnage
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : campaigns.length === 0 && characters.length === 0 ? (
          /* Empty state */
          <div className="text-center py-20 bg-stone-900 border border-stone-800 rounded-xl">
            <p className="text-5xl mb-4">🍺</p>
            <p className="text-white font-semibold text-lg">Bienvenue dans Taverne</p>
            <p className="text-stone-500 text-sm mt-2 mb-6">
              Créez votre premier personnage ou commencez une campagne.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowCreate(true)}
                className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-sm rounded-lg px-5 py-2.5 transition-colors"
              >
                Créer un personnage
              </button>
              <Link
                to="/campaigns"
                className="bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-sm rounded-lg px-5 py-2.5 transition-colors"
              >
                Gérer les campagnes
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Campaigns */}
            {campaigns.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-stone-300 font-semibold">Campagnes actives</h2>
                  <Link to="/campaigns" className="text-stone-500 hover:text-amber-400 text-sm transition-colors">
                    Toutes les campagnes →
                  </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {campaigns.map(c => (
                    <CampaignCard key={c.id} campaign={c} />
                  ))}
                </div>
              </section>
            )}

            {/* Standalone characters (not in any campaign) */}
            {standalone.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-stone-300 font-semibold">Personnages sans campagne</h2>
                  <Link to="/characters" className="text-stone-500 hover:text-amber-400 text-sm transition-colors">
                    Tous les personnages →
                  </Link>
                </div>
                <div className="bg-stone-900 border border-stone-800 rounded-xl px-2 py-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5">
                    {standalone.map(c => (
                      <CharacterMini key={c.id} c={c} />
                    ))}
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {showCreate && (
        <CreateCharacterModal
          onCreated={() => {
            setShowCreate(false)
            Promise.all([listCampaigns(), listCharacters()])
              .then(([cgs, chars]) => { setCampaigns(cgs); setCharacters(chars) })
          }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}
