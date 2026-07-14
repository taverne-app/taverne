import { useState } from 'react'
import { Link } from 'react-router-dom'
import { updateCampaign, type RandomTable, type RandomTableEntry } from '../api/campaigns'
import { useCampaigns } from '../contexts/CampaignContext'
import { useToast } from '../contexts/ToastContext'

/**
 * Page « Outils » : la boîte à outils du MJ, hors du fil du récit.
 *
 * Les tables aléatoires vivaient dans la page Session, où elles n'avaient rien à faire :
 * on ne les prépare pas, on s'en sert — au moment d'improviser. Elles restent attachées
 * à une campagne (c'est un champ de la campagne), mais on les atteint d'ici.
 */
export default function ToolsPage() {
  const { current, reload } = useCampaigns()
  const toast = useToast()

  const emptyTableDraft = (): RandomTable => ({ name: '', entries: [] })
  const [tableDraft, setTableDraft] = useState<RandomTable>(emptyTableDraft())
  const [addingTable, setAddingTable] = useState(false)
  const [tableResults, setTableResults] = useState<Record<number, string>>({})
  const [editingTableIdx, setEditingTableIdx] = useState<number | null>(null)
  const [entryDraft, setEntryDraft] = useState<RandomTableEntry>({ weight: 1, text: '' })
  const [renamingTableIdx, setRenamingTableIdx] = useState<number | null>(null)
  const [renamingTableDraft, setRenamingTableDraft] = useState('')
  const [editingEntryKey, setEditingEntryKey] = useState<string | null>(null)
  const [editEntryDraft, setEditEntryDraft] = useState<RandomTableEntry>({ weight: 1, text: '' })
  const [tableSearch, setTableSearch] = useState('')

  const tables = current?.random_tables ?? []

  /** Écrit les tables de la campagne courante, et rafraîchit le contexte. */
  async function saveTables(next: RandomTable[]) {
    if (!current) return
    try {
      await updateCampaign(current.id, { random_tables: next })
      await reload()
    } catch {
      toast.error("Les tables n'ont pas pu être enregistrées.")
    }
  }

  async function handleAddTable() {
    if (!tableDraft.name.trim()) return
    await saveTables([...tables, { ...tableDraft, name: tableDraft.name.trim() }])
    setTableDraft(emptyTableDraft())
    setAddingTable(false)
  }
  async function handleDeleteTable(idx: number) {
    await saveTables(tables.filter((_, i) => i !== idx))
    setTableResults(prev => { const n = { ...prev }; delete n[idx]; return n })
  }
  async function handleDuplicateTable(idx: number) {
    const src = tables[idx]
    if (!src) return
    await saveTables([...tables, { ...src, name: `${src.name} (copie)`, entries: [...src.entries] }])
  }
  async function handleRenameTable(idx: number, name: string) {
    if (!name.trim()) { setRenamingTableIdx(null); return }
    await saveTables(tables.map((t, i) => i === idx ? { ...t, name: name.trim() } : t))
    setRenamingTableIdx(null)
  }
  async function handleAddTableEntry(tableIdx: number) {
    if (!entryDraft.text.trim()) return
    await saveTables(tables.map((t, i) =>
      i === tableIdx ? { ...t, entries: [...t.entries, { ...entryDraft, text: entryDraft.text.trim() }] } : t
    ))
    setEntryDraft({ weight: 1, text: '' })
  }
  async function handleDeleteTableEntry(tableIdx: number, entryIdx: number) {
    await saveTables(tables.map((t, i) =>
      i === tableIdx ? { ...t, entries: t.entries.filter((_, j) => j !== entryIdx) } : t
    ))
  }
  async function handleUpdateTableEntry(tableIdx: number, entryIdx: number, entry: RandomTableEntry) {
    if (!entry.text.trim()) { setEditingEntryKey(null); return }
    await saveTables(tables.map((t, i) =>
      i === tableIdx ? { ...t, entries: t.entries.map((e, j) => j === entryIdx ? { ...entry, text: entry.text.trim() } : e) } : t
    ))
    setEditingEntryKey(null)
  }

  /** Tirage pondéré : le poids est une fréquence relative, pas une plage de dés. */
  function handleRollTable(tableIdx: number, table: RandomTable) {
    if (table.entries.length === 0) return
    const total = table.entries.reduce((s, e) => s + (e.weight || 1), 0)
    let roll = Math.random() * total
    for (const entry of table.entries) {
      roll -= entry.weight || 1
      if (roll <= 0) {
        setTableResults(prev => ({ ...prev, [tableIdx]: entry.text }))
        return
      }
    }
    setTableResults(prev => ({ ...prev, [tableIdx]: table.entries[table.entries.length - 1].text }))
  }

  return (
    <div className="min-h-screen bg-stone-950">
      <header className="border-b border-stone-800 bg-stone-900/50">
        <div className="max-w-5xl mx-auto px-4 py-5">
          <h1 className="text-xl font-bold text-white">Outils</h1>
          <p className="text-stone-500 text-sm mt-0.5">De quoi improviser à la table</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {!current ? (
          <div className="bg-stone-900 border border-stone-800 rounded-xl p-8 text-center">
            <p className="text-stone-500 text-sm">
              Les tables appartiennent à une campagne.{' '}
              <Link to="/campaigns" className="text-amber-400 hover:text-amber-300 transition-colors">
                Choisissez-en une
              </Link>
              .
            </p>
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">
                Tables aléatoires ({tables.length}) — {current.name}
              </h2>
              <button
                onClick={() => { setAddingTable(v => !v); setTableDraft(emptyTableDraft()) }}
                className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors shrink-0"
              >
                {addingTable ? 'Annuler' : '+ Table'}
              </button>
            </div>

            {addingTable && (
              <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 mb-4 space-y-3">
                <div>
                  <label className="text-stone-500 text-xs block mb-1">Nom de la table *</label>
                  <input
                    type="text"
                    value={tableDraft.name}
                    onChange={e => setTableDraft(d => ({ ...d, name: e.target.value }))}
                    autoFocus
                    placeholder="ex. Événements de voyage, Météo, PNJ de rue…"
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
                <p className="text-stone-600 text-xs">Vous pourrez ajouter des entrées après la création.</p>
                <div className="flex justify-end">
                  <button
                    onClick={handleAddTable}
                    disabled={!tableDraft.name.trim()}
                    className="bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold rounded-lg px-4 py-2 transition-colors disabled:opacity-40"
                  >
                    Créer
                  </button>
                </div>
              </div>
            )}

            {tables.length === 0 ? (
              !addingTable && (
                <p className="text-stone-600 text-sm text-center py-8">
                  Aucune table. Créez des tables de météo, d'événements ou de noms pour improviser.
                </p>
              )
            ) : (
              <div className="space-y-3">
                {tables.length > 1 && (
                  <input
                    type="text"
                    value={tableSearch}
                    onChange={e => setTableSearch(e.target.value)}
                    placeholder="Rechercher une table…"
                    className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-1.5 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-stone-600 transition-colors"
                  />
                )}
                {tables
                  .map((table, tIdx) => ({ table, tIdx }))
                  .filter(({ table }) => !tableSearch || table.name.toLowerCase().includes(tableSearch.toLowerCase()))
                  .map(({ table, tIdx }) => (
                  <div key={tIdx} className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {renamingTableIdx === tIdx ? (
                          <input
                            autoFocus
                            type="text"
                            value={renamingTableDraft}
                            onChange={e => setRenamingTableDraft(e.target.value)}
                            onBlur={() => handleRenameTable(tIdx, renamingTableDraft)}
                            onKeyDown={e => { if (e.key === 'Enter') handleRenameTable(tIdx, renamingTableDraft); if (e.key === 'Escape') setRenamingTableIdx(null) }}
                            className="bg-stone-800 border border-stone-600 rounded px-2 py-0.5 text-white text-sm focus:outline-none focus:border-amber-500 min-w-0 max-w-xs"
                          />
                        ) : (
                          <span
                            className="text-white text-sm font-medium truncate cursor-pointer hover:text-amber-300 transition-colors"
                            onDoubleClick={() => { setRenamingTableIdx(tIdx); setRenamingTableDraft(table.name) }}
                            title="Double-cliquer pour renommer"
                          >{table.name}</span>
                        )}
                        <span className="text-stone-600 text-xs shrink-0">{table.entries.length} entrée{table.entries.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {tableResults[tIdx] && (
                          <span className="text-amber-300 text-xs max-w-[180px] truncate italic">→ {tableResults[tIdx]}</span>
                        )}
                        <button
                          onClick={() => handleRollTable(tIdx, table)}
                          disabled={table.entries.length === 0}
                          className="bg-amber-600 hover:bg-amber-500 text-black text-xs font-bold rounded-lg px-3 py-1.5 transition-colors disabled:opacity-30"
                        >
                          🎲 Lancer
                        </button>
                        <button
                          onClick={() => handleDuplicateTable(tIdx)}
                          className="text-stone-600 hover:text-sky-400 text-xs transition-colors"
                          title="Dupliquer"
                        >⎘</button>
                        <button
                          onClick={() => setEditingTableIdx(editingTableIdx === tIdx ? null : tIdx)}
                          className="text-stone-500 hover:text-stone-300 text-xs transition-colors"
                        >
                          {editingTableIdx === tIdx ? 'Fermer' : 'Éditer'}
                        </button>
                        <button
                          onClick={() => handleDeleteTable(tIdx)}
                          className="text-stone-600 hover:text-red-400 text-lg leading-none transition-colors"
                        >×</button>
                      </div>
                    </div>
                    {editingTableIdx === tIdx && (
                      <div className="border-t border-stone-800 px-4 pb-4 pt-3 space-y-2">
                        {table.entries.map((entry, eIdx) => {
                          const eKey = `${tIdx}-${eIdx}`
                          if (editingEntryKey === eKey) {
                            return (
                              <div key={eIdx} className="flex items-center gap-2 text-sm">
                                <input
                                  type="number"
                                  value={editEntryDraft.weight}
                                  onChange={e => setEditEntryDraft(d => ({ ...d, weight: Math.max(1, Number(e.target.value)) }))}
                                  min={1}
                                  className="w-14 shrink-0 bg-stone-700 border border-stone-600 rounded px-2 py-1 text-stone-200 text-sm text-center focus:outline-none focus:border-amber-500"
                                />
                                <input
                                  autoFocus
                                  type="text"
                                  value={editEntryDraft.text}
                                  onChange={e => setEditEntryDraft(d => ({ ...d, text: e.target.value }))}
                                  onKeyDown={e => { if (e.key === 'Enter') handleUpdateTableEntry(tIdx, eIdx, editEntryDraft); if (e.key === 'Escape') setEditingEntryKey(null) }}
                                  onBlur={() => handleUpdateTableEntry(tIdx, eIdx, editEntryDraft)}
                                  className="flex-1 min-w-0 bg-stone-700 border border-stone-600 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-amber-500"
                                />
                                <button onClick={() => setEditingEntryKey(null)} className="text-stone-600 hover:text-stone-400 text-xs transition-colors shrink-0">✕</button>
                              </div>
                            )
                          }
                          return (
                            <div key={eIdx} className="flex items-center gap-2 text-sm group">
                              <span className="text-stone-600 text-xs w-6 text-right shrink-0">{entry.weight}</span>
                              <span
                                className="text-stone-300 flex-1 min-w-0 cursor-pointer hover:text-white transition-colors"
                                onClick={() => { setEditingEntryKey(eKey); setEditEntryDraft({ ...entry }) }}
                              >{entry.text}</span>
                              <button
                                onClick={() => handleDeleteTableEntry(tIdx, eIdx)}
                                className="text-stone-600 hover:text-red-400 text-sm transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                              >×</button>
                            </div>
                          )
                        })}
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="number"
                            value={entryDraft.weight}
                            onChange={e => setEntryDraft(d => ({ ...d, weight: Math.max(1, Number(e.target.value)) }))}
                            min={1}
                            title="Poids (fréquence relative)"
                            className="w-14 shrink-0 bg-stone-800 border border-stone-700 rounded-lg px-2 py-1.5 text-stone-200 text-sm text-center focus:outline-none focus:border-amber-500 transition-colors"
                          />
                          <input
                            type="text"
                            value={entryDraft.text}
                            onChange={e => setEntryDraft(d => ({ ...d, text: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter' && entryDraft.text.trim()) handleAddTableEntry(tIdx) }}
                            placeholder="Nouvelle entrée…"
                            className="flex-1 min-w-0 bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                          />
                          <button
                            onClick={() => handleAddTableEntry(tIdx)}
                            disabled={!entryDraft.text.trim()}
                            className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors disabled:opacity-40 shrink-0"
                          >
                            + Ajouter
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
