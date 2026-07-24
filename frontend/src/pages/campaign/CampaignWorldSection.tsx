import { useEffect, useState } from 'react'
import {
  updateCampaign,
  type Npc,
  type Location,
  type Faction,
  type MapPin,
  type CampaignMap,
} from '../../api/campaigns'
import { MarkdownText } from '../../components/MarkdownText'
import { MicButton } from '../../components/MicButton'
import { ImagePicker } from '../../components/ImagePicker'
import { generateNpc, generateNpcName, NPC_RACES, type GeneratedNpc } from '../../data/npc_generator'
import type { SectionProps } from './shared'
import { uuid } from './shared'

/**
 * Section « Monde » : PNJ, lieux, factions et carte de campagne.
 *
 * Extraite de CampaignPage. Les 4 blocs JSX de cet onglet étaient contigus (seuls
 * d'autres onglets les séparaient), donc les regrouper ne change pas l'affichage.
 */
export default function CampaignWorldSection({
  campaign, setCampaign, copiedKey, copyToClipboard, exportSection, importSectionData, saving,
}: SectionProps) {
  // Notes privées du MJ. Elles vivaient sur la page Session ; leur place est ici, avec
  // le monde qu'elles décrivent — et le futur codex les remplacera.
  const [dmNotesDraft, setDmNotesDraft] = useState(campaign.dm_notes ?? '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [dmNotesPreview, setDmNotesPreview] = useState(false)

  async function handleSaveDmNotes() {
    setSavingNotes(true)
    try {
      setCampaign(await updateCampaign(campaign.id, { dm_notes: dmNotesDraft }))
    } finally { setSavingNotes(false) }
  }

  const [npcDraft, setNpcDraft] = useState<Npc>({ name: '', role: '', status: 'inconnu', location: '', faction: '', notes: '' })
  const [addingNpc, setAddingNpc] = useState(false)
  const [expandedNpc, setExpandedNpc] = useState<number | null>(null)
  const [npcStatusFilter, setNpcStatusFilter] = useState<'all' | Npc['status']>('all')
  const [npcFactionFilter, setNpcFactionFilter] = useState<string>('all')
  const [npcLocationFilter, setNpcLocationFilter] = useState<string>('all')
  const [npcSort, setNpcSort] = useState<'default' | 'name' | 'status' | 'faction'>('default')
  const [npcSearch, setNpcSearch] = useState('')
  const emptyLocationDraft = (): Location => ({ name: '', type: 'autre', status: 'inconnu', reputation: 'neutre', notes: '' })
  const [expandedLocation, setExpandedLocation] = useState<number | null>(null)
  const [editingLocationIdx, setEditingLocationIdx] = useState<number | null>(null)
  const [locationStatusFilter, setLocationStatusFilter] = useState<'all' | Location['status']>('all')
  const [locationTypeFilter, setLocationTypeFilter] = useState<string>('all')
  const [locationSearch, setLocationSearch] = useState('')
  const [locationSort, setLocationSort] = useState<'default' | 'name' | 'type' | 'status'>('default')
  const emptyFactionDraft = (): Faction => ({ name: '', description: '', reputation: 0, notes: '' })
  const [factionDraft, setFactionDraft] = useState<Faction>(emptyFactionDraft())
  const [addingFaction, setAddingFaction] = useState(false)
  const [expandedFaction, setExpandedFaction] = useState<number | null>(null)
  const [editingFactionIdx, setEditingFactionIdx] = useState<number | null>(null)
  const [factionRepFilter, setFactionRepFilter] = useState<'all' | 'allied' | 'neutral' | 'enemy'>('all')
  const [factionSearch, setFactionSearch] = useState('')
  const [generatedNpc, setGeneratedNpc] = useState<GeneratedNpc | null>(null)
  const [showNpcGenerator, setShowNpcGenerator] = useState(false)
  const [mapUrlDraft, setMapUrlDraft] = useState('')
  const [editingMapUrl, setEditingMapUrl] = useState(false)
  const [mapAddingPin, setMapAddingPin] = useState(false)
  const [pinLabelDraft, setPinLabelDraft] = useState('')
  const [pinColorDraft, setPinColorDraft] = useState<MapPin['color']>('amber')
  const [editingPinId, setEditingPinId] = useState<string | null>(null)
  const [editPinDraft, setEditPinDraft] = useState<Pick<MapPin, 'label' | 'color' | 'location_name'>>({ label: '', color: 'amber', location_name: '' })
  async function handleAddNpc() {
    if (!campaign || !npcDraft.name.trim()) return
    const next: Npc[] = [...(campaign.npcs ?? []), { ...npcDraft, name: npcDraft.name.trim() }]
    const updated = await updateCampaign(campaign.id, { npcs: next })
    setCampaign(updated)
    setNpcDraft({ name: '', role: '', status: 'inconnu', location: '', faction: '', notes: '' })
    setAddingNpc(false)
  }
  async function handleDeleteNpc(index: number) {
    if (!campaign) return
    const next = (campaign.npcs ?? []).filter((_, i) => i !== index)
    const updated = await updateCampaign(campaign.id, { npcs: next })
    setCampaign(updated)
    if (expandedNpc === index) setExpandedNpc(null)
  }
  async function handleDuplicateNpc(index: number) {
    if (!campaign) return
    const src = (campaign.npcs ?? [])[index]
    if (!src) return
    const copy = { ...src, name: `${src.name} (copie)` }
    const next = [...(campaign.npcs ?? []), copy]
    const updated = await updateCampaign(campaign.id, { npcs: next })
    setCampaign(updated)
  }
  async function handleUpdateNpcStatus(index: number, status: Npc['status']) {
    if (!campaign) return
    const next = (campaign.npcs ?? []).map((n, i) => i === index ? { ...n, status } : n)
    const updated = await updateCampaign(campaign.id, { npcs: next })
    setCampaign(updated)
  }
  async function handleUpdateNpc(index: number) {
    if (!campaign || !editNpcDraft.name.trim()) return
    const next = (campaign.npcs ?? []).map((n, i) => i === index ? { ...editNpcDraft, name: editNpcDraft.name.trim() } : n)
    const updated = await updateCampaign(campaign.id, { npcs: next })
    setCampaign(updated)
    setEditingNpcIdx(null)
  }
  async function handleAddLocation() {
    if (!campaign || !locationDraft.name.trim()) return
    const next: Location[] = [...(campaign.locations ?? []), { ...locationDraft, name: locationDraft.name.trim() }]
    const updated = await updateCampaign(campaign.id, { locations: next })
    setCampaign(updated)
    setLocationDraft(emptyLocationDraft())
    setAddingLocation(false)
  }
  async function handleDeleteLocation(index: number) {
    if (!campaign) return
    const next = (campaign.locations ?? []).filter((_, i) => i !== index)
    const updated = await updateCampaign(campaign.id, { locations: next })
    setCampaign(updated)
    if (expandedLocation === index) setExpandedLocation(null)
  }
  async function handleUpdateLocationStatus(index: number, status: Location['status']) {
    if (!campaign) return
    const next = (campaign.locations ?? []).map((l, i) => i === index ? { ...l, status } : l)
    const updated = await updateCampaign(campaign.id, { locations: next })
    setCampaign(updated)
  }
  async function handleUpdateLocationReputation(index: number, reputation: Location['reputation']) {
    if (!campaign) return
    const next = (campaign.locations ?? []).map((l, i) => i === index ? { ...l, reputation } : l)
    const updated = await updateCampaign(campaign.id, { locations: next })
    setCampaign(updated)
  }
  async function handleUpdateLocation(index: number) {
    if (!campaign || !editLocationDraft.name.trim()) return
    const next = (campaign.locations ?? []).map((l, i) => i === index ? { ...editLocationDraft, name: editLocationDraft.name.trim() } : l)
    const updated = await updateCampaign(campaign.id, { locations: next })
    setCampaign(updated)
    setEditingLocationIdx(null)
  }
  async function handleDuplicateLocation(index: number) {
    if (!campaign) return
    const src = (campaign.locations ?? [])[index]
    if (!src) return
    const copy: Location = { ...src, name: `${src.name} (copie)` }
    const next = [...(campaign.locations ?? []), copy]
    const updated = await updateCampaign(campaign.id, { locations: next })
    setCampaign(updated)
  }
  function handleGenerateNpc() {
    setGeneratedNpc(generateNpc())
    setShowNpcGenerator(true)
  }
  async function handleSaveGeneratedNpc() {
    if (!campaign || !generatedNpc) return
    const npc: Npc = {
      name: generatedNpc.name,
      role: generatedNpc.profession,
      status: 'inconnu',
      location: '',
      notes: `${generatedNpc.race} · ${generatedNpc.gender}\n\n**Apparence :** ${generatedNpc.appearance}\n**Personnalité :** ${generatedNpc.personality}\n**Lien :** ${generatedNpc.bond}\n**Défaut :** ${generatedNpc.flaw}\n**Voix :** ${generatedNpc.voice}`,
    }
    const next = [...(campaign.npcs ?? []), npc]
    const updated = await updateCampaign(campaign.id, { npcs: next })
    setCampaign(updated)
    setShowNpcGenerator(false)
    setGeneratedNpc(null)
  }
  async function handleSetMapUrl() {
    if (!campaign) return
    const next: CampaignMap = { image_url: mapUrlDraft.trim(), pins: campaign.campaign_map?.pins ?? [] }
    const updated = await updateCampaign(campaign.id, { campaign_map: next })
    setCampaign(updated)
    setEditingMapUrl(false)
  }
  async function handleMapClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!mapAddingPin || !campaign) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    const pin: MapPin = {
      id: uuid(),
      label: pinLabelDraft.trim() || 'Lieu',
      x, y,
      color: pinColorDraft,
    }
    const currentMap = campaign.campaign_map ?? { image_url: '', pins: [] }
    const next: CampaignMap = { ...currentMap, pins: [...currentMap.pins, pin] }
    const updated = await updateCampaign(campaign.id, { campaign_map: next })
    setCampaign(updated)
    setMapAddingPin(false)
    setPinLabelDraft('')
  }
  async function handleDeletePin(pinId: string) {
    if (!campaign?.campaign_map) return
    const next: CampaignMap = {
      ...campaign.campaign_map,
      pins: campaign.campaign_map.pins.filter(p => p.id !== pinId),
    }
    const updated = await updateCampaign(campaign.id, { campaign_map: next })
    setCampaign(updated)
  }
  async function handleUpdatePin(pinId: string) {
    if (!campaign?.campaign_map || !editPinDraft.label.trim()) return
    const next: CampaignMap = {
      ...campaign.campaign_map,
      pins: campaign.campaign_map.pins.map(p =>
        p.id === pinId ? { ...p, label: editPinDraft.label.trim(), color: editPinDraft.color, location_name: editPinDraft.location_name || undefined } : p
      ),
    }
    const updated = await updateCampaign(campaign.id, { campaign_map: next })
    setCampaign(updated)
    setEditingPinId(null)
  }
  async function handleAddFaction() {
    if (!campaign || !factionDraft.name.trim()) return
    const next = [...(campaign.factions ?? []), { ...factionDraft, name: factionDraft.name.trim() }]
    const updated = await updateCampaign(campaign.id, { factions: next })
    setCampaign(updated)
    setFactionDraft(emptyFactionDraft())
    setAddingFaction(false)
  }
  async function handleUpdateFactionReputation(index: number, delta: number) {
    if (!campaign) return
    const next = (campaign.factions ?? []).map((f, i) =>
      i === index ? { ...f, reputation: Math.max(-5, Math.min(5, f.reputation + delta)) } : f
    )
    const updated = await updateCampaign(campaign.id, { factions: next })
    setCampaign(updated)
  }
  async function handleUpdateFaction(index: number) {
    if (!campaign || !editFactionDraft.name.trim()) return
    const next = (campaign.factions ?? []).map((f, i) => i === index ? { ...editFactionDraft, name: editFactionDraft.name.trim() } : f)
    const updated = await updateCampaign(campaign.id, { factions: next })
    setCampaign(updated)
    setEditingFactionIdx(null)
  }
  async function handleDeleteFaction(index: number) {
    if (!campaign) return
    const next = (campaign.factions ?? []).filter((_, i) => i !== index)
    const updated = await updateCampaign(campaign.id, { factions: next })
    setCampaign(updated)
    if (expandedFaction === index) setExpandedFaction(null)
  }
  async function handleDuplicateFaction(index: number) {
    if (!campaign) return
    const src = (campaign.factions ?? [])[index]
    if (!src) return
    const copy: Faction = { ...src, name: `${src.name} (copie)` }
    const next = [...(campaign.factions ?? []), copy]
    const updated = await updateCampaign(campaign.id, { factions: next })
    setCampaign(updated)
  }



  const [editingNpcIdx, setEditingNpcIdx]   = useState<number | null>(null)
  const [editNpcDraft, setEditNpcDraft]     = useState<Npc>({ name: '', role: '', status: 'inconnu', location: '', faction: '', notes: '' })
  const [addingLocation, setAddingLocation]   = useState(false)
  const [locationDraft, setLocationDraft]     = useState<Location>(emptyLocationDraft())
  const [editLocationDraft, setEditLocationDraft]   = useState<Location>(emptyLocationDraft())
  const [editFactionDraft, setEditFactionDraft]   = useState<Faction>(emptyFactionDraft())

  // Quel bloc du Monde est ouvert. Retenu par campagne : on revient d'un aller-retour
  // vers une fiche de PNJ là où on était, pas systématiquement sur les notes.
  type WorldSection = 'notes' | 'npcs' | 'locations' | 'map' | 'factions'
  const [worldSection, setWorldSection] = useState<WorldSection>(() => {
    const saved = localStorage.getItem(`taverne:monde:${campaign.id}`)
    return (['notes', 'npcs', 'locations', 'map', 'factions'] as const).includes(saved as WorldSection)
      ? (saved as WorldSection)
      : 'npcs'
  })

  useEffect(() => {
    localStorage.setItem(`taverne:monde:${campaign.id}`, worldSection)
  }, [campaign.id, worldSection])

  const worldSections = [
    { key: 'notes'     as const, icon: '🔒', label: 'Notes privées', count: null },
    { key: 'npcs'      as const, icon: '👥', label: 'PNJ',           count: (campaign.npcs ?? []).length },
    { key: 'locations' as const, icon: '📍', label: 'Lieux',         count: (campaign.locations ?? []).length },
    { key: 'map'       as const, icon: '🗺', label: 'Carte',         count: null },
    { key: 'factions'  as const, icon: '⚑', label: 'Factions',      count: (campaign.factions ?? []).length },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,200px)_minmax(0,1fr)]">
      {/* Sommaire du Monde. Les cinq blocs tenaient dans une seule colonne : il fallait
          faire défiler la page entière pour atteindre les factions. */}
      <nav className="bg-stone-900 border border-stone-800 rounded-xl p-2 self-start md:sticky md:top-20">
        {worldSections.map(s => (
          <button
            key={s.key}
            onClick={() => setWorldSection(s.key)}
            className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-left transition-colors ${
              worldSection === s.key
                ? 'bg-amber-600/20 text-amber-300 font-semibold'
                : 'text-stone-400 hover:bg-stone-800/60 hover:text-white'
            }`}
          >
            <span className="shrink-0">{s.icon}</span>
            <span className="flex-1 min-w-0 truncate">{s.label}</span>
            {s.count != null && s.count > 0 && (
              <span className="text-stone-600 text-xs shrink-0">{s.count}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="space-y-6 min-w-0">
        {worldSection === 'notes' && (
        <>
        {/* Notes privées MJ */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="min-w-0">
              <h2 className="text-stone-300 text-sm font-semibold">Notes privées MJ</h2>
              <p className="text-stone-500 text-xs mt-0.5">Visibles uniquement par vous — non partagées</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!dmNotesPreview && (
                <MicButton onTranscript={text => setDmNotesDraft(prev => prev ? prev + '\n' + text : text)} />
              )}
              {dmNotesDraft.trim() && (
                <button
                  onClick={() => setDmNotesPreview(v => !v)}
                  className={`text-xs transition-colors ${dmNotesPreview ? 'text-amber-400' : 'text-stone-500 hover:text-stone-300'}`}
                >
                  {dmNotesPreview ? '✎ Éditer' : '👁 Aperçu'}
                </button>
              )}
              {savingNotes && <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin shrink-0" />}
            </div>
          </div>
          {dmNotesPreview ? (
            <div className="min-h-[6rem]">
              <MarkdownText className="text-stone-200 text-sm">{dmNotesDraft}</MarkdownText>
            </div>
          ) : (
            <textarea
              value={dmNotesDraft}
              onChange={e => setDmNotesDraft(e.target.value)}
              onBlur={handleSaveDmNotes}
              placeholder="Notes de préparation, secrets, PNJ, lieux, intrigues…"
              rows={6}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors resize-y"
            />
          )}
        </div>

        </>
        )}

        {/* Tracker de PNJs */}
        {worldSection === 'npcs' && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">
              PNJ rencontrés ({(campaign.npcs ?? []).length})
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={npcSort}
                onChange={e => setNpcSort(e.target.value as typeof npcSort)}
                className="text-xs bg-stone-900 border border-stone-800 text-stone-500 rounded px-2 py-1 focus:outline-none transition-colors"
                title="Trier les PNJ"
              >
                <option value="default">Ordre d'ajout</option>
                <option value="name">Nom A→Z</option>
                <option value="status">Statut</option>
                <option value="faction">Faction</option>
              </select>
              {(campaign.npcs ?? []).length > 0 && (
                <button onClick={() => exportSection('pnj', campaign.npcs ?? [])} className="text-stone-600 hover:text-stone-400 text-xs transition-colors" title="Exporter les PNJ en JSON">⬇ Export</button>
              )}
              <label className="text-stone-600 hover:text-stone-400 text-xs transition-colors cursor-pointer" title="Importer des PNJ depuis un JSON">
                ⬆ Import<input type="file" accept=".json" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) importSectionData(f, 'npcs'); e.target.value = '' }} />
              </label>
              <button
                onClick={handleGenerateNpc}
                className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors"
              >
                ⚡ Générer
              </button>
              <button
                onClick={() => { setAddingNpc(v => !v); setNpcDraft({ name: '', role: '', status: 'inconnu', location: '', notes: '' }) }}
                className="text-violet-400 hover:text-violet-300 text-xs font-semibold transition-colors"
              >
                {addingNpc ? 'Annuler' : '+ Ajouter'}
              </button>
            </div>
          </div>

          {/* Générateur de PNJ */}
          {showNpcGenerator && generatedNpc && (
            <div className="bg-amber-950/30 border border-amber-800/30 rounded-xl p-4 mb-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-white font-bold text-base">{generatedNpc.name}</p>
                  <p className="text-amber-400 text-xs">{generatedNpc.race} · {generatedNpc.gender} · {generatedNpc.profession}</p>
                </div>
                <button onClick={() => setShowNpcGenerator(false)} className="text-stone-600 hover:text-stone-400 text-lg leading-none">×</button>
              </div>
              <div className="space-y-1.5 text-sm">
                <p className="text-stone-300"><span className="text-stone-500 text-xs">Apparence</span> {generatedNpc.appearance}</p>
                <p className="text-stone-300"><span className="text-stone-500 text-xs">Personnalité</span> {generatedNpc.personality}</p>
                <p className="text-stone-300"><span className="text-stone-500 text-xs">Lien</span> {generatedNpc.bond}</p>
                <p className="text-stone-300"><span className="text-stone-500 text-xs">Défaut</span> {generatedNpc.flaw}</p>
                <p className="text-stone-300"><span className="text-stone-500 text-xs">Voix</span> {generatedNpc.voice}</p>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={() => setGeneratedNpc(generateNpc())}
                  className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors"
                >
                  ↻ Régénérer
                </button>
                <button
                  onClick={handleSaveGeneratedNpc}
                  className="bg-violet-700 hover:bg-violet-600 text-white text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors"
                >
                  + Ajouter à la campagne
                </button>
              </div>
            </div>
          )}

          {addingNpc && (
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex gap-1">
                  <input
                    type="text"
                    placeholder="Nom *"
                    value={npcDraft.name}
                    onChange={e => setNpcDraft(d => ({ ...d, name: e.target.value }))}
                    autoFocus
                    className="flex-1 min-w-0 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-violet-500 transition-colors"
                  />
                  <select
                    onChange={e => setNpcDraft(d => ({ ...d, name: generateNpcName(e.target.value || undefined) }))}
                    className="bg-stone-800 border border-stone-700 rounded-lg px-1.5 py-2 text-stone-300 text-xs focus:outline-none focus:border-violet-500 transition-colors"
                    title="Générer un nom par race"
                    defaultValue=""
                  >
                    <option value="">🎲</option>
                    {NPC_RACES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <input
                  type="text"
                  placeholder="Rôle / occupation"
                  value={npcDraft.role}
                  onChange={e => setNpcDraft(d => ({ ...d, role: e.target.value }))}
                  className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <select
                  value={npcDraft.status}
                  onChange={e => setNpcDraft(d => ({ ...d, status: e.target.value as Npc['status'] }))}
                  className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
                >
                  <option value="inconnu">❓ Inconnu</option>
                  <option value="allié">🟢 Allié</option>
                  <option value="neutre">🟡 Neutre</option>
                  <option value="ennemi">🔴 Ennemi</option>
                </select>
                {(campaign?.locations ?? []).length > 0 && (
                  <select
                    value={npcDraft.location ?? ''}
                    onChange={e => setNpcDraft(d => ({ ...d, location: e.target.value }))}
                    className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
                  >
                    <option value="">📍 Lieu</option>
                    {(campaign?.locations ?? []).map((l, i) => (
                      <option key={i} value={l.name}>{l.name}</option>
                    ))}
                  </select>
                )}
                {(campaign?.factions ?? []).length > 0 && (
                  <select
                    value={npcDraft.faction ?? ''}
                    onChange={e => setNpcDraft(d => ({ ...d, faction: e.target.value }))}
                    className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
                  >
                    <option value="">⚔ Faction</option>
                    {(campaign?.factions ?? []).map((f, i) => (
                      <option key={i} value={f.name}>{f.name}</option>
                    ))}
                  </select>
                )}
                <input
                  type="text"
                  placeholder="Notes (secret, lien…)"
                  value={npcDraft.notes}
                  onChange={e => setNpcDraft(d => ({ ...d, notes: e.target.value }))}
                  className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-violet-500 transition-colors"
                />
                <button
                  onClick={handleAddNpc}
                  disabled={!npcDraft.name.trim()}
                  className="bg-violet-700 hover:bg-violet-600 disabled:opacity-40 text-white text-sm font-semibold rounded-lg px-4 py-2 transition-colors shrink-0"
                >
                  Ajouter
                </button>
              </div>
            </div>
          )}

          {(campaign.npcs ?? []).length === 0 && !addingNpc ? (
            <p className="text-stone-600 text-sm text-center py-6">Aucun PNJ enregistré. Ajoutez les personnages importants rencontrés par le groupe.</p>
          ) : (
            <>
              {/* Recherche par nom */}
              {(campaign.npcs ?? []).length > 1 && (
                <input
                  type="text"
                  value={npcSearch}
                  onChange={e => setNpcSearch(e.target.value)}
                  placeholder="Rechercher un PNJ…"
                  className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-1.5 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-stone-600 transition-colors mb-2"
                />
              )}

              {/* Filtre par statut */}
              {(campaign.npcs ?? []).length > 1 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(['all', 'allié', 'ennemi', 'neutre', 'inconnu'] as const).map(s => {
                    const count = s === 'all'
                      ? (campaign.npcs ?? []).length
                      : (campaign.npcs ?? []).filter(n => n.status === s).length
                    if (s !== 'all' && count === 0) return null
                    const label = s === 'all' ? `Tous (${count})` : `${s === 'allié' ? '🟢' : s === 'ennemi' ? '🔴' : s === 'neutre' ? '🟡' : '❓'} ${s[0].toUpperCase() + s.slice(1)} (${count})`
                    return (
                      <button
                        key={s}
                        onClick={() => setNpcStatusFilter(s)}
                        className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${
                          npcStatusFilter === s
                            ? 'bg-violet-900/60 border-violet-600/60 text-violet-300'
                            : 'bg-stone-800 border-stone-700 text-stone-500 hover:text-stone-300'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Filtre par faction */}
              {(() => {
                const usedFactions = [...new Set((campaign.npcs ?? []).map(n => n.faction).filter(Boolean))] as string[]
                if (usedFactions.length < 2) return null
                return (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {(['all', ...usedFactions]).map(f => {
                      const count = f === 'all' ? (campaign.npcs ?? []).length : (campaign.npcs ?? []).filter(n => n.faction === f).length
                      return (
                        <button
                          key={f}
                          onClick={() => setNpcFactionFilter(f)}
                          className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${
                            npcFactionFilter === f
                              ? 'bg-sky-900/60 border-sky-600/60 text-sky-300'
                              : 'bg-stone-800 border-stone-700 text-stone-500 hover:text-stone-300'
                          }`}
                        >
                          {f === 'all' ? `Toutes factions (${count})` : `${f} (${count})`}
                        </button>
                      )
                    })}
                  </div>
                )
              })()}

              {/* Filtre par lieu */}
              {(() => {
                const usedLocations = [...new Set((campaign.npcs ?? []).map(n => n.location).filter(Boolean))] as string[]
                if (usedLocations.length < 2) return null
                return (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {(['all', ...usedLocations]).map(l => {
                      const count = l === 'all' ? (campaign.npcs ?? []).length : (campaign.npcs ?? []).filter(n => n.location === l).length
                      return (
                        <button
                          key={l}
                          onClick={() => setNpcLocationFilter(l)}
                          className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${
                            npcLocationFilter === l
                              ? 'bg-emerald-900/60 border-emerald-600/60 text-emerald-300'
                              : 'bg-stone-800 border-stone-700 text-stone-500 hover:text-stone-300'
                          }`}
                        >
                          {l === 'all' ? `Tous lieux (${count})` : `📍 ${l} (${count})`}
                        </button>
                      )
                    })}
                  </div>
                )
              })()}

              <div className="space-y-2">
                {(campaign.npcs ?? [])
                  .map((npc, i) => ({ npc, i }))
                  .filter(({ npc }) => npcStatusFilter === 'all' || npc.status === npcStatusFilter)
                  .filter(({ npc }) => npcFactionFilter === 'all' || npc.faction === npcFactionFilter)
                  .filter(({ npc }) => npcLocationFilter === 'all' || npc.location === npcLocationFilter)
                  .filter(({ npc }) => !npcSearch || npc.name.toLowerCase().includes(npcSearch.toLowerCase()) || (npc.role ?? '').toLowerCase().includes(npcSearch.toLowerCase()))
                  .sort((a, b) => {
                    if (npcSort === 'name') return a.npc.name.localeCompare(b.npc.name, 'fr')
                    if (npcSort === 'status') { const order = ['allié', 'neutre', 'inconnu', 'ennemi']; return order.indexOf(a.npc.status) - order.indexOf(b.npc.status) }
                    if (npcSort === 'faction') return (a.npc.faction ?? '').localeCompare(b.npc.faction ?? '', 'fr')
                    return 0
                  })
                  .map(({ npc, i }) => {
                    const statusColor = npc.status === 'allié' ? 'text-emerald-400' : npc.status === 'ennemi' ? 'text-red-400' : npc.status === 'neutre' ? 'text-amber-400' : 'text-stone-400'
                    const statusIcon = npc.status === 'allié' ? '🟢' : npc.status === 'ennemi' ? '🔴' : npc.status === 'neutre' ? '🟡' : '❓'
                    return (
                      <div key={i} className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
                        {editingNpcIdx === i ? (
                          <div className="p-3 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                autoFocus
                                type="text"
                                value={editNpcDraft.name}
                                onChange={e => setEditNpcDraft(d => ({ ...d, name: e.target.value }))}
                                placeholder="Nom *"
                                className="bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1.5 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-violet-500"
                              />
                              <input
                                type="text"
                                value={editNpcDraft.role}
                                onChange={e => setEditNpcDraft(d => ({ ...d, role: e.target.value }))}
                                placeholder="Rôle"
                                className="bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1.5 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-violet-500"
                              />
                            </div>
                            <div className="flex gap-2">
                              <select
                                value={editNpcDraft.status}
                                onChange={e => setEditNpcDraft(d => ({ ...d, status: e.target.value as Npc['status'] }))}
                                className="bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1.5 text-white text-sm focus:outline-none focus:border-violet-500"
                              >
                                <option value="inconnu">❓ Inconnu</option>
                                <option value="allié">🟢 Allié</option>
                                <option value="neutre">🟡 Neutre</option>
                                <option value="ennemi">🔴 Ennemi</option>
                              </select>
                              {(campaign.locations ?? []).length > 0 && (
                                <select
                                  value={editNpcDraft.location ?? ''}
                                  onChange={e => setEditNpcDraft(d => ({ ...d, location: e.target.value }))}
                                  className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1.5 text-white text-sm focus:outline-none focus:border-violet-500"
                                >
                                  <option value="">📍 Lieu</option>
                                  {(campaign.locations ?? []).map((l, li) => (
                                    <option key={li} value={l.name}>{l.name}</option>
                                  ))}
                                </select>
                              )}
                              {(campaign.factions ?? []).length > 0 && (
                                <select
                                  value={editNpcDraft.faction ?? ''}
                                  onChange={e => setEditNpcDraft(d => ({ ...d, faction: e.target.value }))}
                                  className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1.5 text-white text-sm focus:outline-none focus:border-violet-500"
                                >
                                  <option value="">⚔ Faction</option>
                                  {(campaign.factions ?? []).map((f, fi) => (
                                    <option key={fi} value={f.name}>{f.name}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                            <textarea
                              value={editNpcDraft.notes}
                              onChange={e => setEditNpcDraft(d => ({ ...d, notes: e.target.value }))}
                              placeholder="Notes…"
                              rows={2}
                              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1.5 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-violet-500 resize-none"
                            />
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => setEditingNpcIdx(null)} className="text-stone-500 hover:text-stone-300 text-xs transition-colors">Annuler</button>
                              <button
                                onClick={() => handleUpdateNpc(i)}
                                disabled={!editNpcDraft.name.trim()}
                                className="bg-violet-700 hover:bg-violet-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors"
                              >
                                Sauvegarder
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-3 p-3">
                              <span className="text-base shrink-0">{statusIcon}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-stone-200 text-sm font-medium truncate">{npc.name}</p>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {npc.role && <p className="text-stone-500 text-xs truncate">{npc.role}</p>}
                                  {npc.location && <span className="text-xs text-sky-400/70">📍 {npc.location}</span>}
                                  {npc.faction && <span className="text-xs text-amber-400/70">⚔ {npc.faction}</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <select
                                  value={npc.status}
                                  onChange={e => handleUpdateNpcStatus(i, e.target.value as Npc['status'])}
                                  className={`bg-transparent text-xs border-none outline-none cursor-pointer ${statusColor}`}
                                >
                                  <option value="inconnu">Inconnu</option>
                                  <option value="allié">Allié</option>
                                  <option value="neutre">Neutre</option>
                                  <option value="ennemi">Ennemi</option>
                                </select>
                                <button
                                  onClick={() => { setEditNpcDraft({ ...npc }); setEditingNpcIdx(i); setExpandedNpc(null) }}
                                  className="text-stone-600 hover:text-stone-400 text-xs transition-colors"
                                  title="Modifier ce PNJ"
                                >
                                  ✎
                                </button>
                                {npc.notes && (
                                  <button
                                    onClick={() => setExpandedNpc(expandedNpc === i ? null : i)}
                                    className="text-stone-600 hover:text-stone-400 text-xs transition-colors"
                                  >
                                    {expandedNpc === i ? '▲' : '▼'}
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDuplicateNpc(i)}
                                  className="text-stone-700 hover:text-sky-400 text-xs transition-colors"
                                  title="Dupliquer ce PNJ"
                                >
                                  ⎘
                                </button>
                                <button
                                  onClick={() => handleDeleteNpc(i)}
                                  className="text-stone-700 hover:text-red-400 text-xs transition-colors"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                            {expandedNpc === i && npc.notes && (
                              <div className="px-4 pb-3 pt-2 border-t border-stone-800">
                                <div className="flex justify-end mb-1">
                                  <button onClick={() => copyToClipboard(`npc-${i}`, npc.notes)} className="text-stone-600 hover:text-stone-400 text-xs transition-colors" title="Copier">
                                    {copiedKey === `npc-${i}` ? '✓ Copié' : '📋'}
                                  </button>
                                </div>
                                <MarkdownText className="text-stone-400 text-xs">{npc.notes}</MarkdownText>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )
                  })}
              </div>
            </>
          )}
        </div>

        )}

        {/* Lieux */}
        {worldSection === 'locations' && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">
              Lieux ({(campaign?.locations ?? []).length})
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={locationSort}
                onChange={e => setLocationSort(e.target.value as typeof locationSort)}
                className="text-xs bg-stone-900 border border-stone-800 text-stone-500 rounded px-2 py-1 focus:outline-none transition-colors"
                title="Trier les lieux"
              >
                <option value="default">Ordre d'ajout</option>
                <option value="name">Nom A→Z</option>
                <option value="type">Type</option>
                <option value="status">Statut</option>
              </select>
              {(campaign?.locations ?? []).length > 0 && (
                <button onClick={() => exportSection('lieux', campaign?.locations ?? [])} className="text-stone-600 hover:text-stone-400 text-xs transition-colors" title="Exporter les lieux">⬇ Export</button>
              )}
              <label className="text-stone-600 hover:text-stone-400 text-xs transition-colors cursor-pointer" title="Importer des lieux">
                ⬆ Import<input type="file" accept=".json" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) importSectionData(f, 'locations'); e.target.value = '' }} />
              </label>
              <button
                onClick={() => { setAddingLocation(v => !v); setLocationDraft(emptyLocationDraft()) }}
                className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors"
              >
                {addingLocation ? 'Annuler' : '+ Ajouter'}
              </button>
            </div>
          </div>

          {addingLocation && (
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 mb-4 space-y-3">
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Nom du lieu *"
                  value={locationDraft.name}
                  onChange={e => setLocationDraft(d => ({ ...d, name: e.target.value }))}
                  autoFocus
                  className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                />
                <select
                  value={locationDraft.type}
                  onChange={e => setLocationDraft(d => ({ ...d, type: e.target.value as Location['type'] }))}
                  className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                >
                  <option value="ville">Ville</option>
                  <option value="donjon">Donjon</option>
                  <option value="forêt">Forêt</option>
                  <option value="taverne">Taverne</option>
                  <option value="temple">Temple</option>
                  <option value="château">Château</option>
                  <option value="autre">Autre</option>
                </select>
                <select
                  value={locationDraft.status}
                  onChange={e => setLocationDraft(d => ({ ...d, status: e.target.value as Location['status'] }))}
                  className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                >
                  <option value="inconnu">❓ Inconnu</option>
                  <option value="connu">◎ Connu</option>
                  <option value="exploré">✓ Exploré</option>
                </select>
                <select
                  value={locationDraft.reputation}
                  onChange={e => setLocationDraft(d => ({ ...d, reputation: e.target.value as Location['reputation'] }))}
                  className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                >
                  <option value="héros">★ Héros</option>
                  <option value="respecté">◆ Respecté</option>
                  <option value="neutre">— Neutre</option>
                  <option value="suspect">◇ Suspect</option>
                  <option value="recherché">✕ Recherché</option>
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-stone-600 text-xs">Notes</span>
                  <MicButton onTranscript={text => setLocationDraft(d => ({ ...d, notes: d.notes ? d.notes + '\n' + text : text }))} />
                </div>
                <textarea
                  placeholder="Notes (description, PNJ associés, indices…)"
                  value={locationDraft.notes}
                  onChange={e => setLocationDraft(d => ({ ...d, notes: e.target.value }))}
                  rows={3}
                  className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors resize-y"
                />
              </div>
              <div>
                <span className="text-stone-600 text-xs">Carte du lieu (plan de ville, de donjon…)</span>
                <ImagePicker
                  value={locationDraft.map_url ?? ''}
                  onChange={url => setLocationDraft(d => ({ ...d, map_url: url }))}
                  placeholder="URL du plan…"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleAddLocation}
                  disabled={!locationDraft.name.trim()}
                  className="text-amber-400 hover:text-amber-300 text-sm font-semibold transition-colors disabled:opacity-40"
                >
                  Ajouter
                </button>
              </div>
            </div>
          )}

          {(campaign?.locations ?? []).length > 1 && (
            <div className="space-y-2 mb-3">
              <input
                type="text"
                value={locationSearch}
                onChange={e => setLocationSearch(e.target.value)}
                placeholder="Rechercher un lieu…"
                className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-1.5 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-stone-600 transition-colors"
              />
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(['all', 'inconnu', 'connu', 'exploré'] as const).map(s => {
                const count = s === 'all'
                  ? (campaign?.locations ?? []).length
                  : (campaign?.locations ?? []).filter(l => l.status === s).length
                if (s !== 'all' && count === 0) return null
                const label = s === 'all' ? `Tous (${count})` : `${s === 'exploré' ? '✓' : s === 'connu' ? '◎' : '❓'} ${s[0].toUpperCase() + s.slice(1)} (${count})`
                return (
                  <button
                    key={s}
                    onClick={() => setLocationStatusFilter(s)}
                    className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${
                      locationStatusFilter === s
                        ? 'bg-amber-900/60 border-amber-600/60 text-amber-300'
                        : 'bg-stone-800 border-stone-700 text-stone-500 hover:text-stone-300'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            {(() => {
              const usedTypes = [...new Set((campaign?.locations ?? []).map(l => l.type).filter(Boolean))]
              if (usedTypes.length < 2) return null
              const typeIcons: Record<string, string> = { ville: '🏙', donjon: '⛏', forêt: '🌲', taverne: '🍺', temple: '⛪', château: '🏰', autre: '📍' }
              return (
                <div className="flex flex-wrap gap-1.5">
                  {(['all', ...usedTypes]).map(t => {
                    const count = t === 'all' ? (campaign?.locations ?? []).length : (campaign?.locations ?? []).filter(l => l.type === t).length
                    return (
                      <button
                        key={t}
                        onClick={() => setLocationTypeFilter(t)}
                        className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${
                          locationTypeFilter === t
                            ? 'bg-sky-900/60 border-sky-600/60 text-sky-300'
                            : 'bg-stone-800 border-stone-700 text-stone-500 hover:text-stone-300'
                        }`}
                      >
                        {t === 'all' ? `Tous types (${count})` : `${typeIcons[t] ?? '📍'} ${t[0].toUpperCase() + t.slice(1)} (${count})`}
                      </button>
                    )
                  })}
                </div>
              )
            })()}
            </div>
          )}

          {(campaign?.locations ?? []).length === 0 && !addingLocation ? (
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-8 text-center">
              <p className="text-stone-500 text-sm">
                Aucun lieu enregistré.{' '}
                <button onClick={() => setAddingLocation(true)} className="text-amber-400 hover:text-amber-300 transition-colors">
                  Ajouter le premier
                </button>
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {(campaign?.locations ?? []).map((loc, i) => ({ loc, i })).filter(({ loc }) => (locationStatusFilter === 'all' || loc.status === locationStatusFilter) && (locationTypeFilter === 'all' || loc.type === locationTypeFilter) && (!locationSearch || loc.name.toLowerCase().includes(locationSearch.toLowerCase()))).sort((a, b) => {
                if (locationSort === 'name') return a.loc.name.localeCompare(b.loc.name, 'fr')
                if (locationSort === 'type') return a.loc.type.localeCompare(b.loc.type, 'fr')
                if (locationSort === 'status') { const order = ['exploré', 'connu', 'inconnu']; return order.indexOf(a.loc.status) - order.indexOf(b.loc.status) }
                return 0
              }).map(({ loc, i }) => {
                const typeIcon = loc.type === 'ville' ? '🏙' : loc.type === 'donjon' ? '⛏' : loc.type === 'forêt' ? '🌲' : loc.type === 'taverne' ? '🍺' : loc.type === 'temple' ? '⛪' : loc.type === 'château' ? '🏰' : '📍'
                const statusColor = loc.status === 'exploré' ? 'text-emerald-400' : loc.status === 'connu' ? 'text-amber-400' : 'text-stone-500'
                const rep = loc.reputation ?? 'neutre'
                const repColor = rep === 'héros' ? 'text-amber-400' : rep === 'respecté' ? 'text-emerald-400' : rep === 'suspect' ? 'text-orange-400' : rep === 'recherché' ? 'text-red-400' : 'text-stone-500'
                const repBg   = rep === 'héros' ? 'bg-amber-900/30 border-amber-700/40' : rep === 'respecté' ? 'bg-emerald-900/30 border-emerald-700/40' : rep === 'suspect' ? 'bg-orange-900/30 border-orange-700/40' : rep === 'recherché' ? 'bg-red-900/30 border-red-700/40' : 'bg-stone-800/60 border-stone-700/40'
                const locNpcs = (campaign.npcs ?? []).filter(n => n.location === loc.name)
                return (
                  <div key={i} className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
                    {editingLocationIdx === i ? (
                      <div className="p-4 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            autoFocus
                            type="text"
                            value={editLocationDraft.name}
                            onChange={e => setEditLocationDraft(d => ({ ...d, name: e.target.value }))}
                            placeholder="Nom *"
                            className="bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1.5 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500"
                          />
                          <select
                            value={editLocationDraft.type}
                            onChange={e => setEditLocationDraft(d => ({ ...d, type: e.target.value as Location['type'] }))}
                            className="bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500"
                          >
                            <option value="ville">🏙 Ville</option>
                            <option value="donjon">⛏ Donjon</option>
                            <option value="forêt">🌲 Forêt</option>
                            <option value="taverne">🍺 Taverne</option>
                            <option value="temple">⛪ Temple</option>
                            <option value="château">🏰 Château</option>
                            <option value="autre">📍 Autre</option>
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <select
                            value={editLocationDraft.status}
                            onChange={e => setEditLocationDraft(d => ({ ...d, status: e.target.value as Location['status'] }))}
                            className="bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500"
                          >
                            <option value="inconnu">❓ Inconnu</option>
                            <option value="connu">◎ Connu</option>
                            <option value="exploré">✓ Exploré</option>
                          </select>
                          <select
                            value={editLocationDraft.reputation ?? 'neutre'}
                            onChange={e => setEditLocationDraft(d => ({ ...d, reputation: e.target.value as Location['reputation'] }))}
                            className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500"
                          >
                            <option value="héros">★ Héros</option>
                            <option value="respecté">◆ Respecté</option>
                            <option value="neutre">— Neutre</option>
                            <option value="suspect">◇ Suspect</option>
                            <option value="recherché">✕ Recherché</option>
                          </select>
                        </div>
                        <textarea
                          value={editLocationDraft.notes}
                          onChange={e => setEditLocationDraft(d => ({ ...d, notes: e.target.value }))}
                          placeholder="Notes…"
                          rows={2}
                          className="w-full bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1.5 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 resize-none"
                        />
                        <div>
                          <span className="text-stone-600 text-xs">Carte du lieu</span>
                          <ImagePicker
                            value={editLocationDraft.map_url ?? ''}
                            onChange={url => setEditLocationDraft(d => ({ ...d, map_url: url }))}
                            placeholder="URL du plan…"
                          />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditingLocationIdx(null)} className="text-stone-500 hover:text-stone-300 text-xs transition-colors">Annuler</button>
                          <button
                            onClick={() => handleUpdateLocation(i)}
                            disabled={!editLocationDraft.name.trim()}
                            className="bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors"
                          >
                            Sauvegarder
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start gap-3 p-4">
                          <span className="text-lg shrink-0 mt-0.5">{typeIcon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-stone-100 text-sm font-semibold">{loc.name}</span>
                              <span className="text-stone-600 text-xs capitalize">{loc.type}</span>
                              <select
                                value={loc.status}
                                onChange={e => handleUpdateLocationStatus(i, e.target.value as Location['status'])}
                                className={`text-xs bg-transparent border-none focus:outline-none cursor-pointer font-medium ${statusColor}`}
                              >
                                <option value="inconnu">❓ Inconnu</option>
                                <option value="connu">◎ Connu</option>
                                <option value="exploré">✓ Exploré</option>
                              </select>
                            </div>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <select
                                value={rep}
                                onChange={e => handleUpdateLocationReputation(i, e.target.value as Location['reputation'])}
                                className={`text-xs font-medium rounded border px-1.5 py-0.5 focus:outline-none cursor-pointer transition-colors ${repColor} ${repBg}`}
                                style={{ background: 'transparent' }}
                              >
                                <option value="héros">★ Héros</option>
                                <option value="respecté">◆ Respecté</option>
                                <option value="neutre">— Neutre</option>
                                <option value="suspect">◇ Suspect</option>
                                <option value="recherché">✕ Recherché</option>
                              </select>
                              {locNpcs.length > 0 && locNpcs.map((n, ni) => (
                                <span key={ni} className="text-xs text-violet-400/70 bg-violet-900/20 border border-violet-800/30 rounded px-1.5 py-0.5">{n.name}</span>
                              ))}
                              {(loc.notes || loc.map_url) && (
                                <button
                                  onClick={() => setExpandedLocation(expandedLocation === i ? null : i)}
                                  className="text-stone-500 hover:text-stone-300 text-xs transition-colors"
                                >
                                  {expandedLocation === i ? '▲ Masquer' : loc.map_url && !loc.notes ? '▼ Carte' : '▼ Détails'}
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleDuplicateLocation(i)}
                              className="text-stone-600 hover:text-sky-400 text-xs transition-colors"
                              title="Dupliquer ce lieu"
                            >⎘</button>
                            <button
                              onClick={() => { setEditLocationDraft({ ...loc }); setEditingLocationIdx(i); setExpandedLocation(null) }}
                              className="text-stone-600 hover:text-stone-400 text-xs transition-colors"
                              title="Modifier ce lieu"
                            >✎</button>
                            <button
                              onClick={() => handleDeleteLocation(i)}
                              title="Supprimer ce lieu"
                              className="text-stone-700 hover:text-red-400 text-sm transition-colors"
                            >✕</button>
                          </div>
                        </div>
                        {expandedLocation === i && (loc.notes || loc.map_url) && (
                          <div className="px-4 pb-4 border-t border-stone-800 pt-3 ml-8 space-y-3">
                            {loc.notes && (
                              <div>
                                <div className="flex justify-end mb-1">
                                  <button onClick={() => copyToClipboard(`loc-${i}`, loc.notes)} className="text-stone-600 hover:text-stone-400 text-xs transition-colors" title="Copier">
                                    {copiedKey === `loc-${i}` ? '✓ Copié' : '📋'}
                                  </button>
                                </div>
                                <MarkdownText className="text-stone-400 text-xs">{loc.notes}</MarkdownText>
                              </div>
                            )}
                            {loc.map_url && (
                              <a href={loc.map_url} target="_blank" rel="noopener noreferrer" title="Ouvrir la carte en grand">
                                <img src={loc.map_url} alt={`Carte de ${loc.name}`} className="w-full rounded-lg border border-stone-700" />
                              </a>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        )}

        {/* Carte de campagne */}
        {worldSection === 'map' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">Carte de campagne</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setEditingMapUrl(v => !v); setMapUrlDraft(campaign.campaign_map?.image_url ?? '') }}
                className="text-stone-500 hover:text-stone-300 text-xs transition-colors"
              >
                {campaign.campaign_map?.image_url ? '✎ Image' : '+ Image'}
              </button>
              {campaign.campaign_map?.image_url && (
                <button
                  onClick={() => { setMapAddingPin(v => !v); setPinLabelDraft('') }}
                  className={`text-xs font-medium rounded-lg px-2.5 py-1 border transition-colors ${
                    mapAddingPin
                      ? 'bg-sky-700/40 border-sky-500 text-sky-300'
                      : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-500'
                  }`}
                >
                  {mapAddingPin ? 'Annuler' : '📍 Épingle'}
                </button>
              )}
            </div>
          </div>

          {editingMapUrl && (
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 mb-4 space-y-3">
              <div>
                <label className="text-stone-500 text-xs block mb-1">Image de la carte</label>
                <ImagePicker
                  value={mapUrlDraft}
                  onChange={setMapUrlDraft}
                  placeholder="URL de l'image de la carte…"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setEditingMapUrl(false)} className="text-stone-500 text-xs hover:text-stone-300 transition-colors">Annuler</button>
                <button
                  onClick={handleSetMapUrl}
                  disabled={!mapUrlDraft.trim()}
                  className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg px-3 py-1.5 transition-colors"
                >
                  Définir
                </button>
              </div>
            </div>
          )}

          {mapAddingPin && (
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 mb-4 space-y-3">
              <p className="text-sky-400 text-xs">Saisissez le nom puis cliquez sur la carte pour placer l'épingle.</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={pinLabelDraft}
                  onChange={e => setPinLabelDraft(e.target.value)}
                  placeholder="Nom du lieu…"
                  autoFocus
                  className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                />
                <div className="flex gap-1 shrink-0">
                  {(['amber', 'red', 'blue', 'green', 'purple', 'sky'] as const).map(c => (
                    <button
                      key={c}
                      onClick={() => setPinColorDraft(c)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${
                        pinColorDraft === c ? 'border-white scale-125' : 'border-transparent opacity-60 hover:opacity-100'
                      } ${
                        c === 'amber' ? 'bg-amber-500' : c === 'red' ? 'bg-red-500' :
                        c === 'blue' ? 'bg-blue-500' : c === 'green' ? 'bg-emerald-500' :
                        c === 'purple' ? 'bg-purple-500' : 'bg-sky-500'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {campaign.campaign_map?.image_url ? (
            <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
              <div
                className={`relative select-none ${mapAddingPin ? 'cursor-crosshair' : ''}`}
                onClick={handleMapClick}
              >
                <img
                  src={campaign.campaign_map.image_url}
                  alt="Carte de campagne"
                  className="w-full object-contain max-h-[500px] pointer-events-none"
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                />
                {(campaign.campaign_map.pins ?? []).map(pin => {
                  const pinBg = pin.color === 'amber' ? 'bg-amber-600' : pin.color === 'red' ? 'bg-red-600' : pin.color === 'blue' ? 'bg-blue-600' : pin.color === 'green' ? 'bg-emerald-600' : pin.color === 'purple' ? 'bg-purple-600' : 'bg-sky-600'
                  const pinLine = pin.color === 'amber' ? 'bg-amber-500' : pin.color === 'red' ? 'bg-red-500' : pin.color === 'blue' ? 'bg-blue-500' : pin.color === 'green' ? 'bg-emerald-500' : pin.color === 'purple' ? 'bg-purple-500' : 'bg-sky-500'
                  const colorOptions: MapPin['color'][] = ['amber', 'red', 'blue', 'green', 'purple', 'sky']
                  const colorBg: Record<MapPin['color'], string> = { amber: 'bg-amber-500', red: 'bg-red-500', blue: 'bg-blue-500', green: 'bg-emerald-500', purple: 'bg-purple-500', sky: 'bg-sky-500' }
                  return (
                  <div
                    key={pin.id}
                    className="absolute group"
                    style={{ left: `${pin.x}%`, top: `${pin.y}%`, transform: 'translate(-50%, -100%)' }}
                    onClick={e => e.stopPropagation()}
                  >
                    {editingPinId === pin.id ? (
                      <div className="bg-stone-900 border border-stone-700 rounded-xl p-2.5 shadow-xl space-y-2 min-w-[180px]" style={{ transform: 'translateY(-8px)' }}>
                        <input
                          type="text"
                          value={editPinDraft.label}
                          onChange={e => setEditPinDraft(d => ({ ...d, label: e.target.value }))}
                          autoFocus
                          placeholder="Label *"
                          className="w-full bg-stone-800 border border-stone-700 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-amber-500"
                        />
                        <input
                          type="text"
                          value={editPinDraft.location_name ?? ''}
                          onChange={e => setEditPinDraft(d => ({ ...d, location_name: e.target.value }))}
                          placeholder="Lieu lié (optionnel)"
                          className="w-full bg-stone-800 border border-stone-700 rounded-lg px-2 py-1 text-stone-300 text-xs focus:outline-none focus:border-amber-500"
                        />
                        <div className="flex gap-1.5">
                          {colorOptions.map(c => (
                            <button
                              key={c}
                              onClick={() => setEditPinDraft(d => ({ ...d, color: c }))}
                              className={`w-4 h-4 rounded-full ${colorBg[c]} border-2 transition-transform ${editPinDraft.color === c ? 'border-white scale-125' : 'border-transparent opacity-60 hover:opacity-100'}`}
                            />
                          ))}
                        </div>
                        <div className="flex justify-between items-center">
                          <button onClick={() => setEditingPinId(null)} className="text-stone-500 hover:text-stone-300 text-xs transition-colors">Annuler</button>
                          <button onClick={() => handleUpdatePin(pin.id)} disabled={!editPinDraft.label.trim()} className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors disabled:opacity-40">OK</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className={`relative flex items-center gap-1 text-white text-xs font-semibold px-2 py-1 rounded-lg shadow-lg whitespace-nowrap ${pinBg}`}>
                          📍 {pin.label}
                          <button
                            onClick={() => { setEditingPinId(pin.id); setEditPinDraft({ label: pin.label, color: pin.color, location_name: pin.location_name ?? '' }) }}
                            className="ml-1 text-white/60 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity leading-none text-[10px]"
                            title="Modifier"
                          >✎</button>
                          <button
                            onClick={() => handleDeletePin(pin.id)}
                            className="text-white/60 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity leading-none"
                          >×</button>
                        </div>
                        {pin.location_name && (
                          <div className="text-center mt-0.5">
                            <span className="text-[10px] text-white/70 bg-stone-900/80 rounded px-1">{pin.location_name}</span>
                          </div>
                        )}
                        <div className={`absolute left-1/2 -translate-x-1/2 top-full w-0.5 h-2 ${pinLine}`} />
                      </>
                    )}
                  </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="border border-stone-800 border-dashed rounded-xl py-10 text-center">
              <p className="text-stone-600 text-sm">Aucune carte. Ajoutez une URL d'image pour visualiser votre monde.</p>
            </div>
          )}
        </div>

        )}

        {/* Factions */}
        {worldSection === 'factions' && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">
              Factions ({(campaign.factions ?? []).length})
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {(campaign.factions ?? []).length > 0 && (
                <button onClick={() => exportSection('factions', campaign.factions ?? [])} className="text-stone-600 hover:text-stone-400 text-xs transition-colors" title="Exporter les factions">⬇ Export</button>
              )}
              <label className="text-stone-600 hover:text-stone-400 text-xs transition-colors cursor-pointer" title="Importer des factions">
                ⬆ Import<input type="file" accept=".json" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) importSectionData(f, 'factions'); e.target.value = '' }} />
              </label>
              <button
                onClick={() => { setAddingFaction(v => !v); setFactionDraft(emptyFactionDraft()) }}
                className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors"
              >
                {addingFaction ? 'Annuler' : '+ Faction'}
              </button>
            </div>
          </div>

          {addingFaction && (
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 mb-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-stone-500 text-xs block mb-1">Nom *</label>
                  <input
                    type="text"
                    value={factionDraft.name}
                    onChange={e => setFactionDraft(d => ({ ...d, name: e.target.value }))}
                    autoFocus
                    placeholder="ex. La Guilde des Marchands"
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-stone-500 text-xs block mb-1">Description courte</label>
                  <input
                    type="text"
                    value={factionDraft.description}
                    onChange={e => setFactionDraft(d => ({ ...d, description: e.target.value }))}
                    placeholder="ex. Marchands influents de la capitale"
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-stone-500 text-xs">Notes</label>
                  <MicButton onTranscript={text => setFactionDraft(d => ({ ...d, notes: d.notes ? d.notes + '\n' + text : text }))} />
                </div>
                <textarea
                  value={factionDraft.notes}
                  onChange={e => setFactionDraft(d => ({ ...d, notes: e.target.value }))}
                  placeholder="Alliés, ennemis, objectifs…"
                  rows={2}
                  className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleAddFaction}
                  disabled={saving || !factionDraft.name.trim()}
                  className="bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold rounded-lg px-4 py-2 transition-colors disabled:opacity-40"
                >
                  Ajouter
                </button>
              </div>
            </div>
          )}

          {(campaign.factions ?? []).length > 2 && (
            <input
              type="text"
              value={factionSearch}
              onChange={e => setFactionSearch(e.target.value)}
              placeholder="Rechercher une faction…"
              className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-1.5 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-stone-600 transition-colors mb-2"
            />
          )}

          {(campaign.factions ?? []).length > 1 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {(['all', 'allied', 'neutral', 'enemy'] as const).map(f => {
                const facs = campaign.factions ?? []
                const count = f === 'all' ? facs.length : f === 'allied' ? facs.filter(fa => fa.reputation >= 2).length : f === 'neutral' ? facs.filter(fa => fa.reputation >= -1 && fa.reputation < 2).length : facs.filter(fa => fa.reputation < -1).length
                if (f !== 'all' && count === 0) return null
                const label = f === 'all' ? `Toutes (${count})` : f === 'allied' ? `🟢 Alliées (${count})` : f === 'neutral' ? `🟡 Neutres (${count})` : `🔴 Ennemies (${count})`
                return (
                  <button key={f} onClick={() => setFactionRepFilter(f)} className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${factionRepFilter === f ? 'bg-amber-900/60 border-amber-600/60 text-amber-300' : 'bg-stone-800 border-stone-700 text-stone-500 hover:text-stone-300'}`}>
                    {label}
                  </button>
                )
              })}
            </div>
          )}

          {(campaign.factions ?? []).length > 0 ? (
            <div className="space-y-2">
              {(campaign.factions ?? []).map((faction, i) => ({ faction, i })).filter(({ faction }) => (factionRepFilter === 'all' || (factionRepFilter === 'allied' && faction.reputation >= 2) || (factionRepFilter === 'neutral' && faction.reputation >= -1 && faction.reputation < 2) || (factionRepFilter === 'enemy' && faction.reputation < -1)) && (!factionSearch || faction.name.toLowerCase().includes(factionSearch.toLowerCase()) || (faction.description ?? '').toLowerCase().includes(factionSearch.toLowerCase()))).map(({ faction, i }) => {
                const rep = faction.reputation
                const repLabel = rep >= 4 ? 'Vénéré' : rep >= 2 ? 'Allié' : rep >= 0 ? 'Neutre' : rep >= -2 ? 'Suspect' : 'Ennemi'
                const repColor = rep >= 2 ? 'text-emerald-400' : rep >= 0 ? 'text-stone-400' : rep >= -2 ? 'text-amber-400' : 'text-red-400'
                const repDotColor = rep >= 2 ? 'bg-emerald-500' : rep >= 0 ? 'bg-stone-500' : rep >= -2 ? 'bg-amber-500' : 'bg-red-500'
                const factionNpcs = (campaign.npcs ?? []).filter(n => n.faction === faction.name)
                return (
                  <div key={i} className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
                    {editingFactionIdx === i ? (
                      <div className="p-4 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            autoFocus
                            type="text"
                            value={editFactionDraft.name}
                            onChange={e => setEditFactionDraft(d => ({ ...d, name: e.target.value }))}
                            placeholder="Nom *"
                            className="bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1.5 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500"
                          />
                          <input
                            type="text"
                            value={editFactionDraft.description}
                            onChange={e => setEditFactionDraft(d => ({ ...d, description: e.target.value }))}
                            placeholder="Description courte"
                            className="bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1.5 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <textarea
                          value={editFactionDraft.notes}
                          onChange={e => setEditFactionDraft(d => ({ ...d, notes: e.target.value }))}
                          placeholder="Notes…"
                          rows={2}
                          className="w-full bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1.5 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 resize-none"
                        />
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditingFactionIdx(null)} className="text-stone-500 hover:text-stone-300 text-xs transition-colors">Annuler</button>
                          <button
                            onClick={() => handleUpdateFaction(i)}
                            disabled={!editFactionDraft.name.trim()}
                            className="bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors"
                          >Sauvegarder</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div
                          className="flex items-center gap-3 p-4 cursor-pointer hover:bg-stone-800/50 transition-colors"
                          onClick={() => setExpandedFaction(expandedFaction === i ? null : i)}
                        >
                          <div className={`w-2 h-2 rounded-full shrink-0 ${repDotColor}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium">{faction.name}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              {faction.description && <p className="text-stone-500 text-xs truncate">{faction.description}</p>}
                              {factionNpcs.length > 0 && factionNpcs.map((n, ni) => (
                                <span key={ni} className="text-xs text-violet-400/70 bg-violet-900/20 border border-violet-800/30 rounded px-1.5 py-0.5">{n.name}</span>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className={`text-xs font-medium ${repColor}`}>{repLabel}</span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={e => { e.stopPropagation(); handleUpdateFactionReputation(i, -1) }}
                                disabled={rep <= -5}
                                className="w-6 h-6 rounded bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white text-sm font-bold transition-colors disabled:opacity-30 flex items-center justify-center"
                              >−</button>
                              <span className="text-stone-300 text-xs w-5 text-center font-mono">{rep > 0 ? `+${rep}` : rep}</span>
                              <button
                                onClick={e => { e.stopPropagation(); handleUpdateFactionReputation(i, +1) }}
                                disabled={rep >= 5}
                                className="w-6 h-6 rounded bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white text-sm font-bold transition-colors disabled:opacity-30 flex items-center justify-center"
                              >+</button>
                            </div>
                            <button
                              onClick={e => { e.stopPropagation(); handleDuplicateFaction(i) }}
                              className="text-stone-600 hover:text-sky-400 text-xs transition-colors"
                              title="Dupliquer cette faction"
                            >⎘</button>
                            <button
                              onClick={e => { e.stopPropagation(); setEditFactionDraft({ ...faction }); setEditingFactionIdx(i); setExpandedFaction(null) }}
                              className="text-stone-600 hover:text-stone-400 text-xs transition-colors"
                              title="Modifier cette faction"
                            >✎</button>
                            <button
                              onClick={e => { e.stopPropagation(); handleDeleteFaction(i) }}
                              className="text-stone-600 hover:text-red-400 text-lg leading-none transition-colors"
                            >×</button>
                          </div>
                        </div>
                        {/* Reputation bar */}
                        <div className="px-4 pb-1">
                          <div className="h-1 bg-stone-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${repDotColor}`} style={{ width: `${((rep + 5) / 10) * 100}%` }} />
                          </div>
                        </div>
                        {expandedFaction === i && (
                          <div className="px-4 pb-4 pt-2 border-t border-stone-800">
                            {faction.notes ? (
                              <>
                                <div className="flex justify-end mb-1">
                                  <button onClick={() => copyToClipboard(`faction-${i}`, faction.notes)} className="text-stone-600 hover:text-stone-400 text-xs transition-colors" title="Copier">
                                    {copiedKey === `faction-${i}` ? '✓ Copié' : '📋'}
                                  </button>
                                </div>
                                <MarkdownText className="text-stone-400 text-sm">{faction.notes}</MarkdownText>
                              </>
                            ) : (
                              <p className="text-stone-600 text-xs italic">Aucune note.</p>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            !addingFaction && (
              <p className="text-stone-600 text-sm text-center py-4">Aucune faction. Ajoutez des organisations pour suivre la réputation des PJs.</p>
            )
          )}
        </div>
        )}
      </div>
    </div>
  )
}
