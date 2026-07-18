import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getSharedCampaign } from '../api/share'
import type { Campaign, TreasureItem } from '../api/campaigns'
import { formatGold } from '../lib/gold'
import { MarkdownText } from '../components/MarkdownText'
import { FloatingDiceRoller } from '../components/FloatingDiceRoller'
import { RulesCompendium } from '../components/RulesCompendium'
import { SharedSidebar } from '../components/SharedSidebar'
import { PlayerNotes } from '../components/PlayerNotes'


export function SharedCampaignPage() {
  const { token } = useParams<{ token: string }>()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [npcSearch, setNpcSearch] = useState('')
  const [locationSearchShared, setLocationSearchShared] = useState('')
  const [treasurySearch, setTreasurySearch] = useState('')

  useEffect(() => {
    if (!token) return
    setLoading(true)
    getSharedCampaign(token)
      .then(c => {
        setCampaign(c)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [token])


  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !campaign) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-stone-400 text-5xl mb-4">🔒</p>
          <p className="text-white text-lg font-semibold">Lien invalide ou révoqué</p>
          <p className="text-stone-500 text-sm mt-1">Ce lien de partage n'existe plus ou a été désactivé.</p>
        </div>
      </div>
    )
  }

  return (
    <>
    <SharedSidebar campaignShareToken={token} />
    <div className="ml-14 min-h-screen bg-stone-950">
      {/* Header */}
      <header className="border-b border-stone-800 bg-stone-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-amber-400 font-display font-semibold tracking-widest shrink-0">🍺 Taverne</span>
            <span className="text-stone-700">|</span>
            <span className="text-white font-display font-semibold tracking-wide truncate">{campaign.name}</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-8">
        {campaign.description && (
          <p className="text-stone-400 text-sm">{campaign.description}</p>
        )}

        {/* Calendrier de campagne */}
        {(campaign.game_calendar?.date || campaign.game_calendar?.weather || campaign.game_calendar?.notes) && (
          <section>
            <h2 className="text-stone-500 text-xs font-semibold uppercase tracking-widest mb-3">Calendrier</h2>
            <div className="bg-stone-900 border border-stone-800 rounded-xl px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-2">
              {campaign.game_calendar.date && (
                <div className="flex items-center gap-2">
                  <span className="text-stone-500 text-xs">📅</span>
                  <span className="text-white text-sm font-medium">{campaign.game_calendar.date}</span>
                  {campaign.game_calendar.time && (
                    <span className="text-stone-400 text-xs capitalize">· {campaign.game_calendar.time}</span>
                  )}
                </div>
              )}
              {campaign.game_calendar.weather && (
                <div className="flex items-center gap-2">
                  <span className="text-stone-500 text-xs">🌤</span>
                  <span className="text-stone-300 text-sm">{campaign.game_calendar.weather}</span>
                </div>
              )}
              {campaign.game_calendar.notes && (
                <span className="text-stone-500 text-xs italic w-full">{campaign.game_calendar.notes}</span>
              )}
            </div>
          </section>
        )}

        {/* Ce que les joueurs savent du passé de la campagne viendra de leur wiki,
            écrit pour eux. Les chapitres du MJ ne sont pas publiables : ils portent
            ses secrets. */}

        {/* Carte de campagne */}
        {campaign.campaign_map?.image_url && (
          <section>
            <h2 className="text-stone-500 text-xs font-semibold uppercase tracking-widest mb-3">Carte</h2>
            <div className="relative bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
              <div className="relative" style={{ userSelect: 'none' }}>
                <img
                  src={campaign.campaign_map.image_url}
                  alt="Carte de campagne"
                  className="w-full h-auto block"
                  onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }}
                />
                {campaign.campaign_map.pins.map(pin => {
                  const colorClasses: Record<string, string> = {
                    amber: 'bg-amber-500 border-amber-400',
                    red: 'bg-red-500 border-red-400',
                    blue: 'bg-blue-500 border-blue-400',
                    green: 'bg-emerald-500 border-emerald-400',
                    purple: 'bg-purple-500 border-purple-400',
                    sky: 'bg-sky-500 border-sky-400',
                  }
                  const textClasses: Record<string, string> = {
                    amber: 'bg-amber-900/90 border-amber-600/60 text-amber-200',
                    red: 'bg-red-900/90 border-red-600/60 text-red-200',
                    blue: 'bg-blue-900/90 border-blue-600/60 text-blue-200',
                    green: 'bg-emerald-900/90 border-emerald-600/60 text-emerald-200',
                    purple: 'bg-purple-900/90 border-purple-600/60 text-purple-200',
                    sky: 'bg-sky-900/90 border-sky-600/60 text-sky-200',
                  }
                  return (
                    <div
                      key={pin.id}
                      className="absolute pointer-events-none"
                      style={{ left: `${pin.x}%`, top: `${pin.y}%`, transform: 'translate(-50%, -100%)' }}
                    >
                      <span className={`block text-xs font-semibold whitespace-nowrap border rounded px-1.5 py-0.5 mb-0.5 ${textClasses[pin.color] ?? textClasses.amber}`}>
                        {pin.label}
                      </span>
                      <div className={`w-0.5 h-3 mx-auto rounded-full ${colorClasses[pin.color] ?? colorClasses.amber}`} />
                      <div className={`w-2 h-2 rounded-full border mx-auto ${colorClasses[pin.color] ?? colorClasses.amber}`} />
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        )}

        {/* PNJ connus (alliés / neutres) */}
        {(campaign.npcs ?? []).filter(n => n.status === 'allié' || n.status === 'neutre').length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-stone-500 text-xs font-semibold uppercase tracking-widest">PNJ connus</h2>
              {(campaign.npcs ?? []).filter(n => n.status === 'allié' || n.status === 'neutre').length > 4 && (
                <input
                  type="text"
                  value={npcSearch}
                  onChange={e => setNpcSearch(e.target.value)}
                  placeholder="Chercher…"
                  className="w-32 bg-stone-900 border border-stone-800 rounded-lg px-2.5 py-1 text-white text-xs placeholder-stone-600 focus:outline-none focus:border-stone-600 transition-colors"
                />
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(campaign.npcs ?? [])
                .filter(n => (n.status === 'allié' || n.status === 'neutre') && (!npcSearch || n.name.toLowerCase().includes(npcSearch.toLowerCase()) || (n.role ?? '').toLowerCase().includes(npcSearch.toLowerCase())))
                .map((npc, i) => (
                  <div key={i} className="bg-stone-900 border border-stone-800 rounded-xl p-4">
                    <div className="flex items-start gap-2">
                      <span className="text-base shrink-0 mt-0.5">
                        {npc.status === 'allié' ? '🟢' : '🟡'}
                      </span>
                      <div className="min-w-0">
                        <p className="text-white font-semibold text-sm leading-tight">{npc.name}</p>
                        {npc.role && <p className="text-stone-400 text-xs mt-0.5">{npc.role}</p>}
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                          {npc.location && <p className="text-stone-500 text-xs">📍 {npc.location}</p>}
                          {npc.faction && <p className="text-stone-500 text-xs">⚔ {npc.faction}</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* Lieux connus / explorés */}
        {(campaign.locations ?? []).filter(l => l.status === 'connu' || l.status === 'exploré').length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-stone-500 text-xs font-semibold uppercase tracking-widest">Lieux</h2>
              {(campaign.locations ?? []).filter(l => l.status === 'connu' || l.status === 'exploré').length > 4 && (
                <input
                  type="text"
                  value={locationSearchShared}
                  onChange={e => setLocationSearchShared(e.target.value)}
                  placeholder="Chercher…"
                  className="w-32 bg-stone-900 border border-stone-800 rounded-lg px-2.5 py-1 text-white text-xs placeholder-stone-600 focus:outline-none focus:border-stone-600 transition-colors"
                />
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(campaign.locations ?? [])
                .filter(l => (l.status === 'connu' || l.status === 'exploré') && (!locationSearchShared || l.name.toLowerCase().includes(locationSearchShared.toLowerCase()) || (l.type ?? '').toLowerCase().includes(locationSearchShared.toLowerCase())))
                .map((loc, i) => (
                  <div key={i} className="bg-stone-900 border border-stone-800 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-white font-semibold text-sm leading-tight capitalize">{loc.name}</p>
                        <p className="text-stone-500 text-xs mt-0.5 capitalize">{loc.type}</p>
                      </div>
                      <span className={`shrink-0 text-xs font-medium rounded-full px-2 py-0.5 border ${
                        loc.status === 'exploré'
                          ? 'bg-emerald-900/50 border-emerald-700/50 text-emerald-400'
                          : 'bg-amber-900/50 border-amber-700/50 text-amber-400'
                      }`}>
                        {loc.status === 'exploré' ? 'Exploré' : 'Connu'}
                      </span>
                    </div>
                    {loc.notes && <MarkdownText className="text-stone-400 text-xs mt-2 line-clamp-3">{loc.notes}</MarkdownText>}
                    {loc.map_url && (
                      <a href={loc.map_url} target="_blank" rel="noopener noreferrer" title="Ouvrir la carte en grand" className="block mt-2">
                        <img src={loc.map_url} alt={`Carte de ${loc.name}`} className="w-full rounded-lg border border-stone-800" />
                      </a>
                    )}
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* Trésor commun */}
        {(campaign.party_treasury ?? []).length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-stone-500 text-xs font-semibold uppercase tracking-widest">Trésor du groupe</h2>
              {(campaign.party_treasury ?? []).length > 4 && (
                <input
                  type="text"
                  value={treasurySearch}
                  onChange={e => setTreasurySearch(e.target.value)}
                  placeholder="Chercher…"
                  className="w-32 bg-stone-900 border border-stone-800 rounded-lg px-2.5 py-1 text-white text-xs placeholder-stone-600 focus:outline-none focus:border-stone-600 transition-colors"
                />
              )}
            </div>
            <div className="bg-stone-900 border border-stone-800 rounded-xl divide-y divide-stone-800">
              {(campaign.party_treasury as TreasureItem[]).filter(item => !treasurySearch || item.name.toLowerCase().includes(treasurySearch.toLowerCase()) || (item.notes ?? '').toLowerCase().includes(treasurySearch.toLowerCase())).map((item, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-stone-200 text-sm font-medium truncate">{item.name}</p>
                    {item.notes && <p className="text-stone-500 text-xs mt-0.5 truncate">{item.notes}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {item.value_gp != null && (
                      <span className="text-amber-400 text-xs font-medium">{formatGold(item.value_gp)}</span>
                    )}
                    {item.quantity > 1 && <span className="text-stone-400 text-xs">×{item.quantity}</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {token && <PlayerNotes campaignToken={token} />}

      </main>
      <FloatingDiceRoller campaign={token ? { kind: 'share', token } : undefined} />
      <RulesCompendium />
    </div>
    </>
  )
}
