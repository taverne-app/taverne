import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCampaigns } from '../contexts/CampaignContext'
import { logout } from '../api/auth'

export function Sidebar() {
  const { user, clearAuth } = useAuth()
  const { campaigns, current, select } = useCampaigns()
  const navigate = useNavigate()
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const switcherRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!switcherOpen) return
    const onClick = (e: MouseEvent) => {
      if (!switcherRef.current?.contains(e.target as Node)) setSwitcherOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSwitcherOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [switcherOpen])

  async function handleLogout() {
    try { await logout() } catch { /* ignore */ }
    clearAuth()
    navigate('/login')
  }

  function goToCampaign(id: number) {
    select(id)
    setSwitcherOpen(false)
    navigate(`/campaigns/${id}/session`)
  }

  /**
   * Les sections de la campagne vivent ici, plus dans une barre d'onglets : elles
   * ont chacune leur URL, donc leur place est dans la navigation. `sep` insère un
   * filet entre les sections de la campagne et les outils de jeu.
   */
  /**
   * Badges des sections — repris de l'ancienne barre d'onglets. Tout vient déjà de la
   * campagne courante, sauf le nombre de séances, compté côté serveur (`sessions_count`)
   * pour ne pas charger leur contenu juste pour afficher un chiffre.
   */
  const badges = current
    ? {
        session:  current.characters?.length || undefined,
        monde:    ((current.npcs?.length ?? 0) + (current.locations?.length ?? 0)) || undefined,
        aventure: (current.quests ?? []).filter(q => q.status === 'active').length || undefined,
        journal:  current.sessions_count || undefined,
      }
    : {}

  const navLinks = current
    ? [
        { to: `/campaigns/${current.id}/session`,  icon: '🎲', label: 'Session',     end: false, sep: false , badge: badges.session },
        { to: `/campaigns/${current.id}/monde`,    icon: '🗺', label: 'Monde',       end: false, sep: false , badge: badges.monde },
        { to: `/campaigns/${current.id}/aventure`, icon: '📜', label: 'Aventure',    end: false, sep: false , badge: badges.aventure },
        { to: `/campaigns/${current.id}/journal`,  icon: '📖', label: 'Journal',     end: false, sep: false , badge: badges.journal },
        { to: `/campaigns/${current.id}/campagne`, icon: '🏰', label: 'Campagne',    end: false, sep: false },
        { to: `/characters?campaign=${current.id}`, icon: '👤', label: 'Personnages', end: false, sep: true },
        { to: `/combat?campaign=${current.id}`,     icon: '⚔', label: 'Combat',      end: false, sep: false },
      ]
    : [{ to: '/campaigns', icon: '🗺', label: 'Campagnes', end: true, sep: false }]

  return (
    <aside className="fixed left-0 top-0 h-screen w-14 hover:w-48 transition-all duration-200 bg-stone-900 border-r border-stone-800 z-50 flex flex-col group">
      {/* Switcher — le bloc de tête indique la campagne courante et permet d'en changer. */}
      <div ref={switcherRef} className="h-14 border-b border-stone-800 shrink-0 relative">
        <button
          onClick={() => setSwitcherOpen(v => !v)}
          className="w-full h-full flex items-center px-4 overflow-hidden hover:bg-stone-800/60 transition-colors"
          title={current ? `Campagne : ${current.name}` : 'La Taverne'}
        >
          <span className="text-xl shrink-0">🍺</span>
          <span className="ml-3 flex-1 min-w-0 text-left text-amber-400 font-display font-semibold text-sm tracking-wide truncate opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            {current?.name ?? 'La Taverne'}
          </span>
          <span className="ml-1 text-stone-600 text-[10px] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">▾</span>
        </button>

        {switcherOpen && (
          <div className="absolute left-full top-2 ml-2 w-60 bg-stone-900 border border-stone-700 rounded-xl shadow-2xl shadow-black/50 py-1.5 z-[60]">
            <p className="px-3 py-1 text-stone-600 text-[10px] font-semibold uppercase tracking-widest">Campagnes</p>
            <div className="max-h-64 overflow-y-auto">
              {campaigns.map(c => (
                <button
                  key={c.id}
                  onClick={() => goToCampaign(c.id)}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
                    c.id === current?.id
                      ? 'text-amber-400 bg-amber-500/10'
                      : 'text-stone-300 hover:bg-stone-800'
                  }`}
                >
                  <span className="w-3 shrink-0 text-xs">{c.id === current?.id ? '✓' : ''}</span>
                  <span className="truncate">{c.name}</span>
                </button>
              ))}
            </div>
            <div className="border-t border-stone-800 mt-1 pt-1">
              <Link
                to="/campaigns?all=1"
                onClick={() => setSwitcherOpen(false)}
                className="block px-3 py-2 text-stone-400 hover:text-stone-200 hover:bg-stone-800 text-sm transition-colors"
              >
                Toutes les campagnes
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 space-y-0.5 overflow-hidden">
        {navLinks.map(({ to, icon, label, end, sep, badge }) => (
          <NavLink
            key={label}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center h-10 px-4 mx-1 rounded-lg transition-colors ${sep ? 'mt-2 border-t border-stone-800 pt-2 h-12' : ''} ${
                isActive
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'text-stone-500 hover:text-stone-200 hover:bg-stone-800'
              }`
            }
          >
            <span className="text-base shrink-0 w-6 text-center">{icon}</span>
            <span className="ml-3 flex-1 text-sm font-medium opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity duration-150">
              {label}
            </span>
            {badge !== undefined && (
              <span className="ml-2 shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-stone-800 text-stone-400 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                {badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom: compte + déconnexion */}
      <div className="border-t border-stone-800 py-3 space-y-0.5 overflow-hidden">
        <NavLink
          to="/account"
          className={({ isActive }) =>
            `flex items-center h-10 px-4 mx-1 rounded-lg transition-colors ${
              isActive
                ? 'bg-amber-500/10 text-amber-400'
                : 'text-stone-500 hover:text-stone-200 hover:bg-stone-800'
            }`
          }
        >
          <span className="text-base shrink-0 w-6 text-center">⚙</span>
          <span className="ml-3 text-sm opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity duration-150 truncate max-w-[7rem]">
            {user?.name ?? 'Compte'}
          </span>
        </NavLink>
        <button
          onClick={handleLogout}
          className="flex items-center h-10 px-4 mx-1 w-[calc(100%-0.5rem)] rounded-lg transition-colors text-stone-600 hover:text-red-400 hover:bg-stone-800"
        >
          <span className="text-base shrink-0 w-6 text-center">↪</span>
          <span className="ml-3 text-sm opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity duration-150">
            Déconnexion
          </span>
        </button>
      </div>
    </aside>
  )
}
