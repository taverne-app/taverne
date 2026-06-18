import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  getCampaign,
  updateCampaign,
  addCharacterToCampaign,
  removeCharacterFromCampaign,
  type Campaign,
} from '../api/campaigns'
import { generateShareToken, revokeShareToken } from '../api/share'
import { listCharacters, longRest, type Character } from '../api/characters'
import {
  listSessions,
  createSession,
  updateSession,
  deleteSession,
  type CampaignSession,
} from '../api/sessions'
import { logout } from '../api/auth'
import { useAuth } from '../contexts/AuthContext'
import { createEcho } from '../lib/echo'
import { canLevelUp } from '../data/xp'

// ── Helpers ───────────────────────────────────────────────────────────────────

function sign(n: number) { return n >= 0 ? `+${n}` : `${n}` }

function hpColor(current: number, max: number) {
  const pct = max > 0 ? current / max : 0
  if (pct > 0.5) return 'bg-emerald-500'
  if (pct > 0.25) return 'bg-amber-500'
  return 'bg-red-500'
}

const CONDITIONS_FR: Record<string, string> = {
  blinded: 'Aveuglé', charmed: 'Charmé', deafened: 'Assourdi',
  exhaustion: 'Épuisé', frightened: 'Effrayé', grappled: 'Agrippé',
  incapacitated: 'Hors de combat', invisible: 'Invisible', paralyzed: 'Paralysé',
  petrified: 'Pétrifié', poisoned: 'Empoisonné', prone: 'À terre',
  restrained: 'Entravé', stunned: 'Étourdi', unconscious: 'Inconscient',
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function CampaignPage() {
  const { id } = useParams<{ id: string }>()
  const { token, user, clearAuth } = useAuth()
  const navigate = useNavigate()

  const [campaign, setCampaign]     = useState<Campaign | null>(null)
  const [characters, setCharacters] = useState<Character[]>([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)

  // Inline name/description editing
  const [editing, setEditing]       = useState(false)
  const [nameDraft, setNameDraft]   = useState('')
  const [descDraft, setDescDraft]   = useState('')

  // Add character modal
  const [showAddModal, setShowAddModal]         = useState(false)
  const [allChars, setAllChars]                 = useState<Character[]>([])
  const [confirmRemove, setConfirmRemove]       = useState<number | null>(null)

  // Share
  const [copied, setCopied] = useState(false)

  // Group rest
  const [restingAll, setRestingAll] = useState(false)
  const [restDone, setRestDone]     = useState<'long' | null>(null)

  // DM Screen
  const [showDmScreen, setShowDmScreen] = useState(false)

  // Sessions
  const [sessions, setSessions]               = useState<CampaignSession[]>([])
  const [addingSession, setAddingSession]     = useState(false)
  const [sessionDraft, setSessionDraft]       = useState({ title: '', session_date: '', notes: '' })
  const [editingSession, setEditingSession]   = useState<number | null>(null)
  const [editSessionDraft, setEditSessionDraft] = useState({ title: '', session_date: '', notes: '' })
  const [expandedSession, setExpandedSession] = useState<number | null>(null)

  // Load campaign
  useEffect(() => {
    if (!id) return
    setLoading(true)
    getCampaign(Number(id))
      .then(c => {
        setCampaign(c)
        setCharacters(c.characters)
      })
      .catch(() => navigate('/campaigns'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  useEffect(() => {
    if (!id) return
    listSessions(Number(id)).then(setSessions).catch(() => {})
  }, [id])

  // Real-time WS subscription per character
  const charIds = characters.map(c => c.id).join(',')
  useEffect(() => {
    if (!token || characters.length === 0) return
    const echo = createEcho(token)
    characters.forEach(c => {
      echo.private(`character.${c.id}`).listen('.character.updated', (e: { character: Character }) => {
        setCharacters(prev => prev.map(ch => ch.id === e.character.id ? e.character : ch))
      })
    })
    return () => {
      characters.forEach(c => echo.leave(`character.${c.id}`))
      echo.disconnect()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, charIds])

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

  async function openAddModal() {
    const all = await listCharacters()
    const inCampaign = new Set(characters.map(c => c.id))
    setAllChars(all.filter(c => !inCampaign.has(c.id)))
    setShowAddModal(true)
  }

  async function handleAdd(characterId: number) {
    if (!campaign) return
    setSaving(true)
    try {
      const updated = await addCharacterToCampaign(campaign.id, characterId)
      setCampaign(updated)
      setCharacters(updated.characters)
      setShowAddModal(false)
    } finally { setSaving(false) }
  }

  async function handleRemove(characterId: number) {
    if (!campaign) return
    setSaving(true)
    try {
      const updated = await removeCharacterFromCampaign(campaign.id, characterId)
      setCampaign(updated)
      setCharacters(updated.characters)
      setConfirmRemove(null)
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

  async function handleCreateSession() {
    if (!campaign || !sessionDraft.title.trim()) return
    setSaving(true)
    try {
      const s = await createSession(campaign.id, {
        title: sessionDraft.title.trim(),
        session_date: sessionDraft.session_date || null,
        notes: sessionDraft.notes || null,
      })
      setSessions(prev => [s, ...prev])
      setAddingSession(false)
      setSessionDraft({ title: '', session_date: '', notes: '' })
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
      })
      setSessions(prev => prev.map(s => s.id === sessionId ? updated : s))
      setEditingSession(null)
    } finally { setSaving(false) }
  }

  async function handleDeleteSession(sessionId: number) {
    if (!campaign) return
    await deleteSession(campaign.id, sessionId)
    setSessions(prev => prev.filter(s => s.id !== sessionId))
    if (editingSession === sessionId) setEditingSession(null)
    if (expandedSession === sessionId) setExpandedSession(null)
  }

  async function handleGroupLongRest() {
    if (restingAll || characters.length === 0) return
    setRestingAll(true)
    try {
      const updated = await Promise.all(characters.map(c => longRest(c.id)))
      setCharacters(updated)
      setRestDone('long')
      setTimeout(() => setRestDone(null), 4000)
    } finally {
      setRestingAll(false)
    }
  }

  async function handleLogout() {
    try { await logout() } catch { /* ignore */ }
    clearAuth()
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!campaign) return null

  return (
    <div className="min-h-screen bg-stone-950">
      {/* Header */}
      <header className="border-b border-stone-800 bg-stone-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/campaigns" className="text-stone-400 hover:text-stone-200 text-sm shrink-0 transition-colors">
              ← Campagnes
            </Link>
            <span className="text-stone-700">|</span>
            <span className="text-amber-400 font-bold truncate">{campaign.name}</span>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            {saving && <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />}
            <span className="text-stone-400 text-sm hidden sm:block">{user?.name}</span>
            <button onClick={handleLogout} className="text-stone-400 hover:text-stone-200 text-sm transition-colors">
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">

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
              <div className="flex items-center gap-3 shrink-0">
                <Link
                  to={`/combat?campaign=${campaign.id}`}
                  className="bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-300 text-sm font-medium rounded-lg px-3 py-1.5 transition-colors"
                >
                  ⚔ Combat
                </Link>
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

        {/* Characters */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">
              Personnages ({characters.length})
            </h2>
            <div className="flex items-center gap-3">
              {characters.length > 0 && (
                <>
                  <button
                    onClick={() => setShowDmScreen(v => !v)}
                    className={`text-xs font-medium transition-colors ${
                      showDmScreen
                        ? 'text-violet-400 hover:text-violet-300'
                        : 'text-stone-500 hover:text-violet-400'
                    }`}
                    title="Vue MJ — toutes les infos en tableau"
                  >
                    {showDmScreen ? '⊞ Cartes' : '☰ Vue MJ'}
                  </button>
                  <button
                    onClick={handleGroupLongRest}
                    disabled={restingAll}
                    className="text-stone-500 hover:text-amber-400 text-xs font-medium transition-colors disabled:opacity-40 flex items-center gap-1"
                    title="Appliquer un repos long à tous les personnages"
                  >
                    {restingAll ? '…' : restDone === 'long' ? '✓ Repos terminé' : '🌙 Repos long'}
                  </button>
                </>
              )}
              <button
                onClick={openAddModal}
                className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors"
              >
                + Ajouter
              </button>
            </div>
          </div>

          {characters.length === 0 ? (
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-10 text-center">
              <p className="text-stone-500 text-sm">
                Aucun personnage dans cette campagne.{' '}
                <button onClick={openAddModal} className="text-amber-400 hover:text-amber-300 transition-colors">
                  Ajouter un personnage
                </button>
              </p>
            </div>
          ) : showDmScreen ? (
            /* ── Vue MJ ── */
            <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
              <div className="divide-y divide-stone-800">
                {characters.map(c => {
                  const hpPct = Math.max(0, Math.min(100, (c.combat.current_hp / c.combat.max_hp) * 100))
                  const isDying = c.combat.current_hp <= 0
                  const levelUp = canLevelUp(c.level, c.experience_points)
                  return (
                    <div key={c.id} className="px-4 py-3 hover:bg-stone-800/40 transition-colors relative group">
                      <Link to={`/characters/${c.id}`} className="absolute inset-0" />
                      <div className="flex items-center gap-4 min-w-0">

                        {/* Name + class */}
                        <div className="w-44 shrink-0 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`font-semibold text-sm truncate ${isDying ? 'text-red-400' : 'text-white'}`}>
                              {c.name}
                            </span>
                            {levelUp && (
                              <span className="shrink-0 text-xs bg-amber-900/50 border border-amber-600/50 text-amber-400 rounded px-1 py-0.5 font-semibold">
                                ⬆ Niv
                              </span>
                            )}
                            {c.combat.inspiration && (
                              <span className="shrink-0 text-amber-400 text-xs" title="Inspiration">✦</span>
                            )}
                          </div>
                          <p className="text-stone-500 text-xs truncate mt-0.5">
                            {c.character_class} Niv.{c.level} · CA {c.combat.armor_class}
                          </p>
                        </div>

                        {/* HP */}
                        <div className="w-40 shrink-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-sm font-bold ${isDying ? 'text-red-400' : 'text-white'}`}>
                              {c.combat.current_hp}
                            </span>
                            <span className="text-stone-500 text-xs">/ {c.combat.max_hp}</span>
                            {c.combat.temporary_hp > 0 && (
                              <span className="text-sky-400 text-xs">+{c.combat.temporary_hp}</span>
                            )}
                          </div>
                          <div className="h-1.5 bg-stone-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${hpColor(c.combat.current_hp, c.combat.max_hp)}`}
                              style={{ width: `${hpPct}%` }}
                            />
                          </div>
                        </div>

                        {/* Death saves */}
                        {isDying && (
                          <div className="flex items-center gap-1 shrink-0">
                            {[1,2,3].map(n => (
                              <div key={n} className={`w-3 h-3 rounded-full border ${n <= c.state.death_saves_successes ? 'bg-emerald-500 border-emerald-400' : 'border-stone-600'}`} />
                            ))}
                            <span className="text-stone-600 text-xs mx-0.5">/</span>
                            {[1,2,3].map(n => (
                              <div key={n} className={`w-3 h-3 rounded-full border ${n <= c.state.death_saves_failures ? 'bg-red-500 border-red-400' : 'border-stone-600'}`} />
                            ))}
                          </div>
                        )}

                        {/* Conditions */}
                        <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                          {c.state.conditions.length === 0 && !isDying ? (
                            <span className="text-stone-700 text-xs">—</span>
                          ) : (
                            c.state.conditions.map(cond => (
                              <span key={cond} className="text-xs bg-purple-900/50 border border-purple-700 text-purple-300 rounded px-1.5 py-0.5">
                                {CONDITIONS_FR[cond] ?? cond}
                              </span>
                            ))
                          )}
                        </div>

                        {/* Resources */}
                        {c.resources.length > 0 && (
                          <div className="hidden lg:flex items-center gap-1.5 shrink-0 flex-wrap max-w-[180px]">
                            {c.resources.map((r, i) => (
                              <span key={i} className={`text-xs rounded px-1.5 py-0.5 border ${
                                r.current === 0
                                  ? 'bg-stone-800 border-stone-700 text-stone-600'
                                  : 'bg-stone-800 border-stone-600 text-stone-300'
                              }`}>
                                {r.name} {r.current}/{r.max}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Link arrow */}
                        <span className="text-stone-700 group-hover:text-stone-500 text-sm transition-colors shrink-0 relative z-10">↗</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {characters.map(c => {
                const hpPct = Math.max(0, Math.min(100, (c.combat.current_hp / c.combat.max_hp) * 100))
                const isDying = c.combat.current_hp <= 0

                return (
                  <div
                    key={c.id}
                    className="bg-stone-900 border border-stone-800 rounded-xl p-4 hover:border-stone-700 transition-colors group relative"
                  >
                    <Link to={`/characters/${c.id}`} className="absolute inset-0 rounded-xl" />

                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className={`font-semibold text-sm ${isDying ? 'text-red-400' : 'text-white'}`}>
                            {c.name}
                          </h3>
                          {canLevelUp(c.level, c.experience_points) && (
                            <span className="text-xs bg-amber-900/50 border border-amber-600/50 text-amber-400 rounded px-1 py-0.5 font-semibold">
                              ⬆ Niv
                            </span>
                          )}
                        </div>
                        <p className="text-stone-500 text-xs mt-0.5">
                          {c.race} · {c.character_class} · Niv. {c.level}
                        </p>
                      </div>
                      {/* Remove button */}
                      <div className="relative z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                        {confirmRemove === c.id ? (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => setConfirmRemove(null)}
                              className="text-stone-500 text-xs hover:text-stone-300 transition-colors"
                            >
                              ✕
                            </button>
                            <button
                              onClick={() => handleRemove(c.id)}
                              className="text-red-400 text-xs hover:text-red-300 transition-colors"
                            >
                              Retirer
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmRemove(c.id)}
                            className="text-stone-700 hover:text-red-400 text-xs transition-colors"
                          >
                            Retirer
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="flex gap-3 text-center mb-3">
                      <div className="flex-1 bg-stone-800 rounded-lg py-1.5">
                        <p className="text-stone-500 text-xs">CA</p>
                        <p className="text-white font-bold text-sm">{c.combat.armor_class}</p>
                      </div>
                      <div className="flex-1 bg-stone-800 rounded-lg py-1.5">
                        <p className="text-stone-500 text-xs">Init.</p>
                        <p className="text-white font-bold text-sm">{sign(c.combat.initiative)}</p>
                      </div>
                      <div className="flex-1 bg-stone-800 rounded-lg py-1.5">
                        <p className="text-stone-500 text-xs">Maît.</p>
                        <p className="text-white font-bold text-sm">+{c.proficiency_bonus}</p>
                      </div>
                    </div>

                    {/* HP bar */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className={isDying ? 'text-red-400 font-semibold' : 'text-stone-400'}>PV</span>
                        <span className="text-stone-400">
                          {c.combat.current_hp} / {c.combat.max_hp}
                          {c.combat.temporary_hp > 0 && (
                            <span className="text-sky-400 ml-1">+{c.combat.temporary_hp}</span>
                          )}
                        </span>
                      </div>
                      <div className="h-1.5 bg-stone-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${hpColor(c.combat.current_hp, c.combat.max_hp)}`}
                          style={{ width: `${hpPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Conditions */}
                    {c.state.conditions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {c.state.conditions.map(cond => (
                          <span
                            key={cond}
                            className="text-xs bg-purple-900/50 border border-purple-700 text-purple-300 rounded px-1.5 py-0.5"
                          >
                            {CONDITIONS_FR[cond] ?? cond}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Sessions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">
              Journal de sessions ({sessions.length})
            </h2>
            <button
              onClick={() => { setAddingSession(v => !v); setSessionDraft({ title: '', session_date: '', notes: '' }) }}
              className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors"
            >
              {addingSession ? 'Annuler' : '+ Nouvelle session'}
            </button>
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
              <textarea
                placeholder="Notes de la session…"
                value={sessionDraft.notes}
                onChange={e => setSessionDraft(d => ({ ...d, notes: e.target.value }))}
                rows={4}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors resize-y"
              />
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

          {sessions.length === 0 && !addingSession ? (
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-8 text-center">
              <p className="text-stone-500 text-sm">
                Aucune session enregistrée.{' '}
                <button onClick={() => setAddingSession(true)} className="text-amber-400 hover:text-amber-300 transition-colors">
                  Créer la première
                </button>
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map(s => (
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
                      <textarea
                        value={editSessionDraft.notes}
                        onChange={e => setEditSessionDraft(d => ({ ...d, notes: e.target.value }))}
                        rows={5}
                        className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm focus:outline-none focus:border-amber-500 transition-colors resize-y"
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
                            setEditSessionDraft({ title: s.title, session_date: s.session_date ?? '', notes: s.notes ?? '' })
                            setEditingSession(s.id)
                            setExpandedSession(null)
                          }}
                          className="shrink-0 text-stone-600 hover:text-stone-400 text-xs transition-colors opacity-0 group-hover:opacity-100"
                        >
                          Modifier
                        </button>
                      </button>
                      {expandedSession === s.id && s.notes && (
                        <div className="px-5 pb-5">
                          <p className="text-stone-400 text-sm whitespace-pre-wrap leading-relaxed border-t border-stone-800 pt-4">
                            {s.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Add character modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-stone-900 border border-stone-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-white font-semibold mb-4">Ajouter un personnage</h2>
            {allChars.length === 0 ? (
              <p className="text-stone-500 text-sm">
                Tous vos personnages sont déjà dans cette campagne ou vous n'en avez pas encore.
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {allChars.map(c => (
                  <button
                    key={c.id}
                    onClick={() => handleAdd(c.id)}
                    disabled={saving}
                    className="w-full flex items-center justify-between bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded-xl px-4 py-3 transition-colors disabled:opacity-40 text-left"
                  >
                    <div>
                      <p className="text-white font-medium text-sm">{c.name}</p>
                      <p className="text-stone-500 text-xs">{c.race} · {c.character_class} · Niv. {c.level}</p>
                    </div>
                    <span className="text-amber-400 text-sm font-bold ml-3">+</span>
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowAddModal(false)}
              className="mt-4 w-full text-stone-500 hover:text-stone-300 text-sm transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
