import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  updateCampaign, createCampaign,
  type GameCalendar, type Npc, type Quest, type Faction, type TreasureItem, type Location,
  type RandomTable, type CustomMonster, type SavedEncounter, type CampaignMap,
} from '../../api/campaigns'
import { createChapter, type Chapter } from '../../api/chapters'
import { importCharacter } from '../../api/characters'
import { generateShareToken, revokeShareToken } from '../../api/share'
import { archiveFilename, buildCampaignZip, parseCampaignArchive, ArchiveError } from '../../lib/campaignArchive'
import { ZipError } from '../../lib/zip'
import { useToast } from '../../contexts/ToastContext'
import type { SectionProps } from './shared'

/**
 * Section « Campagne » : vue d'ensemble, partage du lien joueurs, calendrier,
 * export / import d'archive.
 *
 * Le brouillon de calendrier était initialisé par l'effet de chargement de la
 * coquille ; il s'initialise désormais ici, depuis la campagne.
 */
export default function CampaignOverviewSection({
  campaign, setCampaign, chapters, saving, setSaving,
}: SectionProps) {
  const navigate = useNavigate()
  const toast = useToast()

  // Édition en ligne du nom / de la description de la campagne.
  const [editing, setEditing]       = useState(false)
  const [nameDraft, setNameDraft]   = useState('')
  const [descDraft, setDescDraft]   = useState('')

  const [copied, setCopied] = useState(false)
  const [calendarDraft, setCalendarDraft] = useState<Partial<GameCalendar>>({})
  const [savingCalendar, setSavingCalendar] = useState(false)
  const [importing, setImporting] = useState(false)
  const [showAudit, setShowAudit] = useState(false)
  function startEdit() {
    if (!campaign) return
    setNameDraft(campaign.name)
    setDescDraft(campaign.description ?? '')
    setEditing(true)
  }
  async function saveEdit() {
    if (!campaign) return
    setSaving(true)
    try {
      const updated = await updateCampaign(campaign.id, {
        name: nameDraft.trim() || campaign.name,
        description: descDraft.trim() || undefined,
      })
      setCampaign(updated)
      setEditing(false)
    } finally { setSaving(false) }
  }
  async function handleShare() {
    if (!campaign) return
    setSaving(true)
    try {
      const updated = await generateShareToken(campaign.id)
      setCampaign(updated)
    } finally { setSaving(false) }
  }
  async function handleRevoke() {
    if (!campaign) return
    setSaving(true)
    try {
      const updated = await revokeShareToken(campaign.id)
      setCampaign(updated)
    } finally { setSaving(false) }
  }
  function copyLink() {
    if (!campaign?.share_token) return
    navigator.clipboard.writeText(`${window.location.origin}/share/${campaign.share_token}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  async function handleSaveCalendar(patch: Partial<GameCalendar>) {
    if (!campaign) return
    const next = { ...calendarDraft, ...patch }
    setCalendarDraft(next)
    setSavingCalendar(true)
    try {
      const updated = await updateCampaign(campaign.id, { game_calendar: next })
      setCampaign(updated)
    } finally { setSavingCalendar(false) }
  }
  /** Le scénario entier, dans l'ordre des chapitres — terminés compris. */
  function handleExportScenario() {
    if (!campaign || chapters.length === 0) return
    const sorted = [...chapters].sort((a, b) =>
      Number(a.done) - Number(b.done) || a.position - b.position || a.id - b.id,
    )
    const lines: string[] = [`# ${campaign.name}`, '']
    for (const c of sorted) {
      lines.push(`## ${c.title}${c.done ? ' ✓' : ''}`)
      if (c.xp_awarded != null) lines.push(`> +${c.xp_awarded.toLocaleString('fr-FR')} XP`)
      if (c.loot_notes) lines.push(`> 🎁 ${c.loot_notes}`)
      if (c.xp_awarded != null || c.loot_notes) lines.push('')
      if (c.notes) { lines.push(c.notes); lines.push('') }
      lines.push('---', '')
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${campaign.name.replace(/[^a-z0-9]/gi, '_')}_scenario.md`
    a.click()
    URL.revokeObjectURL(url)
  }
  function handleExportCampaign() {
    if (!campaign) return
    const blob = buildCampaignZip(campaign, campaign.characters ?? [], chapters)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = archiveFilename(campaign.name)
    a.click()
    URL.revokeObjectURL(url)
  }
  async function handleImportCampaign(file: File) {
    setImporting(true)
    try {
      const { campaign: data, characters } = await parseCampaignArchive(file)
      const newCampaign = await createCampaign(
        (data.name as string) ?? 'Campagne importée',
        (data.description as string) ?? null,
      )
      await updateCampaign(newCampaign.id, {
        dm_notes: (data.dm_notes as string) ?? null,
        npcs: (data.npcs as Npc[]) ?? [],
        locations: (data.locations as Location[]) ?? [],
        party_treasury: (data.party_treasury as TreasureItem[]) ?? [],
        saved_encounters: (data.saved_encounters as SavedEncounter[]) ?? [],
        custom_monsters: (data.custom_monsters as CustomMonster[]) ?? [],
        factions: (data.factions as Faction[]) ?? [],
        random_tables: (data.random_tables as RandomTable[]) ?? [],
        game_calendar: (data.game_calendar as GameCalendar) ?? {},
        quests: (data.quests as Quest[]) ?? [],
        campaign_map: (data.campaign_map as CampaignMap) ?? null,
      })
      // Les archives d'avant les chapitres portent une clé « sessions » : on la relit,
      // sa date en moins — un chapitre n'en a pas.
      const archived = (data.chapters ?? data.sessions) as Chapter[] | undefined
      if (Array.isArray(archived)) {
        for (const c of archived) {
          await createChapter(newCampaign.id, {
            title: c.title,
            notes: c.notes,
            xp_awarded: c.xp_awarded ?? null,
            loot_notes: c.loot_notes ?? null,
            done: c.done ?? true,
            prep: c.prep ?? null,
          })
        }
      }
      for (const archived of characters) {
        await importCharacter(newCampaign.id, archived)
      }
      navigate(`/campaigns/${newCampaign.id}`)
    } catch (err) {
      toast.error(err instanceof ZipError || err instanceof ArchiveError
        ? err.message
        : 'Fichier invalide ou corrompu.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
        {/* Campaign identity */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
          {editing ? (
            <div className="space-y-3">
              <input
                type="text"
                value={nameDraft}
                onChange={e => setNameDraft(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white font-semibold text-lg focus:outline-none focus:border-amber-500 transition-colors"
              />
              <textarea
                value={descDraft}
                onChange={e => setDescDraft(e.target.value)}
                placeholder="Description…"
                rows={2}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors resize-none"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setEditing(false)}
                  className="text-stone-500 hover:text-stone-300 text-sm transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="text-amber-400 hover:text-amber-300 text-sm font-semibold transition-colors disabled:opacity-40"
                >
                  Enregistrer
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-white text-xl font-bold">{campaign.name}</h1>
                {campaign.description && (
                  <p className="text-stone-400 text-sm mt-1">{campaign.description}</p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
                <button
                  onClick={handleExportCampaign}
                  title="Exporter la campagne et ses personnages (archive ZIP)"
                  className="text-stone-500 hover:text-stone-300 text-sm transition-colors"
                >
                  ↓ Export
                </button>
                {chapters.length > 0 && (
                  <button
                    onClick={handleExportScenario}
                    title="Exporter le scénario (tous les chapitres) en Markdown"
                    className="text-stone-500 hover:text-stone-300 text-sm transition-colors"
                  >
                    ↓ Scénario
                  </button>
                )}
                <label
                  title="Importer une campagne depuis une archive ZIP (ou un ancien JSON)"
                  className="text-stone-500 hover:text-stone-300 text-sm transition-colors cursor-pointer"
                >
                  {importing ? '…' : '↑ Import'}
                  <input
                    type="file"
                    accept=".zip,.json"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleImportCampaign(f); e.target.value = '' }}
                  />
                </label>
                <button
                  onClick={startEdit}
                  className="text-stone-500 hover:text-stone-300 text-sm transition-colors"
                >
                  Modifier
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Audit de campagne */}
        {(() => {
          const npcNames = new Set((campaign.npcs ?? []).map(n => n.name.toLowerCase()))
          const locationNames = new Set((campaign.locations ?? []).map(l => l.name.toLowerCase()))
          const factionNames = new Set((campaign.factions ?? []).map(f => f.name.toLowerCase()))
          const monsterNames = new Set([...(campaign.custom_monsters ?? []).map(m => m.name)])

          const issues: { type: string; msg: string }[] = []

          ;(campaign.quests ?? []).filter(q => q.giver && q.giver.trim()).forEach(q => {
            if (!npcNames.has(q.giver.toLowerCase())) {
              issues.push({ type: 'quête', msg: `Quête «${q.title}» — donneur «${q.giver}» introuvable dans les PNJs` })
            }
          })
          ;(campaign.npcs ?? []).filter(n => n.faction && n.faction.trim()).forEach(n => {
            if (!factionNames.has(n.faction!.toLowerCase())) {
              issues.push({ type: 'pnj', msg: `PNJ «${n.name}» — faction «${n.faction}» introuvable` })
            }
          })
          ;(campaign.npcs ?? []).filter(n => n.location && n.location.trim()).forEach(n => {
            if (!locationNames.has(n.location!.toLowerCase())) {
              issues.push({ type: 'pnj', msg: `PNJ «${n.name}» — lieu «${n.location}» introuvable` })
            }
          })
          ;(campaign.saved_encounters ?? []).forEach(enc => {
            enc.entries.forEach(e => {
              if (!monsterNames.has(e.monster_name)) {
                issues.push({ type: 'rencontre', msg: `Rencontre «${enc.name}» — monstre «${e.monster_name}» introuvable dans le bestiaire custom` })
              }
            })
          })

          return (
            <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowAudit(v => !v)}
                className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-stone-800/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-stone-300 text-sm font-semibold">Rapport d'audit</span>
                  {issues.length > 0 && (
                    <span className="text-xs bg-amber-900/60 border border-amber-700/50 text-amber-300 rounded-full px-2 py-0.5">
                      {issues.length} problème{issues.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <span className="text-stone-500 text-xs">{showAudit ? '▲' : '▼'}</span>
              </button>
              {showAudit && (
                <div className="px-5 pb-5 border-t border-stone-800 pt-4">
                  {issues.length === 0 ? (
                    <p className="text-emerald-400 text-sm">✓ Aucun problème détecté dans la campagne.</p>
                  ) : (
                    <div className="space-y-2">
                      {issues.map((issue, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <span className={`shrink-0 text-xs font-medium rounded px-1.5 py-0.5 mt-0.5 ${
                            issue.type === 'quête' ? 'bg-amber-900/40 text-amber-400' : issue.type === 'pnj' ? 'bg-violet-900/40 text-violet-400' : 'bg-red-900/40 text-red-400'
                          }`}>{issue.type}</span>
                          <span className="text-stone-400 text-xs leading-relaxed">{issue.msg}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })()}

        {/* Share / Vue MJ */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-stone-300 text-sm font-semibold">Vue MJ</h2>
              <p className="text-stone-500 text-xs mt-0.5">
                Lien en lecture seule — HP, conditions et initiative en temps réel
              </p>
            </div>
            {campaign.share_token ? (
              <button
                onClick={handleRevoke}
                disabled={saving}
                className="text-red-500 hover:text-red-400 text-xs transition-colors disabled:opacity-40"
              >
                Révoquer
              </button>
            ) : (
              <button
                onClick={handleShare}
                disabled={saving}
                className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors disabled:opacity-40"
              >
                Créer le lien
              </button>
            )}
          </div>

          {campaign.share_token && (
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-stone-800 text-stone-400 text-xs rounded-lg px-3 py-2 truncate font-mono">
                {window.location.origin}/share/{campaign.share_token}
              </code>
              <button
                onClick={copyLink}
                className={`shrink-0 text-xs font-semibold px-3 py-2 rounded-lg transition-colors ${
                  copied
                    ? 'bg-emerald-700 text-emerald-200'
                    : 'bg-stone-700 hover:bg-stone-600 text-stone-300'
                }`}
              >
                {copied ? 'Copié !' : 'Copier'}
              </button>
              <a
                href={`/share/${campaign.share_token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-xs text-stone-500 hover:text-stone-300 transition-colors px-2 py-2"
              >
                Ouvrir
              </a>
            </div>
          )}
        </div>

        {/* Calendrier de campagne */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-stone-300 text-sm font-semibold">Calendrier de campagne</h2>
            {savingCalendar && <div className="w-3 h-3 border-2 border-sky-400 border-t-transparent rounded-full animate-spin shrink-0" />}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-stone-500 text-xs block mb-1">Date en jeu</label>
              <input
                type="text"
                placeholder="ex. 14 Marpenoth, an 1492…"
                value={calendarDraft.date ?? ''}
                onChange={e => setCalendarDraft(d => ({ ...d, date: e.target.value }))}
                onBlur={() => handleSaveCalendar({ date: calendarDraft.date })}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-stone-500 text-xs block mb-1">Météo</label>
              <input
                type="text"
                placeholder="ex. Ensoleillé, Orage, Brouillard…"
                value={calendarDraft.weather ?? ''}
                onChange={e => setCalendarDraft(d => ({ ...d, weather: e.target.value }))}
                onBlur={() => handleSaveCalendar({ weather: calendarDraft.weather })}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-stone-500 text-xs block mb-1">Note rapide</label>
              <input
                type="text"
                placeholder="ex. Pleine lune, marché à Phandalin…"
                value={calendarDraft.notes ?? ''}
                onChange={e => setCalendarDraft(d => ({ ...d, notes: e.target.value }))}
                onBlur={() => handleSaveCalendar({ notes: calendarDraft.notes })}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>
          </div>
        </div>

    </>
  )
}
