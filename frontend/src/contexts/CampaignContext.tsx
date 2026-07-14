import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { listCampaigns, type Campaign } from '../api/campaigns'
import { listChapters, type Chapter } from '../api/chapters'
import { useAuth } from './AuthContext'

const STORAGE_KEY = 'taverne-current-campaign'

interface CampaignContextValue {
  campaigns: Campaign[]
  loading: boolean
  current: Campaign | null
  currentId: number | null
  select: (id: number) => void
  reload: () => Promise<void>
  /** Les chapitres de la campagne courante : la navigation les liste. */
  chapters: Chapter[]
  /** À appeler après toute écriture sur les chapitres, pour que la navigation suive. */
  reloadChapters: () => Promise<void>
}

const CampaignContext = createContext<CampaignContextValue | null>(null)

function readStoredId(): number | null {
  const raw = Number(localStorage.getItem(STORAGE_KEY))
  return Number.isInteger(raw) && raw > 0 ? raw : null
}

/**
 * The campaign the DM is currently inside. Read from the URL when it says so
 * (`/campaigns/12`, `/combat?campaign=12`), otherwise the last one visited.
 */
function idFromUrl(pathname: string, search: string): number | null {
  const fromPath = pathname.match(/^\/campaigns\/(\d+)/)
  if (fromPath) return Number(fromPath[1])
  const fromQuery = new URLSearchParams(search).get('campaign')
  if (fromQuery && /^\d+$/.test(fromQuery)) return Number(fromQuery)
  return null
}

export function CampaignProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  const { pathname, search } = useLocation()

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [storedId, setStoredId] = useState<number | null>(readStoredId)

  const reload = useCallback(async () => {
    if (!token) { setCampaigns([]); setLoading(false); return }
    setLoading(true)
    try { setCampaigns(await listCampaigns()) } finally { setLoading(false) }
  }, [token])

  useEffect(() => { reload() }, [reload])

  const urlId = idFromUrl(pathname, search)
  const currentId = urlId ?? storedId

  // Remember where the DM last was, so the sidebar survives a reload on a page
  // that carries no campaign in its URL.
  useEffect(() => {
    if (urlId === null || urlId === storedId) return
    localStorage.setItem(STORAGE_KEY, String(urlId))
    setStoredId(urlId)
  }, [urlId, storedId])

  const select = useCallback((id: number) => {
    localStorage.setItem(STORAGE_KEY, String(id))
    setStoredId(id)
  }, [])

  const current = useMemo(
    () => campaigns.find(c => c.id === currentId) ?? null,
    [campaigns, currentId],
  )

  const [chapters, setChapters] = useState<Chapter[]>([])
  const reloadChapters = useCallback(async () => {
    if (!token || !currentId) { setChapters([]); return }
    try { setChapters(await listChapters(currentId)) } catch { /* la navigation se passe de la liste */ }
  }, [token, currentId])

  useEffect(() => { reloadChapters() }, [reloadChapters])

  const value = useMemo(
    () => ({ campaigns, loading, current, currentId: current?.id ?? null, select, reload, chapters, reloadChapters }),
    [campaigns, loading, current, select, reload, chapters, reloadChapters],
  )

  return <CampaignContext.Provider value={value}>{children}</CampaignContext.Provider>
}

export function useCampaigns(): CampaignContextValue {
  const ctx = useContext(CampaignContext)
  if (!ctx) throw new Error('useCampaigns must be used within a CampaignProvider')
  return ctx
}
