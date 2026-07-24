import { useEffect, useState } from 'react'
import { CodexBrowser } from '../../components/CodexBrowser'
import {
  createCodexPage, deleteCodexPage, getCodexPages, updateCodexPage, type CodexPage,
} from '../../api/codex'
import type { SectionProps } from './shared'

/**
 * Section « Codex » : le lore de la campagne, en arborescence libre.
 *
 * Volontairement distinct de la section Monde. Les PNJ et les lieux y sont des
 * ENTITÉS structurées — un lieu porte `map_url`, dont la page Combat dépend. Le codex
 * accueille ce qui n'a pas de structure : histoire, cosmologie, règles maison,
 * résumés de séance. Y redoubler les PNJ créerait deux vérités pour la même auberge.
 */
export default function CampaignCodexSection({ campaign }: SectionProps) {
  const [pages, setPages] = useState<CodexPage[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getCodexPages(campaign.id)
      .then(p => { if (!cancelled) setPages(p) })
      .catch(() => { if (!cancelled) setError('Codex illisible pour l’instant.') })
    return () => { cancelled = true }
  }, [campaign.id])

  /** Une écriture ne renvoie que la page touchée : on remplace en place. */
  const replace = (page: CodexPage) => {
    setPages(prev => prev.some(p => p.id === page.id)
      ? prev.map(p => (p.id === page.id ? page : p))
      : [...prev, page])
    return page
  }

  return (
    <div className="space-y-3">
      <p className="text-stone-500 text-sm">
        Le savoir de la campagne, en pages libres. Les joueurs lisent et écrivent les
        pages « toute la table » ; les pages 🔒 n’apparaissent pas chez eux.
      </p>
      {error && <p className="text-amber-400 text-sm">⚠ {error}</p>}

      <CodexBrowser
        pages={pages}
        emptyHint="Aucune page. Commence par « Le monde », puis range dessous."
        onCreate={async page => replace(await createCodexPage(campaign.id, page))}
        onSave={async (id, patch) => replace(await updateCodexPage(campaign.id, id, patch))}
        onSetVisibility={async (id, visibility) => replace(await updateCodexPage(campaign.id, id, { visibility }))}
        onMove={async (id, parentId) => replace(await updateCodexPage(campaign.id, id, { parent_id: parentId }))}
        onDelete={async id => {
          await deleteCodexPage(campaign.id, id)
          // La suppression emporte la descendance côté serveur : on la retire aussi ici.
          setPages(prev => {
            const doomed = new Set([id])
            let grew = true
            while (grew) {
              grew = false
              prev.forEach(p => {
                if (p.parent_id != null && doomed.has(p.parent_id) && !doomed.has(p.id)) {
                  doomed.add(p.id)
                  grew = true
                }
              })
            }
            return prev.filter(p => !doomed.has(p.id))
          })
        }}
      />
    </div>
  )
}
