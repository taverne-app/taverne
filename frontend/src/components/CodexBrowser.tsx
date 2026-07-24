import { useEffect, useMemo, useState } from 'react'
import { buildCodexTree, type CodexNode, type CodexPage } from '../api/codex'
import { useDictation } from '../lib/dictation'

/**
 * Le codex de campagne : arbre à gauche, page en cours à droite.
 *
 * UN SEUL composant pour le MJ et pour les joueurs, à dessein — deux implémentations
 * divergeraient. Ce qui les sépare tient dans les capacités passées en props :
 * seul le MJ supprime, déplace et rend une page secrète.
 *
 * Le corps est un textarea, pas un éditeur par blocs. C'est un choix : la dictée
 * (useDictation) sert en séance, et le reste de Taverne écrit déjà comme ça.
 */

interface CodexBrowserProps {
  pages: CodexPage[]
  onCreate: (page: { title: string; parent_id: number | null }) => Promise<CodexPage>
  onSave: (id: number, patch: { title?: string; body?: string | null }) => Promise<CodexPage>
  /** MJ seul : la suppression emporte la descendance et rien ne la rattrape. */
  onDelete?: (id: number) => Promise<void>
  onSetVisibility?: (id: number, visibility: 'mj' | 'table') => Promise<CodexPage>
  onMove?: (id: number, parentId: number | null) => Promise<CodexPage>
  /** Phrase affichée quand le codex est vide, différente selon qui regarde. */
  emptyHint?: string
}

export function CodexBrowser({
  pages, onCreate, onSave, onDelete, onSetVisibility, onMove, emptyHint,
}: CodexBrowserProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const [titleDraft, setTitleDraft] = useState('')
  const [bodyDraft, setBodyDraft] = useState('')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newParent, setNewParent] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)

  const tree = useMemo(() => buildCodexTree(pages), [pages])
  const selected = useMemo(() => pages.find(p => p.id === selectedId) ?? null, [pages, selectedId])

  const dictation = useDictation(chunk => {
    setBodyDraft(b => (b ? `${b} ${chunk}` : chunk))
    setDirty(true)
  })

  // Changer de page recharge les brouillons. On ne le fait QUE sur un changement de
  // page : se caler sur `selected` réécrirait le texte en cours de frappe à chaque
  // réponse du serveur.
  useEffect(() => {
    const page = pages.find(p => p.id === selectedId) ?? null
    setTitleDraft(page?.title ?? '')
    setBodyDraft(page?.body ?? '')
    setDirty(false)
    setError(null)
    dictation.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  async function save() {
    if (!selected || !dirty) return
    setBusy(true)
    setError(null)
    try {
      await onSave(selected.id, { title: titleDraft.trim() || 'Sans titre', body: bodyDraft })
      setDirty(false)
    } catch {
      setError('Page non enregistrée. Le texte est toujours là — réessaie.')
    } finally {
      setBusy(false)
    }
  }

  async function create() {
    const title = newTitle.trim()
    if (!title) return
    setBusy(true)
    setError(null)
    try {
      const page = await onCreate({ title, parent_id: newParent })
      setNewTitle('')
      setNewParent(null)
      setCreating(false)
      setSelectedId(page.id)
    } catch {
      setError('Page non créée.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!selected || !onDelete) return
    const kids = pages.filter(p => p.parent_id === selected.id).length
    const warning = kids > 0
      ? `Supprimer « ${selected.title} » et ses ${kids} sous-page(s) ? Rien ne le rattrape.`
      : `Supprimer « ${selected.title} » ? Rien ne le rattrape.`
    if (!confirm(warning)) return
    setBusy(true)
    try {
      await onDelete(selected.id)
      setSelectedId(null)
    } catch {
      setError('Suppression impossible.')
    } finally {
      setBusy(false)
    }
  }

  function toggleCollapse(id: number) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /** Parents possibles pour un déplacement : tout sauf la page et sa descendance. */
  const moveTargets = useMemo(() => {
    if (!selected) return []
    const banned = new Set<number>([selected.id])
    let grew = true
    while (grew) {
      grew = false
      pages.forEach(p => {
        if (p.parent_id != null && banned.has(p.parent_id) && !banned.has(p.id)) {
          banned.add(p.id)
          grew = true
        }
      })
    }
    return pages.filter(p => !banned.has(p.id))
  }, [pages, selected])

  function renderNode(node: CodexNode, depth: number) {
    const isCollapsed = collapsed.has(node.id)
    return (
      <div key={node.id}>
        <div
          className={`flex items-center gap-1 rounded px-1 py-1 transition-colors ${
            node.id === selectedId ? 'bg-amber-600/20' : 'hover:bg-stone-800/60'
          }`}
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
          {node.children.length > 0 ? (
            <button
              onClick={() => toggleCollapse(node.id)}
              className="w-4 shrink-0 text-stone-500 hover:text-stone-300 text-xs"
              title={isCollapsed ? 'Déplier' : 'Replier'}
            >
              {isCollapsed ? '▸' : '▾'}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <button
            onClick={() => setSelectedId(node.id)}
            className={`flex-1 min-w-0 text-left text-sm truncate ${
              node.id === selectedId ? 'text-amber-300 font-semibold' : 'text-stone-300 hover:text-white'
            }`}
          >
            {node.visibility === 'mj' && <span title="Visible du MJ seul">🔒 </span>}
            {node.title}
          </button>
        </div>
        {!isCollapsed && node.children.map(child => renderNode(child, depth + 1))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
      {/* Arbre */}
      <div className="bg-stone-900 border border-stone-800 rounded-xl p-3 space-y-2 self-start">
        <div className="flex items-center justify-between">
          <h3 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">Pages</h3>
          <button
            onClick={() => { setCreating(c => !c); setNewParent(selectedId) }}
            className="text-amber-400 hover:text-amber-300 text-sm"
            title="Nouvelle page"
          >
            + Nouvelle
          </button>
        </div>

        {creating && (
          <div className="space-y-1.5 bg-stone-800/60 rounded-lg p-2">
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') create() }}
              placeholder="Titre de la page"
              autoFocus
              className="w-full min-w-0 bg-stone-900 border border-stone-700 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-amber-500"
            />
            <select
              value={newParent ?? ''}
              onChange={e => setNewParent(e.target.value ? Number(e.target.value) : null)}
              className="w-full min-w-0 bg-stone-900 border border-stone-700 rounded px-2 py-1 text-stone-300 text-xs"
            >
              <option value="">— À la racine —</option>
              {pages.map(p => <option key={p.id} value={p.id}>Sous : {p.title}</option>)}
            </select>
            <div className="flex gap-1">
              <button
                onClick={create}
                disabled={busy || !newTitle.trim()}
                className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs rounded py-1 transition-colors"
              >
                Créer
              </button>
              <button
                onClick={() => { setCreating(false); setNewTitle('') }}
                className="px-2 text-stone-500 hover:text-stone-300 text-xs"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {tree.length === 0 ? (
          <p className="text-stone-600 text-xs italic py-2">
            {emptyHint ?? 'Aucune page pour l’instant.'}
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto -mx-1">{tree.map(n => renderNode(n, 0))}</div>
        )}
      </div>

      {/* Page */}
      <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 min-h-[50vh]">
        {!selected ? (
          <p className="text-stone-600 text-sm italic">Choisis une page à gauche, ou crées-en une.</p>
        ) : (
          <div className="space-y-3">
            <input
              value={titleDraft}
              onChange={e => { setTitleDraft(e.target.value); setDirty(true) }}
              className="w-full min-w-0 bg-transparent border-b border-stone-800 focus:border-amber-500 text-white text-xl font-bold px-1 py-1 focus:outline-none transition-colors"
            />

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {onSetVisibility && (
                <select
                  value={selected.visibility}
                  onChange={e => onSetVisibility(selected.id, e.target.value as 'mj' | 'table')}
                  title="Une page « MJ seul » n’apparaît pas du tout chez les joueurs"
                  className="bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-300"
                >
                  <option value="table">👁 Toute la table</option>
                  <option value="mj">🔒 MJ seul</option>
                </select>
              )}
              {onMove && (
                <select
                  value={selected.parent_id ?? ''}
                  onChange={e => onMove(selected.id, e.target.value ? Number(e.target.value) : null)}
                  title="Ranger cette page ailleurs dans l’arbre"
                  className="bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-300 max-w-[200px]"
                >
                  <option value="">— À la racine —</option>
                  {moveTargets.map(p => <option key={p.id} value={p.id}>Sous : {p.title}</option>)}
                </select>
              )}
              {selected.last_editor && (
                <span className="text-stone-600">Dernière écriture : {selected.last_editor}</span>
              )}
              {onDelete && (
                <button onClick={remove} disabled={busy} className="ml-auto text-red-400 hover:text-red-300">
                  Supprimer
                </button>
              )}
            </div>

            <textarea
              value={bodyDraft}
              onChange={e => { setBodyDraft(e.target.value); setDirty(true) }}
              placeholder="Écris ici. Le texte est conservé tel quel, retours à la ligne compris."
              rows={18}
              className="w-full min-w-0 bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-stone-200 text-sm leading-relaxed focus:outline-none focus:border-amber-500 transition-colors resize-y"
            />

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={save}
                disabled={busy || !dirty}
                className="bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-sm font-semibold rounded-lg px-4 py-2 transition-colors"
              >
                {busy ? 'Enregistrement…' : dirty ? 'Enregistrer' : 'Enregistré'}
              </button>
              {dictation.supported && (
                <button
                  onClick={dictation.toggle}
                  title={dictation.listening
                    ? 'Arrêter la dictée'
                    : 'Dicter la suite du texte (l’audio est transcrit par le navigateur, hors de ta machine)'}
                  className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                    dictation.listening
                      ? 'bg-red-700 text-white'
                      : 'bg-stone-800 text-stone-400 hover:text-white'
                  }`}
                >
                  🎤
                </button>
              )}
              {dictation.listening && <span className="text-red-400 text-xs">● Dictée — le texte s’ajoute à la fin.</span>}
              {dirty && <span className="text-stone-600 text-xs">Modifications non enregistrées.</span>}
              {error && <span className="text-amber-400 text-xs">⚠ {error}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
