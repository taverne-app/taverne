import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useSharedSheets } from '../lib/sharedSheets'
import { useSharedTheme, type ThemeChoice } from '../lib/sharedTheme'
import { getSharedCampaign } from '../api/share'
import { createPublicEcho, REALTIME_CONFIGURED } from '../lib/echo'

const rowBase = 'flex items-center h-10 px-4 mx-1 rounded-lg transition-colors'
const labelBase = 'ml-3 text-sm font-medium opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity duration-150'

function rowClass(isActive: boolean) {
  return `${rowBase} ${
    isActive ? 'bg-amber-500/10 text-amber-400' : 'text-stone-500 hover:text-stone-200 hover:bg-stone-800'
  }`
}

interface Props {
  /** Campaign share token, used to build the "Campagne" and "Combat" links. */
  campaignShareToken?: string | null
  /** Currently open character sheet token, for active-link highlighting. */
  currentToken?: string
}

const THEME_OPTIONS: [ThemeChoice, string][] = [
  ['dark', 'Sombre'],
  ['light', 'Clair'],
  ['system', 'Système'],
]

export function SharedSidebar({ campaignShareToken, currentToken }: Props) {
  const sheets = useSharedSheets()
  const { themeChoice, chooseTheme } = useSharedTheme()
  const [settingsOpen, setSettingsOpen] = useState(false)

  // L'onglet Combat n'apparaît aux joueurs que lorsqu'un combat est lancé. On lit
  // l'état une fois, puis on suit en direct son ouverture/fermeture par le MJ.
  const [combatActive, setCombatActive] = useState(false)

  useEffect(() => {
    if (!campaignShareToken) { setCombatActive(false); return }
    let cancelled = false
    getSharedCampaign(campaignShareToken)
      .then(c => { if (!cancelled) setCombatActive(!!c.combat_active) })
      .catch(() => { /* lien révoqué ou hors-ligne : on laisse l'onglet masqué */ })
    return () => { cancelled = true }
  }, [campaignShareToken])

  useEffect(() => {
    if (!campaignShareToken || !REALTIME_CONFIGURED) return
    const echo = createPublicEcho()
    echo.channel(`campaign-share.${campaignShareToken}`)
      .listen('.combat.active-changed', (e: { active: boolean }) => setCombatActive(e.active))
    return () => { echo.leave(`campaign-share.${campaignShareToken}`); echo.disconnect() }
  }, [campaignShareToken])

  const multipleSheets = sheets.length > 1
  const soleToken = sheets[0]?.token ?? currentToken

  return (
    <>
      <aside className="fixed left-0 top-0 h-screen w-14 hover:w-48 transition-all duration-200 overflow-hidden bg-stone-900 border-r border-stone-800 z-50 flex flex-col group">
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-stone-800 shrink-0">
          <span className="text-xl shrink-0">🍺</span>
          <span className="ml-3 text-amber-400 font-display font-semibold text-sm tracking-widest opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity duration-150">
            La Taverne
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 space-y-0.5">
          {/* Campagne (read-only DM view) */}
          {campaignShareToken && (
            <NavLink to={`/share/${campaignShareToken}`} end className={({ isActive }) => rowClass(isActive)}>
              <span className="text-base shrink-0 w-6 text-center">🗺</span>
              <span className={labelBase}>Campagne</span>
            </NavLink>
          )}

          {/* Personnage(s) */}
          {multipleSheets ? (
            <div>
              <div className={`${rowBase} text-stone-500`}>
                <span className="text-base shrink-0 w-6 text-center">👤</span>
                <span className={`${labelBase} font-semibold`}>Personnages</span>
              </div>
              {sheets.map(s => (
                <NavLink
                  key={s.token}
                  to={`/share/character/${s.token}`}
                  className={({ isActive }) =>
                    `flex items-center h-9 pl-7 pr-4 mx-1 rounded-lg transition-colors ${
                      isActive || s.token === currentToken
                        ? 'bg-amber-500/10 text-amber-400'
                        : 'text-stone-500 hover:text-stone-200 hover:bg-stone-800'
                    }`
                  }
                >
                  <span className="text-xs shrink-0 w-6 text-center">•</span>
                  <span className="ml-3 text-sm opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity duration-150 truncate max-w-[7rem]">
                    {s.name}
                  </span>
                </NavLink>
              ))}
            </div>
          ) : (
            soleToken && (
              <NavLink to={`/share/character/${soleToken}`} className={({ isActive }) => rowClass(isActive)}>
                <span className="text-base shrink-0 w-6 text-center">👤</span>
                <span className={labelBase}>Personnage</span>
              </NavLink>
            )
          )}

          {/* Combat — seulement quand un combat est en cours */}
          {campaignShareToken && combatActive && (
            <NavLink to={`/share/${campaignShareToken}/combat`} className={({ isActive }) => rowClass(isActive)}>
              <span className="text-base shrink-0 w-6 text-center">⚔</span>
              <span className={labelBase}>Combat</span>
            </NavLink>
          )}
        </nav>

        {/* Bottom: réglages */}
        <div className="border-t border-stone-800 py-3">
          <button
            onClick={() => setSettingsOpen(v => !v)}
            className={`${rowBase} w-[calc(100%-0.5rem)] ${
              settingsOpen ? 'bg-amber-500/10 text-amber-400' : 'text-stone-500 hover:text-stone-200 hover:bg-stone-800'
            }`}
          >
            <span className="text-base shrink-0 w-6 text-center">⚙</span>
            <span className={labelBase}>Paramètres</span>
          </button>
        </div>
      </aside>

      {/* Theme settings popover */}
      {settingsOpen && (
        <>
          <div className="fixed inset-0 z-[55]" onClick={() => setSettingsOpen(false)} />
          <div className="fixed bottom-4 left-16 z-[60] bg-stone-900 border border-stone-700 rounded-xl p-4 shadow-2xl w-56">
            <p className="text-stone-400 text-xs font-semibold uppercase tracking-widest mb-3">Thème</p>
            <div className="flex gap-1.5">
              {THEME_OPTIONS.map(([choice, label]) => (
                <button
                  key={choice}
                  onClick={() => chooseTheme(choice)}
                  className={`flex-1 text-xs px-2 py-1.5 rounded-lg font-semibold transition-colors ${
                    themeChoice === choice ? 'bg-amber-500 text-stone-950' : 'bg-stone-800 text-stone-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  )
}
