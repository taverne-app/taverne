import { useEffect, useMemo, useState } from 'react'
import {
  getSharedCharacterNotes,
  updateSharedCharacterNotes,
  type AdventureNote,
} from '../api/share'
import { usePlayerCharacter } from '../lib/playerIdentity'
import { useDictation } from '../lib/dictation'

/**
 * Carnet d'aventure du joueur, sur la page de campagne partagée.
 *
 * PRIVÉ, ET C'EST STRUCTUREL : les notes sont attachées à la fiche et ne transitent
 * que par /share/character/{token}/notes. Elles ne passent jamais par la campagne
 * partagée ni par CharacterResource, qui partent l'une et l'autre à toute la table.
 * Ne jamais les remonter dans ces charges utiles « pour simplifier ».
 *
 * Réserve à dire au joueur si la question vient : Taverne est auto-hébergé, le MJ a
 * la base de données. Rien ne les lui montre — ce n'est pas la même chose que d'être
 * chiffré contre lui.
 */

/** Amorces proposées d'office. Le joueur en ajoute librement ; rien n'est figé. */
const DEFAULT_TYPES = ['Libre', 'PNJ', 'Lieu', 'Quête', 'Objet', 'Théorie']

const newNote = (): AdventureNote => ({
  id: crypto.randomUUID(),
  type: 'Libre',
  title: '',
  body: '',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
})

export function PlayerNotes({ campaignToken }: { campaignToken: string }) {
  const { token, candidates, pick } = usePlayerCharacter(campaignToken)
  const [notes, setNotes] = useState<AdventureNote[]>([])
  const [draft, setDraft] = useState<AdventureNote | null>(null)
  const [filter, setFilter] = useState<string | null>(null)
  const [newType, setNewType] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const dictation = useDictation(chunk => {
    // On ajoute à la suite de ce qui est déjà écrit : la dictée complète le texte,
    // elle ne le remplace pas.
    setDraft(d => (d ? { ...d, body: d.body ? `${d.body} ${chunk}` : chunk } : d))
  })

  useEffect(() => {
    if (!token) { setNotes([]); setLoaded(false); return }
    let cancelled = false
    getSharedCharacterNotes(token)
      .then(n => { if (!cancelled) { setNotes(n); setLoaded(true) } })
      .catch(() => { if (!cancelled) setError('Carnet illisible pour l’instant.') })
    return () => { cancelled = true }
  }, [token])

  /** Les types proposés = les amorces, plus tout ce que le joueur a déjà créé. */
  const types = useMemo(() => {
    const used = notes.map(n => n.type)
    return [...DEFAULT_TYPES, ...used.filter(t => !DEFAULT_TYPES.includes(t))]
      .filter((t, i, a) => a.indexOf(t) === i)
  }, [notes])

  const shown = useMemo(
    () => notes.filter(n => !filter || n.type === filter)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [notes, filter],
  )

  async function persist(next: AdventureNote[]) {
    if (!token) return
    const previous = notes
    setNotes(next)
    setBusy(true)
    setError(null)
    try {
      setNotes(await updateSharedCharacterNotes(token, next))
    } catch {
      // Le carnet est remplacé en bloc : si l'écriture échoue, garder l'affichage
      // optimiste ferait croire la note enregistrée. On revient en arrière.
      setNotes(previous)
      setError('Note non enregistrée. Réessayez.')
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!draft) return
    if (!draft.title.trim() && !draft.body.trim()) { setDraft(null); return }
    dictation.stop()
    const stamped = { ...draft, updated_at: new Date().toISOString() }
    const exists = notes.some(n => n.id === stamped.id)
    await persist(exists ? notes.map(n => (n.id === stamped.id ? stamped : n)) : [stamped, ...notes])
    setDraft(null)
  }

  if (!token) {
    return (
      <section className="bg-stone-900 border border-stone-800 rounded-xl px-5 py-4">
        <h2 className="text-white font-semibold mb-2">Mon carnet</h2>
        {candidates.length > 1 ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-stone-400 text-sm">Vous jouez :</span>
            {candidates.map(s => (
              <button
                key={s.token}
                onClick={() => pick(s.token)}
                className="bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-amber-600/50 text-stone-200 text-sm rounded-lg px-3 py-1.5 transition-colors"
              >{s.name}</button>
            ))}
          </div>
        ) : (
          <p className="text-stone-500 text-sm">
            Ouvrez une fois le lien de votre fiche de personnage, celui que votre MJ vous a
            donné : cet appareil s’en souviendra et votre carnet apparaîtra ici.
          </p>
        )}
      </section>
    )
  }

  return (
    <section className="bg-stone-900 border border-stone-800 rounded-xl px-5 py-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-white font-semibold">Mon carnet</h2>
          <p className="text-stone-600 text-xs">Vos notes, visibles de vous seul sur cette page.</p>
        </div>
        {!draft && (
          <button
            onClick={() => setDraft(newNote())}
            className="bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold rounded-lg px-3 py-1.5 transition-colors"
          >+ Note</button>
        )}
      </div>

      {error && <p className="text-red-400 text-xs">⚠ {error}</p>}

      {/* Éditeur */}
      {draft && (
        <div className="bg-stone-950/60 border border-stone-700 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={draft.title}
              onChange={e => setDraft({ ...draft, title: e.target.value })}
              placeholder="Titre…"
              className="flex-1 min-w-[160px] bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
            />
            {newType === null ? (
              <select
                value={draft.type}
                onChange={e => {
                  if (e.target.value === '__new') { setNewType(''); return }
                  setDraft({ ...draft, type: e.target.value })
                }}
                className="bg-stone-800 border border-stone-700 rounded-lg px-2 py-1.5 text-stone-200 text-sm focus:outline-none focus:border-amber-500 cursor-pointer transition-colors"
              >
                {types.map(t => <option key={t} value={t}>{t}</option>)}
                <option value="__new">+ Nouveau type…</option>
              </select>
            ) : (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  type="text"
                  value={newType}
                  onChange={e => setNewType(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newType.trim()) {
                      setDraft({ ...draft, type: newType.trim() }); setNewType(null)
                    }
                    if (e.key === 'Escape') setNewType(null)
                  }}
                  placeholder="Nom du type…"
                  className="w-32 bg-stone-800 border border-amber-600/50 rounded-lg px-2 py-1.5 text-white text-sm placeholder-stone-600 focus:outline-none"
                />
                <button
                  onClick={() => { if (newType.trim()) { setDraft({ ...draft, type: newType.trim() }); setNewType(null) } }}
                  className="text-emerald-400 hover:text-emerald-300 text-sm px-1 transition-colors"
                >✓</button>
                <button onClick={() => setNewType(null)} className="text-stone-500 hover:text-stone-300 text-sm px-1 transition-colors">✕</button>
              </div>
            )}
          </div>

          <div className="relative">
            <textarea
              value={draft.body}
              onChange={e => setDraft({ ...draft, body: e.target.value })}
              rows={5}
              placeholder="Ce qui s’est passé…"
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 pr-11 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors resize-y"
            />
            {dictation.supported && (
              <button
                onClick={dictation.toggle}
                title={dictation.listening
                  ? 'Arrêter la dictée'
                  : 'Dicter la note. Attention : votre navigateur envoie l’audio à son service de reconnaissance, il ne reste pas sur votre machine.'}
                className={`absolute top-2 right-2 w-7 h-7 rounded-full border text-sm transition-colors ${
                  dictation.listening
                    ? 'bg-red-600 border-red-400 text-white animate-pulse'
                    : 'bg-stone-700 border-stone-600 text-stone-300 hover:text-white hover:border-stone-400'
                }`}
              >🎤</button>
            )}
          </div>

          {dictation.listening && <p className="text-red-400 text-xs">● Dictée en cours — parlez, le texte s’ajoute à la fin.</p>}
          {dictation.error && <p className="text-amber-400 text-xs">⚠ {dictation.error}</p>}

          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={busy}
              className="bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-sm font-semibold rounded-lg px-3 py-1.5 transition-colors"
            >Enregistrer</button>
            <button
              onClick={() => { dictation.stop(); setDraft(null); setNewType(null) }}
              className="text-stone-400 hover:text-stone-200 text-sm px-2 py-1.5 transition-colors"
            >Annuler</button>
          </div>
        </div>
      )}

      {/* Filtres par type — seulement s'il y a de quoi trier */}
      {notes.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilter(null)}
            className={`text-xs rounded-full px-2.5 py-0.5 border transition-colors ${!filter ? 'bg-stone-700 border-stone-500 text-stone-100' : 'bg-stone-800 border-stone-700 text-stone-500 hover:text-stone-300'}`}
          >Toutes</button>
          {types.filter(t => notes.some(n => n.type === t)).map(t => (
            <button
              key={t}
              onClick={() => setFilter(filter === t ? null : t)}
              className={`text-xs rounded-full px-2.5 py-0.5 border transition-colors ${filter === t ? 'bg-stone-700 border-stone-500 text-stone-100' : 'bg-stone-800 border-stone-700 text-stone-500 hover:text-stone-300'}`}
            >{t}</button>
          ))}
        </div>
      )}

      {/* Liste */}
      {loaded && notes.length === 0 && !draft && (
        <p className="text-stone-600 text-sm py-2">
          Rien encore. « + Note » pour consigner ce que vous avez appris.
        </p>
      )}

      <div className="space-y-1.5">
        {shown.map(n => (
          <div key={n.id} className="bg-stone-950/40 border border-stone-800 rounded-lg px-3 py-2 group">
            <div className="flex items-center gap-2">
              <span className="text-[10px] shrink-0 bg-stone-800 border border-stone-700 text-stone-400 rounded px-1.5 py-0.5">{n.type}</span>
              <span className="text-stone-200 text-sm font-medium truncate flex-1">{n.title || 'Sans titre'}</span>
              <button
                onClick={() => { setDraft(n); setNewType(null) }}
                className="text-stone-600 hover:text-amber-400 text-xs opacity-0 group-hover:opacity-100 transition-all"
              >Modifier</button>
              <button
                onClick={() => persist(notes.filter(x => x.id !== n.id))}
                className="text-stone-600 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-all"
              >Supprimer</button>
            </div>
            {n.body && <p className="text-stone-500 text-xs mt-1 whitespace-pre-wrap line-clamp-3">{n.body}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}
