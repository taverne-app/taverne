import { useState } from 'react'
import {
  updateCampaign,
  type CustomMonster,
  type MonsterAttack,
} from '../../api/campaigns'
import { createCombatant } from '../../api/combatants'
import { CR_XP } from '../../data/monsters'
import { ImagePicker } from '../../components/ImagePicker'
import { ImageLightbox } from '../../components/ImageLightbox'
import type { SectionProps } from './shared'

/**
 * Bestiaire personnalisé — monstres maison réutilisables dans les rencontres.
 *
 * Sa propre entrée dans la barre, au niveau de la campagne : les monstres sont une
 * donnée de campagne, comme les PNJ ou les lieux. Chaque monstre porte une vignette
 * (ImagePicker) et une zone (un lieu de la section Monde), d'où les deux filtres —
 * par zone et par niveau (CR).
 */
export default function CampaignBestiary({ campaign, setCampaign, saving }: SectionProps) {
  const emptyMonsterDraft = (): CustomMonster => ({ name: '', cr: '1', ac: 12, hp_avg: 10, initiative_mod: 0, xp: 200, speed: undefined, attacks: [], image_url: '', zone: '' })
  const emptyAttackDraft = (): MonsterAttack => ({ name: '', bonus: '', damage: '' })
  const [monsterDraft, setMonsterDraft] = useState<CustomMonster>(emptyMonsterDraft())
  const [addingMonster, setAddingMonster] = useState(false)
  const [attackDraft, setAttackDraft] = useState<MonsterAttack>(emptyAttackDraft())
  const [editingMonsterIdx, setEditingMonsterIdx] = useState<number | null>(null)
  const [editMonsterDraft, setEditMonsterDraft] = useState<CustomMonster>(emptyMonsterDraft())
  const [editAttackDraft, setEditAttackDraft] = useState<MonsterAttack>(emptyAttackDraft())
  const [combatMonsterIdx, setCombatMonsterIdx] = useState<number | null>(null)
  const [combatMonsterCount, setCombatMonsterCount] = useState(1)
  const [monsterSearch, setMonsterSearch] = useState('')
  const [monsterCrFilter, setMonsterCrFilter] = useState<'all' | 'low' | 'mid' | 'high'>('all')
  const [monsterZoneFilter, setMonsterZoneFilter] = useState<string>('all')
  const [monsterSort, setMonsterSort] = useState<'name' | 'cr' | 'xp' | 'hp'>('name')

  const locations = campaign.locations ?? []
  const usedZones = [...new Set((campaign.custom_monsters ?? []).map(m => m.zone).filter(Boolean))] as string[]

  async function handleAddCustomMonster() {
    if (!campaign || !monsterDraft.name.trim()) return
    const xp = CR_XP[monsterDraft.cr] ?? 0
    const next = [...(campaign.custom_monsters ?? []), { ...monsterDraft, name: monsterDraft.name.trim(), xp }]
    const updated = await updateCampaign(campaign.id, { custom_monsters: next })
    setCampaign(updated)
    setMonsterDraft(emptyMonsterDraft())
    setAddingMonster(false)
  }
  async function handleDeleteCustomMonster(index: number) {
    if (!campaign) return
    const next = (campaign.custom_monsters ?? []).filter((_, i) => i !== index)
    const updated = await updateCampaign(campaign.id, { custom_monsters: next })
    setCampaign(updated)
    if (editingMonsterIdx === index) setEditingMonsterIdx(null)
  }
  async function handleAddMonsterToCombat(m: CustomMonster, count: number) {
    if (!campaign) return
    await Promise.all(
      Array.from({ length: count }, (_, idx) =>
        createCombatant(campaign.id, {
          name: count > 1 ? `${m.name} ${idx + 1}` : m.name,
          max_hp: m.hp_avg,
          armor_class: m.ac,
        })
      )
    )
    setCombatMonsterIdx(null)
  }
  async function handleDuplicateMonster(index: number) {
    if (!campaign) return
    const src = (campaign.custom_monsters ?? [])[index]
    if (!src) return
    const copy = { ...src, name: `${src.name} (copie)`, attacks: [...(src.attacks ?? [])] }
    const next = [...(campaign.custom_monsters ?? []), copy]
    const updated = await updateCampaign(campaign.id, { custom_monsters: next })
    setCampaign(updated)
  }
  async function handleUpdateCustomMonster(index: number) {
    if (!campaign || !editMonsterDraft.name.trim()) return
    const xp = CR_XP[editMonsterDraft.cr] ?? 0
    const next = (campaign.custom_monsters ?? []).map((m, i) => i === index ? { ...editMonsterDraft, name: editMonsterDraft.name.trim(), xp } : m)
    const updated = await updateCampaign(campaign.id, { custom_monsters: next })
    setCampaign(updated)
    setEditingMonsterIdx(null)
  }

  const crNum = (cr: string) => cr === '1/8' ? 0.125 : cr === '1/4' ? 0.25 : cr === '1/2' ? 0.5 : parseFloat(cr) || 0

  return (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">
              Bestiaire ({(campaign.custom_monsters ?? []).length})
            </h2>
            <button
              onClick={() => { setAddingMonster(v => !v); setMonsterDraft(emptyMonsterDraft()) }}
              className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors"
            >
              {addingMonster ? 'Annuler' : '+ Monstre'}
            </button>
          </div>

          {addingMonster && (
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 mb-4 space-y-3">
              {/* Visuel */}
              <div>
                <label className="text-stone-500 text-xs block mb-1">Visuel</label>
                <ImagePicker
                  value={monsterDraft.image_url ?? ''}
                  onChange={url => setMonsterDraft(d => ({ ...d, image_url: url }))}
                  placeholder="URL du portrait, ou choisir dans la bibliothèque…"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-3">
                  <label className="text-stone-500 text-xs block mb-1">Nom *</label>
                  <input
                    type="text"
                    value={monsterDraft.name}
                    onChange={e => setMonsterDraft(d => ({ ...d, name: e.target.value }))}
                    autoFocus
                    placeholder="ex. Gobelin des ombres"
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-stone-500 text-xs block mb-1">CR</label>
                  <select
                    value={monsterDraft.cr}
                    onChange={e => setMonsterDraft(d => ({ ...d, cr: e.target.value, xp: CR_XP[e.target.value] ?? 0 }))}
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                  >
                    {['0','1/8','1/4','1/2','1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30'].map(cr => (
                      <option key={cr} value={cr}>CR {cr} — {CR_XP[cr] ?? 0} XP</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-stone-500 text-xs block mb-1">CA</label>
                  <input
                    type="number"
                    value={monsterDraft.ac}
                    onChange={e => setMonsterDraft(d => ({ ...d, ac: Number(e.target.value) }))}
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-stone-500 text-xs block mb-1">PV moyens</label>
                  <input
                    type="number"
                    value={monsterDraft.hp_avg}
                    onChange={e => setMonsterDraft(d => ({ ...d, hp_avg: Number(e.target.value) }))}
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-stone-500 text-xs block mb-1">Mod. Initiative</label>
                  <input
                    type="number"
                    value={monsterDraft.initiative_mod}
                    onChange={e => setMonsterDraft(d => ({ ...d, initiative_mod: Number(e.target.value) }))}
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-stone-500 text-xs block mb-1">Vitesse (m)</label>
                  <input
                    type="number"
                    value={monsterDraft.speed ?? ''}
                    onChange={e => setMonsterDraft(d => ({ ...d, speed: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="9"
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-stone-500 text-xs block mb-1">Zone</label>
                  {locations.length > 0 ? (
                    <select
                      value={monsterDraft.zone ?? ''}
                      onChange={e => setMonsterDraft(d => ({ ...d, zone: e.target.value }))}
                      className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                    >
                      <option value="">🗺 Aucune</option>
                      {locations.map((l, i) => <option key={i} value={l.name}>{l.name}</option>)}
                    </select>
                  ) : (
                    <p className="text-stone-600 text-xs py-2">Ajoutez des lieux dans « Monde » pour situer vos monstres.</p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="text-stone-500 text-xs block mb-1">Notes</label>
                  <input
                    type="text"
                    value={monsterDraft.notes ?? ''}
                    onChange={e => setMonsterDraft(d => ({ ...d, notes: e.target.value }))}
                    placeholder="Résistances, traits…"
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>
              {/* Attaques */}
              <div>
                <p className="text-stone-500 text-xs font-semibold uppercase tracking-widest mb-2">Attaques</p>
                {(monsterDraft.attacks ?? []).map((atk, i) => (
                  <div key={i} className="flex items-center gap-2 mb-1.5 bg-stone-800/60 rounded-lg px-3 py-1.5">
                    <span className="text-stone-200 text-sm flex-1 truncate">{atk.name}</span>
                    <span className="text-amber-300 text-xs font-mono">{atk.bonus}</span>
                    <span className="text-stone-500 text-xs">→</span>
                    <span className="text-red-300 text-xs font-mono">{atk.damage}</span>
                    <button onClick={() => setMonsterDraft(d => ({ ...d, attacks: (d.attacks ?? []).filter((_, j) => j !== i) }))} className="text-stone-600 hover:text-red-400 text-sm transition-colors">×</button>
                  </div>
                ))}
                <div className="grid grid-cols-3 gap-2 mt-1">
                  <input type="text" placeholder="Nom (ex. Épée)" value={attackDraft.name} onChange={e => setAttackDraft(d => ({ ...d, name: e.target.value }))}
                    className="bg-stone-800 border border-stone-700 rounded-lg px-2 py-1.5 text-white text-xs placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors" />
                  <input type="text" placeholder="+5 au toucher" value={attackDraft.bonus} onChange={e => setAttackDraft(d => ({ ...d, bonus: e.target.value }))}
                    className="bg-stone-800 border border-stone-700 rounded-lg px-2 py-1.5 text-white text-xs placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors" />
                  <input type="text" placeholder="1d6+3 tranchant" value={attackDraft.damage} onChange={e => setAttackDraft(d => ({ ...d, damage: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && attackDraft.name.trim() && attackDraft.damage.trim()) {
                        setMonsterDraft(d => ({ ...d, attacks: [...(d.attacks ?? []), { ...attackDraft }] }))
                        setAttackDraft(emptyAttackDraft())
                      }
                    }}
                    className="bg-stone-800 border border-stone-700 rounded-lg px-2 py-1.5 text-white text-xs placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors" />
                </div>
                {attackDraft.name.trim() && attackDraft.damage.trim() && (
                  <button
                    onClick={() => { setMonsterDraft(d => ({ ...d, attacks: [...(d.attacks ?? []), { ...attackDraft }] })); setAttackDraft(emptyAttackDraft()) }}
                    className="text-amber-400 hover:text-amber-300 text-xs transition-colors mt-1"
                  >+ Ajouter attaque</button>
                )}
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleAddCustomMonster}
                  disabled={saving || !monsterDraft.name.trim()}
                  className="bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold rounded-lg px-4 py-2 transition-colors disabled:opacity-40"
                >
                  Ajouter
                </button>
              </div>
            </div>
          )}

          {(campaign.custom_monsters ?? []).length > 0 && (
            <div className="mb-3 space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={monsterSearch}
                  onChange={e => setMonsterSearch(e.target.value)}
                  placeholder="Rechercher un monstre…"
                  className="flex-1 bg-stone-900 border border-stone-800 rounded-lg px-3 py-1.5 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-stone-600 transition-colors"
                />
                <select
                  value={monsterSort}
                  onChange={e => setMonsterSort(e.target.value as typeof monsterSort)}
                  className="bg-stone-900 border border-stone-800 rounded-lg px-2 py-1.5 text-stone-300 text-sm focus:outline-none focus:border-stone-600 transition-colors"
                >
                  <option value="name">Nom A→Z</option>
                  <option value="cr">CR ↑</option>
                  <option value="xp">XP ↑</option>
                  <option value="hp">PV ↑</option>
                </select>
              </div>
              {/* Filtre par niveau (CR) */}
              <div className="flex gap-1.5 flex-wrap">
                {(['all', 'low', 'mid', 'high'] as const).map(f => {
                  const labels = { all: 'Tous niveaux', low: 'CR 0–4', mid: 'CR 5–10', high: 'CR 11+' }
                  return (
                    <button key={f} onClick={() => setMonsterCrFilter(f)} className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${monsterCrFilter === f ? 'bg-rose-900/60 border-rose-700 text-rose-300' : 'bg-stone-900 border-stone-700 text-stone-500 hover:text-stone-300'}`}>
                      {labels[f]}
                    </button>
                  )
                })}
              </div>
              {/* Filtre par zone (lieux) */}
              {usedZones.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {(['all', ...usedZones]).map(z => {
                    const count = z === 'all' ? (campaign.custom_monsters ?? []).length : (campaign.custom_monsters ?? []).filter(m => m.zone === z).length
                    return (
                      <button key={z} onClick={() => setMonsterZoneFilter(z)} className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${monsterZoneFilter === z ? 'bg-emerald-900/60 border-emerald-700 text-emerald-300' : 'bg-stone-900 border-stone-700 text-stone-500 hover:text-stone-300'}`}>
                        {z === 'all' ? `Toutes zones (${count})` : `📍 ${z} (${count})`}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {(campaign.custom_monsters ?? []).length > 0 ? (() => {
            const filtered = (campaign.custom_monsters ?? [])
              .map((m, i) => ({ m, i }))
              .filter(({ m }) => {
                if (monsterSearch && !m.name.toLowerCase().includes(monsterSearch.toLowerCase())) return false
                if (monsterCrFilter === 'low' && crNum(m.cr) > 4) return false
                if (monsterCrFilter === 'mid' && (crNum(m.cr) < 5 || crNum(m.cr) > 10)) return false
                if (monsterCrFilter === 'high' && crNum(m.cr) < 11) return false
                if (monsterZoneFilter !== 'all' && m.zone !== monsterZoneFilter) return false
                return true
              })
              .sort((a, b) => {
                if (monsterSort === 'cr') return crNum(a.m.cr) - crNum(b.m.cr)
                if (monsterSort === 'xp') return (a.m.xp ?? 0) - (b.m.xp ?? 0)
                if (monsterSort === 'hp') return (a.m.hp_avg ?? 0) - (b.m.hp_avg ?? 0)
                return a.m.name.localeCompare(b.m.name, 'fr')
              })
            if (filtered.length === 0) return (
              <p className="text-stone-600 text-sm text-center py-6">Aucun monstre ne correspond aux filtres.</p>
            )
            return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map(({ m, i }) => (
                <div key={i} className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
                  {editingMonsterIdx === i ? (
                    <div className="p-4 space-y-3">
                      <div>
                        <label className="text-stone-600 text-[10px] block mb-1 uppercase tracking-widest">Visuel</label>
                        <ImagePicker value={editMonsterDraft.image_url ?? ''} onChange={url => setEditMonsterDraft(d => ({ ...d, image_url: url }))} placeholder="URL du portrait…" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input autoFocus type="text" placeholder="Nom *" value={editMonsterDraft.name} onChange={e => setEditMonsterDraft(d => ({ ...d, name: e.target.value }))}
                          className="bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1.5 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-rose-500" />
                        <select value={editMonsterDraft.cr} onChange={e => setEditMonsterDraft(d => ({ ...d, cr: e.target.value }))}
                          className="bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1.5 text-white text-sm focus:outline-none focus:border-rose-500">
                          {['0','1/8','1/4','1/2','1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20'].map(cr => <option key={cr} value={cr}>CR {cr}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div><label className="text-stone-600 text-[10px] block mb-0.5">CA</label><input type="number" value={editMonsterDraft.ac} onChange={e => setEditMonsterDraft(d => ({ ...d, ac: +e.target.value }))} className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-rose-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" /></div>
                        <div><label className="text-stone-600 text-[10px] block mb-0.5">PV moy.</label><input type="number" value={editMonsterDraft.hp_avg} onChange={e => setEditMonsterDraft(d => ({ ...d, hp_avg: +e.target.value }))} className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-rose-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" /></div>
                        <div><label className="text-stone-600 text-[10px] block mb-0.5">Init. mod</label><input type="number" value={editMonsterDraft.initiative_mod} onChange={e => setEditMonsterDraft(d => ({ ...d, initiative_mod: +e.target.value }))} className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-rose-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" /></div>
                        <div><label className="text-stone-600 text-[10px] block mb-0.5">Vitesse</label><input type="number" value={editMonsterDraft.speed ?? ''} onChange={e => setEditMonsterDraft(d => ({ ...d, speed: e.target.value ? +e.target.value : undefined }))} placeholder="—" className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-rose-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" /></div>
                      </div>
                      {locations.length > 0 && (
                        <div>
                          <label className="text-stone-600 text-[10px] block mb-0.5 uppercase tracking-widest">Zone</label>
                          <select value={editMonsterDraft.zone ?? ''} onChange={e => setEditMonsterDraft(d => ({ ...d, zone: e.target.value }))}
                            className="w-full bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1.5 text-white text-sm focus:outline-none focus:border-rose-500">
                            <option value="">🗺 Aucune</option>
                            {locations.map((l, li) => <option key={li} value={l.name}>{l.name}</option>)}
                          </select>
                        </div>
                      )}
                      <input type="text" placeholder="Notes (immunités, capacités…)" value={editMonsterDraft.notes ?? ''} onChange={e => setEditMonsterDraft(d => ({ ...d, notes: e.target.value }))}
                        className="w-full bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1.5 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-rose-500" />
                      <div>
                        <p className="text-stone-500 text-xs font-semibold uppercase tracking-widest mb-2">Attaques</p>
                        {(editMonsterDraft.attacks ?? []).map((atk, ai) => (
                          <div key={ai} className="flex items-center gap-2 mb-1.5 bg-stone-800/60 rounded-lg px-3 py-1.5">
                            <span className="text-stone-200 text-sm flex-1 truncate">{atk.name}</span>
                            <span className="text-amber-300 text-xs font-mono">{atk.bonus}</span>
                            <span className="text-stone-500 text-xs">→</span>
                            <span className="text-red-300 text-xs font-mono">{atk.damage}</span>
                            <button onClick={() => setEditMonsterDraft(d => ({ ...d, attacks: (d.attacks ?? []).filter((_, j) => j !== ai) }))} className="text-stone-600 hover:text-red-400 text-sm transition-colors">×</button>
                          </div>
                        ))}
                        <div className="grid grid-cols-3 gap-2 mt-1">
                          <input type="text" placeholder="Nom" value={editAttackDraft.name} onChange={e => setEditAttackDraft(d => ({ ...d, name: e.target.value }))} className="bg-stone-800 border border-stone-700 rounded-lg px-2 py-1.5 text-white text-xs placeholder-stone-600 focus:outline-none focus:border-rose-500" />
                          <input type="text" placeholder="+5 au toucher" value={editAttackDraft.bonus} onChange={e => setEditAttackDraft(d => ({ ...d, bonus: e.target.value }))} className="bg-stone-800 border border-stone-700 rounded-lg px-2 py-1.5 text-white text-xs placeholder-stone-600 focus:outline-none focus:border-rose-500" />
                          <input type="text" placeholder="1d6+3" value={editAttackDraft.damage} onChange={e => setEditAttackDraft(d => ({ ...d, damage: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter' && editAttackDraft.name.trim() && editAttackDraft.damage.trim()) { setEditMonsterDraft(d => ({ ...d, attacks: [...(d.attacks ?? []), { ...editAttackDraft }] })); setEditAttackDraft(emptyAttackDraft()) } }}
                            className="bg-stone-800 border border-stone-700 rounded-lg px-2 py-1.5 text-white text-xs placeholder-stone-600 focus:outline-none focus:border-rose-500" />
                        </div>
                        {editAttackDraft.name.trim() && editAttackDraft.damage.trim() && (
                          <button onClick={() => { setEditMonsterDraft(d => ({ ...d, attacks: [...(d.attacks ?? []), { ...editAttackDraft }] })); setEditAttackDraft(emptyAttackDraft()) }} className="text-rose-400 hover:text-rose-300 text-xs mt-1 transition-colors">+ Ajouter l'attaque</button>
                        )}
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setEditingMonsterIdx(null)} className="text-stone-500 hover:text-stone-300 text-xs transition-colors">Annuler</button>
                        <button onClick={() => handleUpdateCustomMonster(i)} disabled={!editMonsterDraft.name.trim()} className="bg-rose-700 hover:bg-rose-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors">Sauvegarder</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-stretch">
                      {/* Vignette */}
                      {m.image_url ? (
                        <ImageLightbox
                          src={m.image_url}
                          alt={m.name}
                          className="w-24 sm:w-28 object-cover shrink-0 bg-stone-950"
                        />
                      ) : (
                        <div className="w-24 sm:w-28 shrink-0 bg-stone-950/60 flex items-center justify-center text-3xl text-stone-700">🐾</div>
                      )}
                      <div className="p-4 flex items-start justify-between gap-3 flex-1 min-w-0">
                        <div className="min-w-0">
                          <p className="text-white text-sm font-medium">{m.name}</p>
                          {m.zone && <p className="text-emerald-400/80 text-xs mt-0.5">📍 {m.zone}</p>}
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                            <span className="text-stone-500 text-xs">CR {m.cr}</span>
                            <span className="text-stone-500 text-xs">CA {m.ac}</span>
                            <span className="text-stone-500 text-xs">{m.hp_avg} PV</span>
                            <span className="text-stone-500 text-xs">Init {m.initiative_mod >= 0 ? '+' : ''}{m.initiative_mod}</span>
                            <span className="text-amber-600/80 text-xs">{m.xp} XP</span>
                          </div>
                          {m.speed != null && <span className="text-stone-500 text-xs">Vit. {m.speed} m</span>}
                          {m.notes && <p className="text-stone-500 text-xs mt-1 italic">{m.notes}</p>}
                          {(m.attacks ?? []).length > 0 && (
                            <div className="mt-2 space-y-0.5">
                              {(m.attacks ?? []).map((atk, ai) => (
                                <p key={ai} className="text-xs text-stone-400">
                                  <span className="font-medium">{atk.name}</span>
                                  {' '}<span className="text-amber-500/80">{atk.bonus}</span>
                                  {' → '}<span className="text-red-400/80">{atk.damage}</span>
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {combatMonsterIdx === i ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={combatMonsterCount}
                                onChange={e => setCombatMonsterCount(Math.max(1, Math.min(9, parseInt(e.target.value) || 1)))}
                                min={1} max={9}
                                className="w-10 bg-stone-800 border border-stone-700 rounded px-1 py-0.5 text-white text-xs text-center focus:outline-none focus:border-amber-500"
                                autoFocus
                              />
                              <button
                                onClick={() => handleAddMonsterToCombat(m, combatMonsterCount)}
                                className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors"
                              >⚔</button>
                              <button onClick={() => setCombatMonsterIdx(null)} className="text-stone-600 hover:text-stone-400 text-xs transition-colors">✕</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setCombatMonsterIdx(i); setCombatMonsterCount(1) }}
                              className="text-stone-600 hover:text-amber-400 text-xs transition-colors"
                              title="Ajouter au combat"
                            >⚔</button>
                          )}
                          <button onClick={() => handleDuplicateMonster(i)} className="text-stone-600 hover:text-sky-400 text-xs transition-colors" title="Dupliquer">⎘</button>
                          <button onClick={() => { setEditMonsterDraft({ ...m, attacks: [...(m.attacks ?? [])] }); setEditAttackDraft(emptyAttackDraft()); setEditingMonsterIdx(i) }} className="text-stone-600 hover:text-stone-400 text-xs transition-colors" title="Modifier">✎</button>
                          <button onClick={() => handleDeleteCustomMonster(i)} className="text-stone-600 hover:text-red-400 text-lg leading-none transition-colors">×</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            )
          })() : (
            !addingMonster && (
              <p className="text-stone-600 text-sm text-center py-4">Aucun monstre personnalisé. Créez-en pour les utiliser dans les rencontres.</p>
            )
          )}
        </div>
  )
}
