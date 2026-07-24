import { useEffect, useState } from 'react'
import { CodexBrowser } from './CodexBrowser'
import {
  createSharedCodexPage, getSharedCodexPages, updateSharedCodexPage, type CodexPage,
} from '../api/codex'
import { usePlayerCharacter } from '../lib/playerIdentity'

/**
 * Le codex côté joueurs. Ils lisent et écrivent — mais ne suppriment pas, et ne
 * changent ni la visibilité ni le rangement : c'est le MJ qui tient la structure.
 * Il n'y a par ailleurs ni dump ni PITR, donc aucune suppression n'est rattrapable.
 *
 * Les pages « MJ seul » ne sont pas filtrées ici : le serveur ne les envoie pas.
 */
export function SharedCodex({ campaignToken }: { campaignToken: string }) {
  const { token: characterToken } = usePlayerCharacter(campaignToken)
  const [pages, setPages] = useState<CodexPage[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getSharedCodexPages(campaignToken)
      .then(p => { if (!cancelled) setPages(p) })
      .catch(() => { if (!cancelled) setError('Codex illisible pour l’instant.') })
    return () => { cancelled = true }
  }, [campaignToken])

  const replace = (page: CodexPage) => {
    setPages(prev => prev.some(p => p.id === page.id)
      ? prev.map(p => (p.id === page.id ? page : p))
      : [...prev, page])
    return page
  }

  return (
    <section>
      <h2 className="text-stone-500 text-xs font-semibold uppercase tracking-widest mb-3">
        Codex de la campagne
      </h2>
      {error && <p className="text-amber-400 text-sm mb-2">⚠ {error}</p>}
      <CodexBrowser
        pages={pages}
        emptyHint="Rien encore. Tu peux ouvrir la première page."
        onCreate={async page => replace(await createSharedCodexPage(campaignToken, page, characterToken))}
        onSave={async (id, patch) => replace(await updateSharedCodexPage(campaignToken, id, patch, characterToken))}
      />
    </section>
  )
}
