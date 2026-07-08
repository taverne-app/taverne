import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { logout } from '../api/auth'

const NAV_LINKS = [
  { to: '/campaigns', icon: '🗺', label: 'Campagnes' },
  { to: '/characters', icon: '👤', label: 'Personnages' },
  { to: '/combat', icon: '⚔', label: 'Combat' },
]

export function Sidebar() {
  const { user, clearAuth } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    try { await logout() } catch { /* ignore */ }
    clearAuth()
    navigate('/login')
  }

  return (
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
        {NAV_LINKS.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center h-10 px-4 mx-1 rounded-lg transition-colors ${
                isActive
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'text-stone-500 hover:text-stone-200 hover:bg-stone-800'
              }`
            }
          >
            <span className="text-base shrink-0 w-6 text-center">{icon}</span>
            <span className="ml-3 text-sm font-medium opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity duration-150">
              {label}
            </span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom: compte + déconnexion */}
      <div className="border-t border-stone-800 py-3 space-y-0.5">
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
