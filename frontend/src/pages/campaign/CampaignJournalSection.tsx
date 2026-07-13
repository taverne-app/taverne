import { useState, useMemo } from 'react'
import { updateCampaign, type Milestone } from '../../api/campaigns'
import {
  createSession, updateSession, deleteSession, type CampaignSession,
} from '../../api/sessions'
import { updateIdentity } from '../../api/characters'
import { MarkdownText } from '../../components/MarkdownText'
import { MicButton } from '../../components/MicButton'
import type { SectionProps } from './shared'
import { uuid } from './shared'

/**
 * Section « Journal » : séances jouées et jalons de campagne (frise chronologique).
 *
 * Les séances sont chargées par la coquille (elles servent aussi ailleurs) et
 * passées en props ; le reste de l'état appartient à cette section.
 */
export default function CampaignJournalSection({
  campaign, setCampaign, characters, setCharacters, saving, setSaving,
  sessions: allSessions, setSessions,
}: SectionProps) {

  /**
   * Le journal, ce sont les séances JOUÉES. Les séances à venir sont affichées
   * au-dessus, dans la file de préparation : les lister ici les montrerait deux fois.
   */
  const sessions = useMemo(() => allSessions.filter(s => s.status !== 'planned'), [allSessions])

  const emptySessionDraft = () => ({ title: '', session_date: '', notes: '', xp_awarded: '', loot_notes: '' })
  const [addingSession, setAddingSession]     = useState(false)
  const [sessionDraft, setSessionDraft]       = useState(emptySessionDraft())
  const [editingSession, setEditingSession]   = useState<number | null>(null)
  const [editSessionDraft, setEditSessionDraft] = useState(emptySessionDraft())
  const [expandedSession, setExpandedSession] = useState<number | null>(null)
  const [sessionView, setSessionView] = useState<'list' | 'timeline'>('list')
  const [sessionSearch, setSessionSearch] = useState('')
  const [sessionSort, setSessionSort] = useState<'newest' | 'oldest' | 'title'>('newest')
  const emptyMilestone = (): Omit<Milestone, 'id'> => ({ date: '', title: '', type: 'other', notes: '' })
  const [addingMilestone, setAddingMilestone] = useState(false)
  const [milestoneDraft, setMilestoneDraft] = useState<Omit<Milestone, 'id'>>(emptyMilestone())
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null)
  const [editMilestoneDraft, setEditMilestoneDraft] = useState<Omit<Milestone, 'id'>>(emptyMilestone())
  const [milestoneTypeFilter, setMilestoneTypeFilter] = useState<'all' | Milestone['type']>('all')
  const [milestoneSearch, setMilestoneSearch] = useState('')
  const [timelineSort, setTimelineSort] = useState<'newest' | 'oldest'>('newest')
  async function handleCreateSession() {
    if (!campaign || !sessionDraft.title.trim()) return
    setSaving(true)
    try {
      const s = await createSession(campaign.id, {
        title: sessionDraft.title.trim(),
        session_date: sessionDraft.session_date || null,
        notes: sessionDraft.notes || null,
        xp_awarded: sessionDraft.xp_awarded ? parseInt(sessionDraft.xp_awarded, 10) || null : null,
        loot_notes: sessionDraft.loot_notes.trim() || null,
        status: 'played',
      })
      setSessions(prev => [s, ...prev])
      setAddingSession(false)
      setSessionDraft(emptySessionDraft())
      setExpandedSession(s.id)
    } finally { setSaving(false) }
  }
  async function handleUpdateSession(sessionId: number) {
    if (!campaign) return
    setSaving(true)
    try {
      const updated = await updateSession(campaign.id, sessionId, {
        title: editSessionDraft.title.trim(),
        session_date: editSessionDraft.session_date || null,
        notes: editSessionDraft.notes || null,
        xp_awarded: editSessionDraft.xp_awarded ? parseInt(editSessionDraft.xp_awarded, 10) || null : null,
        loot_notes: editSessionDraft.loot_notes.trim() || null,
      })
      setSessions(prev => prev.map(s => s.id === sessionId ? updated : s))
      setEditingSession(null)
    } finally { setSaving(false) }
  }
  async function handleDistributeSessionXp(sessionId: number, xpAmount: number) {
    if (!campaign || characters.length === 0) return
    setSaving(true)
    try {
      const perChar = Math.floor(xpAmount / characters.length)
      const updated = await Promise.all(
        characters.map(c => updateIdentity(c.id, { experience_points: c.experience_points + perChar }))
      )
      setCharacters(updated)
      const updatedSession = await updateSession(campaign.id, sessionId, { xp_distributed: true })
      setSessions(prev => prev.map(s => s.id === sessionId ? updatedSession : s))
    } finally { setSaving(false) }
  }
  async function handleDeleteSession(sessionId: number) {
    if (!campaign) return
    await deleteSession(campaign.id, sessionId)
    setSessions(prev => prev.filter(s => s.id !== sessionId))
    if (editingSession === sessionId) setEditingSession(null)
    if (expandedSession === sessionId) setExpandedSession(null)
  }
  async function handleAddMilestone() {
    if (!campaign || !milestoneDraft.title.trim()) return
    const milestone: Milestone = { ...milestoneDraft, id: uuid(), title: milestoneDraft.title.trim() }
    const next = [...(campaign.campaign_milestones ?? []), milestone]
    const updated = await updateCampaign(campaign.id, { campaign_milestones: next })
    setCampaign(updated)
    setMilestoneDraft(emptyMilestone())
    setAddingMilestone(false)
  }
  async function handleDeleteMilestone(id: string) {
    if (!campaign) return
    const next = (campaign.campaign_milestones ?? []).filter(m => m.id !== id)
    const updated = await updateCampaign(campaign.id, { campaign_milestones: next })
    setCampaign(updated)
  }
  async function handleUpdateMilestone(id: string) {
    if (!campaign || !editMilestoneDraft.title.trim()) return
    const next = (campaign.campaign_milestones ?? []).map(m =>
      m.id === id ? { ...editMilestoneDraft, id, title: editMilestoneDraft.title.trim() } : m
    )
    const updated = await updateCampaign(campaign.id, { campaign_milestones: next })
    setCampaign(updated)
    setEditingMilestoneId(null)
  }

  return (
    <>
        {/* Sessions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">
                Journal de sessions ({sessions.length})
              </h2>
              {sessions.length > 1 && (
                <div className="flex rounded overflow-hidden border border-stone-700">
                  <button
                    onClick={() => setSessionView('list')}
                    className={`text-xs px-2 py-0.5 transition-colors ${sessionView === 'list' ? 'bg-stone-700 text-stone-100' : 'text-stone-500 hover:text-stone-300'}`}
                  >Liste</button>
                  <button
                    onClick={() => setSessionView('timeline')}
                    className={`text-xs px-2 py-0.5 transition-colors ${sessionView === 'timeline' ? 'bg-stone-700 text-stone-100' : 'text-stone-500 hover:text-stone-300'}`}
                  >Frise</button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setAddingMilestone(v => !v); setMilestoneDraft(emptyMilestone()) }}
                className="text-sky-400 hover:text-sky-300 text-xs font-semibold transition-colors"
              >
                {addingMilestone ? 'Annuler' : '⭐ Jalon'}
              </button>
              <button
                onClick={() => { setAddingSession(v => !v); setSessionDraft({ title: '', session_date: '', notes: '', xp_awarded: '', loot_notes: '' }) }}
                className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors"
              >
                {addingSession ? 'Annuler' : '+ Nouvelle session'}
              </button>
            </div>
          </div>

          {/* Add session form */}
          {addingSession && (
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 mb-4 space-y-3">
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Titre de la session *"
                  value={sessionDraft.title}
                  onChange={e => setSessionDraft(d => ({ ...d, title: e.target.value }))}
                  autoFocus
                  className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                />
                <input
                  type="date"
                  value={sessionDraft.session_date}
                  onChange={e => setSessionDraft(d => ({ ...d, session_date: e.target.value }))}
                  className="w-40 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-stone-500 text-xs shrink-0">XP distribué</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={sessionDraft.xp_awarded}
                    onChange={e => setSessionDraft(d => ({ ...d, xp_awarded: e.target.value }))}
                    min={0}
                    className="w-28 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Butins & récompenses (résumé)"
                  value={sessionDraft.loot_notes}
                  onChange={e => setSessionDraft(d => ({ ...d, loot_notes: e.target.value }))}
                  className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-stone-600 text-xs">Notes</span>
                  <MicButton onTranscript={text => setSessionDraft(d => ({ ...d, notes: d.notes ? d.notes + '\n' + text : text }))} />
                </div>
                <textarea
                  placeholder={"Notes de la session…\n\nSyntaxe : ## Titre  **gras**  *italique*  - liste  ---"}
                  value={sessionDraft.notes}
                  onChange={e => setSessionDraft(d => ({ ...d, notes: e.target.value }))}
                  rows={5}
                  className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors resize-y font-mono"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleCreateSession}
                  disabled={saving || !sessionDraft.title.trim()}
                  className="text-amber-400 hover:text-amber-300 text-sm font-semibold transition-colors disabled:opacity-40"
                >
                  Créer
                </button>
              </div>
            </div>
          )}

          {/* Add milestone form */}
          {addingMilestone && (
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 mb-4 space-y-3">
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Titre du jalon *"
                  value={milestoneDraft.title}
                  onChange={e => setMilestoneDraft(d => ({ ...d, title: e.target.value }))}
                  autoFocus
                  className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-sky-500 transition-colors"
                />
                <input
                  type="date"
                  value={milestoneDraft.date}
                  onChange={e => setMilestoneDraft(d => ({ ...d, date: e.target.value }))}
                  className="w-40 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500 transition-colors"
                />
              </div>
              <div className="flex gap-3">
                <select
                  value={milestoneDraft.type}
                  onChange={e => setMilestoneDraft(d => ({ ...d, type: e.target.value as Milestone['type'] }))}
                  className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500 transition-colors"
                >
                  <option value="discovery">🔍 Découverte</option>
                  <option value="death">💀 Mort / perte</option>
                  <option value="arc">🏆 Arc narratif</option>
                  <option value="combat">⚔ Combat notable</option>
                  <option value="other">⭐ Autre</option>
                </select>
                <input
                  type="text"
                  placeholder="Notes optionnelles…"
                  value={milestoneDraft.notes}
                  onChange={e => setMilestoneDraft(d => ({ ...d, notes: e.target.value }))}
                  className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-sky-500 transition-colors"
                />
                <button
                  onClick={handleAddMilestone}
                  disabled={!milestoneDraft.title.trim()}
                  className="text-sky-400 hover:text-sky-300 text-sm font-semibold transition-colors disabled:opacity-40"
                >
                  Ajouter
                </button>
              </div>
            </div>
          )}

          {sessions.length === 0 && !addingSession ? (
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-8 text-center">
              <p className="text-stone-500 text-sm">
                Aucune session enregistrée.{' '}
                <button onClick={() => setAddingSession(true)} className="text-amber-400 hover:text-amber-300 transition-colors">
                  Créer la première
                </button>
              </p>
            </div>
          ) : sessionView === 'timeline' ? (() => {
            type TimelineItem =
              | { kind: 'session'; sortKey: string; data: CampaignSession }
              | { kind: 'milestone'; sortKey: string; data: Milestone }
            const milestones = campaign.campaign_milestones ?? []
            const allItems: TimelineItem[] = [
              ...sessions.map(s => ({ kind: 'session' as const, sortKey: s.session_date ?? s.created_at ?? '', data: s })),
              ...milestones.map(m => ({ kind: 'milestone' as const, sortKey: m.date ?? '', data: m })),
            ].sort((a, b) => timelineSort === 'oldest' ? a.sortKey.localeCompare(b.sortKey) : b.sortKey.localeCompare(a.sortKey))
            const items = milestoneTypeFilter === 'all'
              ? allItems
              : allItems.filter(item => item.kind === 'session' || item.data.type === milestoneTypeFilter)
            const filteredItems = milestoneSearch
              ? items.filter(item => item.data.title.toLowerCase().includes(milestoneSearch.toLowerCase()))
              : items
            const sessionNums = new Map(sessions.map((s, si) => [s.id, si + 1]))
            const milestoneIcons: Record<Milestone['type'], string> = { discovery: '🔍', death: '💀', arc: '🏆', combat: '⚔', other: '⭐' }
            const milestoneColors: Record<Milestone['type'], string> = {
              discovery: 'bg-sky-500', death: 'bg-red-600', arc: 'bg-amber-500', combat: 'bg-orange-500', other: 'bg-violet-500',
            }
            const milestoneLabels: Record<Milestone['type'], string> = { discovery: 'Découverte', death: 'Mort', arc: 'Arc', combat: 'Combat', other: 'Autre' }
            const usedTypes = [...new Set(milestones.map(m => m.type))] as Milestone['type'][]
            return (
            <div className="space-y-0">
              {allItems.length > 3 && (
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={milestoneSearch}
                    onChange={e => setMilestoneSearch(e.target.value)}
                    placeholder="Rechercher…"
                    className="flex-1 bg-stone-900 border border-stone-800 rounded-lg px-3 py-1.5 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-stone-600 transition-colors"
                  />
                  <select
                    value={timelineSort}
                    onChange={e => setTimelineSort(e.target.value as typeof timelineSort)}
                    className="bg-stone-900 border border-stone-800 rounded-lg px-2 py-1.5 text-stone-300 text-sm focus:outline-none focus:border-stone-600 transition-colors"
                  >
                    <option value="newest">Plus récent</option>
                    <option value="oldest">Plus ancien</option>
                  </select>
                </div>
              )}
              {milestones.length > 1 && usedTypes.length > 1 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {(['all', ...usedTypes] as ('all' | Milestone['type'])[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setMilestoneTypeFilter(t)}
                      className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${
                        milestoneTypeFilter === t
                          ? 'bg-sky-900/60 border-sky-600/60 text-sky-300'
                          : 'bg-stone-800 border-stone-700 text-stone-500 hover:text-stone-300'
                      }`}
                    >
                      {t === 'all' ? 'Tous' : `${milestoneIcons[t]} ${milestoneLabels[t]}`}
                    </button>
                  ))}
                </div>
              )}
              {filteredItems.map((item, i) => (
                <div key={item.kind === 'session' ? `s-${item.data.id}` : `m-${item.data.id}`} className="flex gap-3">
                  <div className="flex flex-col items-center shrink-0 w-5">
                    {item.kind === 'milestone' ? (
                      <div className={`w-3.5 h-3.5 rounded-sm mt-3 shrink-0 ${milestoneColors[item.data.type]}`} />
                    ) : (
                      <div className={`w-3 h-3 rounded-full mt-3 border-2 border-stone-950 shrink-0 transition-colors ${expandedSession === item.data.id ? 'bg-amber-500' : 'bg-stone-600'}`} />
                    )}
                    {i < filteredItems.length - 1 && <div className="flex-1 w-0.5 bg-stone-800 my-1 min-h-3" />}
                  </div>
                  {item.kind === 'milestone' ? (
                    <div className="flex-1 pb-2">
                      {editingMilestoneId === item.data.id ? (
                        <div className="bg-stone-900 border border-stone-800 rounded-xl p-3 my-1 space-y-2">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editMilestoneDraft.title}
                              onChange={e => setEditMilestoneDraft(d => ({ ...d, title: e.target.value }))}
                              autoFocus
                              placeholder="Titre *"
                              className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500 transition-colors"
                            />
                            <input
                              type="date"
                              value={editMilestoneDraft.date}
                              onChange={e => setEditMilestoneDraft(d => ({ ...d, date: e.target.value }))}
                              className="w-36 bg-stone-800 border border-stone-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500 transition-colors"
                            />
                          </div>
                          <div className="flex gap-2">
                            <select
                              value={editMilestoneDraft.type}
                              onChange={e => setEditMilestoneDraft(d => ({ ...d, type: e.target.value as Milestone['type'] }))}
                              className="bg-stone-800 border border-stone-700 rounded-lg px-2 py-1.5 text-stone-200 text-sm focus:outline-none focus:border-sky-500 transition-colors"
                            >
                              <option value="discovery">🔍 Découverte</option>
                              <option value="death">💀 Mort</option>
                              <option value="arc">🏆 Arc narratif</option>
                              <option value="combat">⚔ Combat notable</option>
                              <option value="other">⭐ Autre</option>
                            </select>
                            <input
                              type="text"
                              value={editMilestoneDraft.notes}
                              onChange={e => setEditMilestoneDraft(d => ({ ...d, notes: e.target.value }))}
                              placeholder="Notes…"
                              className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-stone-200 text-sm focus:outline-none focus:border-sky-500 transition-colors"
                            />
                          </div>
                          <div className="flex justify-between items-center">
                            <button onClick={() => setEditingMilestoneId(null)} className="text-stone-500 hover:text-stone-300 text-xs transition-colors">Annuler</button>
                            <button onClick={() => handleUpdateMilestone(item.data.id)} disabled={!editMilestoneDraft.title.trim()} className="text-sky-400 hover:text-sky-300 text-xs font-semibold transition-colors disabled:opacity-40">Enregistrer</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 py-2">
                          <span className="text-sm">{milestoneIcons[item.data.type]}</span>
                          <span className="text-stone-200 text-sm font-medium">{item.data.title}</span>
                          {item.data.date && <span className="text-stone-600 text-xs">{new Date(item.data.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                          {item.data.notes && <span className="text-stone-500 text-xs italic truncate max-w-xs">{item.data.notes}</span>}
                          <button
                            onClick={() => { setEditingMilestoneId(item.data.id); setEditMilestoneDraft({ title: item.data.title, date: item.data.date, type: item.data.type, notes: item.data.notes }) }}
                            className="text-stone-600 hover:text-sky-400 text-sm leading-none transition-colors"
                            title="Modifier"
                          >✎</button>
                          <button onClick={() => handleDeleteMilestone(item.data.id)} className="ml-auto text-stone-700 hover:text-red-400 text-xs transition-colors">✕</button>
                        </div>
                      )}
                    </div>
                  ) : (
                  <div className="flex-1 pb-2">
                    {editingSession === item.data.id ? (
                      <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 space-y-3">
                        <div className="flex gap-3">
                          <input type="text" value={editSessionDraft.title}
                            onChange={e => setEditSessionDraft(d => ({ ...d, title: e.target.value }))}
                            className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors" />
                          <input type="date" value={editSessionDraft.session_date}
                            onChange={e => setEditSessionDraft(d => ({ ...d, session_date: e.target.value }))}
                            className="w-40 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors" />
                        </div>
                        <div className="flex gap-3">
                          <div className="flex items-center gap-2">
                            <label className="text-stone-500 text-xs shrink-0">XP</label>
                            <input type="number" placeholder="0" value={editSessionDraft.xp_awarded} onChange={e => setEditSessionDraft(d => ({ ...d, xp_awarded: e.target.value }))} min={0}
                              className="w-24 bg-stone-800 border border-stone-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors" />
                          </div>
                          <input type="text" placeholder="Butins & récompenses" value={editSessionDraft.loot_notes} onChange={e => setEditSessionDraft(d => ({ ...d, loot_notes: e.target.value }))}
                            className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors" />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-stone-600 text-xs">Notes</span>
                            <MicButton onTranscript={text => setEditSessionDraft(d => ({ ...d, notes: d.notes ? d.notes + '\n' + text : text }))} />
                          </div>
                          <textarea value={editSessionDraft.notes}
                            onChange={e => setEditSessionDraft(d => ({ ...d, notes: e.target.value }))}
                            rows={5} placeholder={"## Titre  **gras**  *italique*  - liste"}
                            className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-700 focus:outline-none focus:border-amber-500 transition-colors resize-y font-mono" />
                        </div>
                        <div className="flex items-center justify-between">
                          <button onClick={() => setEditingSession(null)} className="text-stone-500 hover:text-stone-300 text-xs transition-colors">Annuler</button>
                          <div className="flex gap-4">
                            <button onClick={() => handleDeleteSession(item.data.id)} className="text-red-500 hover:text-red-400 text-xs transition-colors">Supprimer</button>
                            <button onClick={() => handleUpdateSession(item.data.id)} disabled={saving || !editSessionDraft.title.trim()}
                              className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors disabled:opacity-40">Enregistrer</button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
                        <button
                          onClick={() => setExpandedSession(expandedSession === item.data.id ? null : item.data.id)}
                          className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-800/50 transition-colors text-left group"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-stone-600 text-xs font-mono shrink-0">#{sessionNums.get(item.data.id)}</span>
                              <span className="text-white text-sm font-medium truncate">{item.data.title}</span>
                            </div>
                            {item.data.session_date && (
                              <p className="text-stone-500 text-xs mt-0.5">
                                {new Date(item.data.session_date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); setEditSessionDraft({ title: item.data.title, session_date: item.data.session_date ?? '', notes: item.data.notes ?? '', xp_awarded: item.data.xp_awarded != null ? String(item.data.xp_awarded) : '', loot_notes: item.data.loot_notes ?? '' }); setEditingSession(item.data.id); setExpandedSession(null) }}
                            className="shrink-0 text-stone-600 hover:text-stone-400 text-xs transition-colors opacity-0 group-hover:opacity-100"
                          >Modifier</button>
                        </button>
                        {expandedSession === item.data.id && (
                          <div className="px-4 pb-4 border-t border-stone-800 pt-3 space-y-2">
                            {(item.data.xp_awarded != null || item.data.loot_notes) && (
                              <div className="flex flex-wrap items-center gap-3 mb-2">
                                {item.data.xp_awarded != null && (
                                  <span className="text-xs bg-amber-900/40 border border-amber-700/40 text-amber-300 rounded-full px-2.5 py-0.5">
                                    +{item.data.xp_awarded.toLocaleString('fr-FR')} XP
                                  </span>
                                )}
                                {item.data.loot_notes && (
                                  <span className="text-xs bg-stone-800 border border-stone-700 text-stone-300 rounded-full px-2.5 py-0.5">
                                    🎁 {item.data.loot_notes}
                                  </span>
                                )}
                                {item.data.xp_awarded != null && characters.length > 0 && !item.data.xp_distributed && (
                                  <button
                                    onClick={() => handleDistributeSessionXp(item.data.id, item.data.xp_awarded!)}
                                    disabled={saving}
                                    className="text-xs bg-emerald-900/40 border border-emerald-700/40 text-emerald-400 hover:bg-emerald-900/60 rounded-full px-2.5 py-0.5 transition-colors disabled:opacity-50"
                                    title={`Distribuer ${Math.floor(item.data.xp_awarded / characters.length)} XP à chaque personnage`}
                                  >
                                    ↗ Distribuer XP
                                  </button>
                                )}
                                {item.data.xp_distributed && (
                                  <span className="text-xs text-stone-600">✓ XP distribué</span>
                                )}
                              </div>
                            )}
                            {item.data.notes && <MarkdownText>{item.data.notes}</MarkdownText>}
                            {!item.data.notes && !item.data.xp_awarded && !item.data.loot_notes && (
                              <p className="text-stone-600 text-sm">Aucune note pour cette session.</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  )}
                </div>
              ))}
            </div>
          )})() : (
            <div className="space-y-2">
              {sessions.length > 3 && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={sessionSearch}
                    onChange={e => setSessionSearch(e.target.value)}
                    placeholder="Rechercher une session…"
                    className="flex-1 bg-stone-900 border border-stone-800 rounded-lg px-3 py-1.5 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-stone-600 transition-colors"
                  />
                  <select
                    value={sessionSort}
                    onChange={e => setSessionSort(e.target.value as typeof sessionSort)}
                    className="bg-stone-900 border border-stone-800 rounded-lg px-2 py-1.5 text-stone-300 text-sm focus:outline-none focus:border-stone-600 transition-colors"
                  >
                    <option value="newest">Plus récente</option>
                    <option value="oldest">Plus ancienne</option>
                    <option value="title">Titre A→Z</option>
                  </select>
                </div>
              )}
              {sessions
                .filter(s => !sessionSearch || s.title.toLowerCase().includes(sessionSearch.toLowerCase()) || (s.session_date ?? '').includes(sessionSearch))
                .sort((a, b) => {
                  if (sessionSort === 'title') return a.title.localeCompare(b.title, 'fr')
                  const da = a.session_date ?? ''
                  const db = b.session_date ?? ''
                  return sessionSort === 'newest' ? db.localeCompare(da) : da.localeCompare(db)
                })
                .map(s => (
                <div key={s.id} className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
                  {editingSession === s.id ? (
                    <div className="p-5 space-y-3">
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={editSessionDraft.title}
                          onChange={e => setEditSessionDraft(d => ({ ...d, title: e.target.value }))}
                          className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                        />
                        <input
                          type="date"
                          value={editSessionDraft.session_date}
                          onChange={e => setEditSessionDraft(d => ({ ...d, session_date: e.target.value }))}
                          className="w-40 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                        />
                      </div>
                      <div className="flex gap-3">
                        <div className="flex items-center gap-2">
                          <label className="text-stone-500 text-xs shrink-0">XP</label>
                          <input type="number" placeholder="0" value={editSessionDraft.xp_awarded} onChange={e => setEditSessionDraft(d => ({ ...d, xp_awarded: e.target.value }))} min={0}
                            className="w-24 bg-stone-800 border border-stone-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors" />
                        </div>
                        <input type="text" placeholder="Butins & récompenses" value={editSessionDraft.loot_notes} onChange={e => setEditSessionDraft(d => ({ ...d, loot_notes: e.target.value }))}
                          className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors" />
                      </div>
                      <textarea
                        value={editSessionDraft.notes}
                        onChange={e => setEditSessionDraft(d => ({ ...d, notes: e.target.value }))}
                        rows={5}
                        placeholder={"## Titre  **gras**  *italique*  - liste"}
                        className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-700 focus:outline-none focus:border-amber-500 transition-colors resize-y font-mono"
                      />
                      <div className="flex items-center justify-between">
                        <button onClick={() => setEditingSession(null)} className="text-stone-500 hover:text-stone-300 text-xs transition-colors">Annuler</button>
                        <div className="flex gap-4">
                          <button
                            onClick={() => handleDeleteSession(s.id)}
                            className="text-red-500 hover:text-red-400 text-xs transition-colors"
                          >
                            Supprimer
                          </button>
                          <button
                            onClick={() => handleUpdateSession(s.id)}
                            disabled={saving || !editSessionDraft.title.trim()}
                            className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors disabled:opacity-40"
                          >
                            Enregistrer
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <button
                        onClick={() => setExpandedSession(expandedSession === s.id ? null : s.id)}
                        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-stone-800/50 transition-colors text-left group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-stone-500 text-xs" style={{ transform: expandedSession === s.id ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', transition: 'transform 0.2s' }}>▶</span>
                          <span className="text-white text-sm font-medium truncate">{s.title}</span>
                          {s.session_date && (
                            <span className="shrink-0 text-stone-500 text-xs">
                              {new Date(s.session_date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            setEditSessionDraft({ title: s.title, session_date: s.session_date ?? '', notes: s.notes ?? '', xp_awarded: s.xp_awarded != null ? String(s.xp_awarded) : '', loot_notes: s.loot_notes ?? '' })
                            setEditingSession(s.id)
                            setExpandedSession(null)
                          }}
                          className="shrink-0 text-stone-600 hover:text-stone-400 text-xs transition-colors opacity-0 group-hover:opacity-100"
                        >
                          Modifier
                        </button>
                      </button>
                      {expandedSession === s.id && (
                        <div className="px-5 pb-5 border-t border-stone-800 pt-4 space-y-2">
                          {(s.xp_awarded != null || s.loot_notes) && (
                            <div className="flex flex-wrap items-center gap-3 mb-2">
                              {s.xp_awarded != null && (
                                <span className="text-xs bg-amber-900/40 border border-amber-700/40 text-amber-300 rounded-full px-2.5 py-0.5">
                                  +{s.xp_awarded.toLocaleString('fr-FR')} XP
                                </span>
                              )}
                              {s.loot_notes && (
                                <span className="text-xs bg-stone-800 border border-stone-700 text-stone-300 rounded-full px-2.5 py-0.5">
                                  🎁 {s.loot_notes}
                                </span>
                              )}
                              {s.xp_awarded != null && characters.length > 0 && !s.xp_distributed && (
                                <button
                                  onClick={() => handleDistributeSessionXp(s.id, s.xp_awarded!)}
                                  disabled={saving}
                                  className="text-xs bg-emerald-900/40 border border-emerald-700/40 text-emerald-400 hover:bg-emerald-900/60 rounded-full px-2.5 py-0.5 transition-colors disabled:opacity-50"
                                  title={`Distribuer ${Math.floor(s.xp_awarded / characters.length)} XP à chaque personnage`}
                                >
                                  ↗ Distribuer XP
                                </button>
                              )}
                              {s.xp_distributed && (
                                <span className="text-xs text-stone-600">✓ XP distribué</span>
                              )}
                            </div>
                          )}
                          {s.notes && <MarkdownText>{s.notes}</MarkdownText>}
                          {!s.notes && !s.xp_awarded && !s.loot_notes && (
                            <p className="text-stone-600 text-sm">Aucune note pour cette session.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
    </>
  )
}
