import { useEffect, useState } from 'react'

export interface SharedSheet {
  token: string
  name: string
  campaignShareToken: string | null
}

const STORAGE_KEY = 'shared-sheets'
const EVENT = 'shared-sheets-change'

export function getSharedSheets(): SharedSheet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Records a character sheet the visitor has opened on this device so the shared
 * sidebar can offer every sheet they were handed a link to. Upserts by token
 * (keeps the label / campaign fresh) and notifies mounted components.
 */
export function rememberSharedSheet(sheet: SharedSheet) {
  const sheets = getSharedSheets()
  const idx = sheets.findIndex(s => s.token === sheet.token)
  if (idx >= 0) {
    if (sheets[idx].name === sheet.name && sheets[idx].campaignShareToken === sheet.campaignShareToken) return
    sheets[idx] = sheet
  } else {
    sheets.push(sheet)
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sheets))
  window.dispatchEvent(new Event(EVENT))
}

export function useSharedSheets(): SharedSheet[] {
  const [sheets, setSheets] = useState<SharedSheet[]>(getSharedSheets)

  useEffect(() => {
    const handler = () => setSheets(getSharedSheets())
    window.addEventListener(EVENT, handler)
    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener(EVENT, handler)
      window.removeEventListener('storage', handler)
    }
  }, [])

  return sheets
}
