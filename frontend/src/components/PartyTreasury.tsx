import { useState } from 'react'
import { updateCampaign, formatGold, treasureLineGold, treasuryGold, type Campaign, type TreasureItem } from '../api/campaigns'
import { updateInventory, type Character } from '../api/characters'
import { useToast } from '../contexts/ToastContext'

/**
 * Le coffre du groupe : ce que l'équipe possède en commun, pas encore réparti.
 *
 * Il vivait dans la page Session. Mais un coffre n'appartient pas à une séance :
 * c'est le patrimoine de l'équipe, et « Distribuer » verse l'objet dans l'inventaire
 * d'un personnage. Sa place est sous les statistiques du groupe.
 */
export function PartyTreasury({
  campaign,
  onCampaignChange,
  characters,
}: {
  campaign: Campaign
  onCampaignChange: (campaign: Campaign) => void
  characters: Character[]
}) {
  const toast = useToast()
  const emptyDraft = (): TreasureItem => ({ name: '', quantity: 1, value_gp: null, notes: '' })

  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<TreasureItem>(emptyDraft)
  const [distributingIdx, setDistributingIdx] = useState<number | null>(null)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<TreasureItem>(emptyDraft())
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'default' | 'name' | 'quantity' | 'value'>('default')

  const treasury = campaign.party_treasury ?? []

  /** Point de passage unique : sans lui, chaque geste avalait ses erreurs en silence. */
  async function write(next: TreasureItem[], onDone?: () => void) {
    try {
      onCampaignChange(await updateCampaign(campaign.id, { party_treasury: next }))
      onDone?.()
    } catch {
      toast.error("Le trésor n'a pas pu être enregistré.")
    }
  }

  const handleAdd = () => {
    if (!draft.name.trim()) return
    write([...treasury, { ...draft, name: draft.name.trim() }], () => {
      setDraft(emptyDraft())
      setAdding(false)
    })
  }

  const handleRemove = (index: number) =>
    write(treasury.filter((_, i) => i !== index), () => {
      if (distributingIdx === index) setDistributingIdx(null)
    })

  const handleUpdate = (index: number) => {
    if (!editDraft.name.trim()) return
    write(
      treasury.map((item, i) => (i === index ? { ...editDraft, name: editDraft.name.trim() } : item)),
      () => setEditingIdx(null),
    )
  }

  const handleDuplicate = (index: number) => {
    const src = treasury[index]
    if (!src) return
    write([...treasury, { ...src, name: `${src.name} (copie)` }])
  }

  /**
   * L'objet quitte le coffre et entre dans l'inventaire du personnage. Si l'inventaire
   * s'écrit mais pas le coffre, l'objet existerait en double : on ne retire du coffre
   * qu'une fois l'inventaire confirmé.
   */
  async function handleDistribute(index: number, character: Character) {
    const item = treasury[index]
    if (!item) return

    // L'inventaire d'un personnage garde une valeur en texte libre : on la formate.
    const valueText = formatGold(item.value_gp)
    const items = character.inventory?.items ?? []
    const existing = items.findIndex(i => i.name === item.name && i.value === valueText)
    const nextItems = existing >= 0
      ? items.map((i, idx) => (idx === existing ? { ...i, quantity: i.quantity + item.quantity } : i))
      : [...items, { name: item.name, quantity: item.quantity, weight: 0, value: valueText, notes: item.notes, equipped: false }]

    try {
      await updateInventory(character.id, nextItems)
    } catch {
      toast.error(`« ${item.name} » n'a pas pu être donné à ${character.name}.`)
      return
    }

    await write(treasury.filter((_, i) => i !== index), () => {
      setDistributingIdx(null)
      toast.success(`« ${item.name} » remis à ${character.name}.`)
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest flex items-center gap-2">
          Trésor du groupe ({treasury.length})
          {treasuryGold(treasury) > 0 && (
            <span className="text-amber-400 normal-case tracking-normal font-medium">
              · {formatGold(treasuryGold(treasury))}
            </span>
          )}
        </h2>
        <button
          onClick={() => { setAdding(v => !v); setDraft(emptyDraft()) }}
          className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors"
        >
          {adding ? 'Annuler' : '+ Ajouter'}
        </button>
      </div>

      {adding && (
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 mb-4 space-y-3">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Nom de l'objet *"
              value={draft.name}
              onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
              autoFocus
              className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
            />
            <input
              type="number"
              min={1}
              placeholder="Qté"
              value={draft.quantity}
              onChange={e => setDraft(d => ({ ...d, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
              className="w-20 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm text-center focus:outline-none focus:border-amber-500 transition-colors"
            />
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="Valeur (po)"
              value={draft.value_gp ?? ''}
              onChange={e => setDraft(d => ({ ...d, value_gp: e.target.value === '' ? null : Math.max(0, parseFloat(e.target.value) || 0) }))}
              title="Valeur unitaire en pièces d'or — laissez vide si l'objet n'a pas de prix"
              className="w-36 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>
          <input
            type="text"
            placeholder="Notes (optionnel)"
            value={draft.notes}
            onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
            className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
          />
          <div className="flex justify-end">
            <button
              onClick={handleAdd}
              disabled={!draft.name.trim()}
              className="text-amber-400 hover:text-amber-300 text-sm font-semibold transition-colors disabled:opacity-40"
            >
              Ajouter
            </button>
          </div>
        </div>
      )}

      {treasury.length === 0 && !adding ? (
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-8 text-center">
          <p className="text-stone-500 text-sm">
            Aucun objet dans le coffre.{' '}
            <button onClick={() => setAdding(true)} className="text-amber-400 hover:text-amber-300 transition-colors">
              Ajouter le premier
            </button>
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {treasury.length > 2 && (
            <div className="flex gap-2 mb-1">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un objet…"
                className="flex-1 bg-stone-900 border border-stone-800 rounded-lg px-3 py-1.5 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-stone-600 transition-colors"
              />
              <select
                value={sort}
                onChange={e => setSort(e.target.value as typeof sort)}
                className="bg-stone-900 border border-stone-800 rounded-lg px-2 py-1.5 text-stone-300 text-sm focus:outline-none focus:border-stone-600 transition-colors"
              >
                <option value="default">Défaut</option>
                <option value="name">Nom A→Z</option>
                <option value="quantity">Quantité ↓</option>
                <option value="value">Valeur</option>
              </select>
            </div>
          )}

          {treasury
            .map((item, i) => ({ item, i }))
            .filter(({ item }) =>
              !search
              || item.name.toLowerCase().includes(search.toLowerCase())
              || (item.notes ?? '').toLowerCase().includes(search.toLowerCase()))
            .sort((a, b) => {
              if (sort === 'name') return a.item.name.localeCompare(b.item.name, 'fr')
              if (sort === 'quantity') return b.item.quantity - a.item.quantity
              if (sort === 'value') return treasureLineGold(b.item) - treasureLineGold(a.item)
              return 0
            })
            .map(({ item, i }) => (
              <div key={i} className="bg-stone-900 border border-stone-800 rounded-xl p-4">
                {editingIdx === i ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={editDraft.name}
                        onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))}
                        autoFocus
                        placeholder="Nom *"
                        className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                      />
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={editDraft.value_gp ?? ''}
                        onChange={e => setEditDraft(d => ({ ...d, value_gp: e.target.value === '' ? null : Math.max(0, parseFloat(e.target.value) || 0) }))}
                        placeholder="Valeur (po)"
                        className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-stone-200 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                      />
                    </div>
                    <div className="flex gap-2 items-center">
                      <label className="text-stone-500 text-xs shrink-0">Qté</label>
                      <input
                        type="number"
                        value={editDraft.quantity}
                        onChange={e => setEditDraft(d => ({ ...d, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                        min={1}
                        className="w-20 bg-stone-800 border border-stone-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                      />
                      <input
                        type="text"
                        value={editDraft.notes}
                        onChange={e => setEditDraft(d => ({ ...d, notes: e.target.value }))}
                        placeholder="Notes"
                        className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-stone-200 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <button onClick={() => setEditingIdx(null)} className="text-stone-500 hover:text-stone-300 text-xs transition-colors">Annuler</button>
                      <button
                        onClick={() => handleUpdate(i)}
                        disabled={!editDraft.name.trim()}
                        className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors disabled:opacity-40"
                      >Enregistrer</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-stone-100 text-sm font-semibold">{item.name}</span>
                          {item.quantity > 1 && (
                            <span className="text-xs bg-stone-800 border border-stone-700 text-stone-400 rounded px-1.5 py-0.5">
                              ×{item.quantity}
                            </span>
                          )}
                          {item.value_gp != null && (
                            <span className="text-xs text-amber-400 font-medium">
                              {formatGold(item.value_gp)}
                              {item.quantity > 1 && (
                                <span className="text-stone-500"> · {formatGold(treasureLineGold(item))} au total</span>
                              )}
                            </span>
                          )}
                        </div>
                        {item.notes && <p className="text-stone-500 text-xs mt-1">{item.notes}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => { setEditingIdx(i); setEditDraft({ ...item }); setDistributingIdx(null) }}
                          className="text-xs text-stone-500 hover:text-amber-400 transition-colors"
                          title="Modifier"
                        >✎</button>
                        <button
                          onClick={() => handleDuplicate(i)}
                          className="text-xs text-stone-600 hover:text-sky-400 transition-colors"
                          title="Dupliquer"
                        >⎘</button>
                        <button
                          onClick={() => setDistributingIdx(distributingIdx === i ? null : i)}
                          className="text-xs text-sky-400 hover:text-sky-300 transition-colors font-medium"
                        >
                          Distribuer
                        </button>
                        <button
                          onClick={() => handleRemove(i)}
                          className="text-xs text-stone-600 hover:text-red-400 transition-colors"
                          title="Retirer du coffre"
                        >✕</button>
                      </div>
                    </div>

                    {distributingIdx === i && characters.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-stone-800">
                        <p className="text-stone-500 text-xs mb-2">Donner à :</p>
                        <div className="flex flex-wrap gap-2">
                          {characters.map(c => (
                            <button
                              key={c.id}
                              onClick={() => handleDistribute(i, c)}
                              className="text-xs bg-stone-800 hover:bg-sky-900/40 border border-stone-700 hover:border-sky-700/50 text-stone-300 hover:text-sky-200 rounded-lg px-3 py-1.5 transition-colors"
                            >
                              {c.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
