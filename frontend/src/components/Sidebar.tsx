import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCampaigns } from '../contexts/CampaignContext'
import { logout } from '../api/auth'

export function Sidebar({ pinned, onTogglePin }: { pinned: boolean; onTogglePin: () => void }) {
  const { user, clearAuth } = useAuth()
  const { campaigns, current, select, chapters } = useCampaigns()
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const switcherRef = useRef<HTMLDivElement>(null)

  /** La section dont le panneau est ouvert, barre repliée. */
  const [hovered, setHovered] = useState<string | null>(null)

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

  // Naviguer ferme le panneau : sans ça, il reste ouvert sur la page d'arrivée,
  // le curseur n'ayant jamais « quitté » l'entrée.
  useEffect(() => { setHovered(null) }, [pathname, search])

  async function handleLogout() {
    try { await logout() } catch { /* ignore */ }
    clearAuth()
    navigate('/login')
  }

  function goToCampaign(id: number) {
    select(id)
    setSwitcherOpen(false)
    navigate(`/campaigns/${id}/chapitres`)
  }

  /**
   * Badges des sections — repris de l'ancienne barre d'onglets. Tout vient déjà de la
   * campagne courante, sans requête supplémentaire.
   */
  const badges = current
    ? {
        chapitres: (chapters ?? []).filter(c => !c.done).length || undefined,
        monde:    ((current.npcs?.length ?? 0) + (current.locations?.length ?? 0)) || undefined,
        bestiaire: (current.custom_monsters ?? []).length || undefined,
      }
    : {}

  /**
   * Les éléments de chaque section : chapitres, personnages, rencontres. On saute de
   * l'un à l'autre depuis n'importe quelle page, sans repasser par une liste.
   */
  const activeChapterId = Number(new URLSearchParams(search).get('chapitre')) || null
  const activeEncounter = new URLSearchParams(search).get('encounter')
  const openCharacterId = Number(pathname.match(/^\/characters\/(\d+)/)?.[1]) || null

  const children = useMemo(() => {
    if (!current) return { chapitres: [], characters: [], encounters: [], bestiaire: [] }
    // Les chapitres terminés sont derrière nous : la navigation sert à préparer la suite.
    const todo = [...chapters]
      .filter(c => !c.done)
      .sort((a, b) => a.position - b.position || a.id - b.id)
    return {
      chapitres: todo.map(c => ({
        key: `chap-${c.id}`,
        to: `/campaigns/${current.id}/chapitres?chapitre=${c.id}`,
        label: c.title || 'Chapitre sans titre',
        active: activeChapterId === c.id,
      })),
      characters: (current.characters ?? []).map(c => ({
        key: `char-${c.id}`,
        to: `/characters/${c.id}`,
        label: c.name,
        active: openCharacterId === c.id,
      })),
      encounters: (current.saved_encounters ?? []).map((e, i) => ({
        key: `enc-${i}`,
        to: `/combat?campaign=${current.id}&encounter=${i}`,
        label: e.name,
        active: activeEncounter === String(i),
      })),
      // Aperçu du bestiaire au survol. Un monstre n'a pas de lien propre : tous
      // mènent à la page, qui porte la recherche et les filtres.
      bestiaire: (current.custom_monsters ?? []).map((m, i) => ({
        key: `mon-${i}`,
        to: `/campaigns/${current.id}/bestiaire`,
        label: m.name || 'Monstre sans nom',
        active: false,
      })),
    }
  }, [current, chapters, activeChapterId, activeEncounter, openCharacterId])

  type NavChild = { key: string; to: string; label: string; active: boolean }
  type NavEntry = {
    to: string; icon: string; label: string; end: boolean; sep: boolean
    badge?: number; children?: NavChild[]
  }

  const navLinks: NavEntry[] = current
    ? [
        { to: `/campaigns/${current.id}/chapitres`, icon: '📖', label: 'Chapitres',   end: false, sep: false , badge: badges.chapitres, children: children.chapitres },
        { to: `/campaigns/${current.id}/monde`,    icon: '🗺', label: 'Monde',       end: false, sep: false , badge: badges.monde },
        { to: `/campaigns/${current.id}/bestiaire`, icon: '🐉', label: 'Bestiaire',  end: false, sep: false , badge: badges.bestiaire, children: children.bestiaire },
        { to: `/campaigns/${current.id}/campagne`, icon: '🏰', label: 'Campagne',    end: false, sep: false },
        { to: `/characters?campaign=${current.id}`, icon: '👤', label: 'Personnages', end: false, sep: true, children: children.characters },
        { to: `/combat?campaign=${current.id}`,     icon: '⚔', label: 'Combat',      end: false, sep: false, children: children.encounters },
      ]
    : [{ to: '/campaigns', icon: '🗺', label: 'Campagnes', end: true, sep: false }]

  /**
   * Deux états, sans entre-deux : repliée, la barre montre ses icônes et sort un
   * panneau au survol de chacune — comme le switcher de campagnes, elle n'a donc
   * pas besoin de s'élargir. Épinglée, elle est ouverte et déplie ses listes sur
   * place. Le survol ne l'élargit plus : c'était la troisième largeur, celle qui
   * poussait le contenu sans qu'on l'ait demandé.
   */
  const openLabels = pinned ? '' : 'hidden'

  return (
    <aside className={`fixed left-0 top-0 h-screen ${pinned ? 'w-48' : 'w-14'} transition-all duration-200 bg-stone-900 border-r border-stone-800 z-50 flex flex-col`}>
      {/* Switcher — le bloc de tête indique la campagne courante et permet d'en changer. */}
      <div ref={switcherRef} className="h-14 border-b border-stone-800 shrink-0 relative flex items-center">
        <button
          onClick={() => setSwitcherOpen(v => !v)}
          className="flex-1 min-w-0 h-full flex items-center px-4 overflow-hidden hover:bg-stone-800/60 transition-colors"
          title={current ? `Campagne : ${current.name}` : 'La Taverne'}
        >
          <span className="text-xl shrink-0 w-6 text-center">🍺</span>
          <span className={`ml-3 flex-1 min-w-0 text-left text-amber-400 font-display font-semibold text-sm tracking-wide truncate ${openLabels}`}>
            {current?.name ?? 'La Taverne'}
          </span>
          <span className={`ml-1 text-stone-600 text-[10px] shrink-0 ${openLabels}`}>▾</span>
        </button>

        {pinned && (
          <button
            onClick={onTogglePin}
            title="Détacher la barre — elle se repliera"
            aria-pressed
            className="shrink-0 h-full px-2 text-sm text-amber-400 hover:text-amber-300 transition-colors"
          >
            📌
          </button>
        )}

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
              {/* Barre repliée, l'épingle n'a nulle part où tenir : sa place est ici. */}
              <button
                onClick={() => { onTogglePin(); setSwitcherOpen(false) }}
                aria-pressed={pinned}
                className="w-full text-left px-3 py-2 text-stone-400 hover:text-stone-200 hover:bg-stone-800 text-sm transition-colors"
              >
                {pinned ? '📌 Détacher la barre' : '📍 Épingler la barre'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation. Repliée, les panneaux doivent pouvoir sortir de la barre : pas de
          `overflow` qui les rognerait. Épinglée, la liste peut être longue et défile. */}
      <nav className={`flex-1 py-3 space-y-0.5 ${pinned ? 'overflow-y-auto overflow-x-hidden' : 'overflow-visible'}`}>
        {navLinks.map(({ to, icon, label, end, sep, badge, children: items }) => (
          <div
            key={label}
            className="relative"
            onMouseEnter={() => setHovered(label)}
            onMouseLeave={() => setHovered(null)}
          >
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center h-10 px-3 mx-1 rounded-lg transition-colors ${sep ? 'mt-2 border-t border-stone-800 pt-2 h-12' : ''} ${
                  isActive
                    ? 'bg-amber-500/10 text-amber-400'
                    : 'text-stone-500 hover:text-stone-200 hover:bg-stone-800'
                }`
              }
            >
              <span className="text-base shrink-0 w-6 text-center">{icon}</span>
              <span className={`ml-3 flex-1 text-sm font-medium whitespace-nowrap ${openLabels}`}>
                {label}
              </span>
              {badge !== undefined && (
                <span className={`ml-2 shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-stone-800 text-stone-400 ${openLabels}`}>
                  {badge}
                </span>
              )}
            </NavLink>

            {/* Barre épinglée : les éléments se déplient sur place, sous leur section.
                La colonne de coche s'aligne sous l'icône. */}
            {pinned && items && items.length > 0 && (
              <div className="mx-1 space-y-px">
                {items.map(item => (
                  <Link
                    key={item.key}
                    to={item.to}
                    className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      item.active
                        ? 'text-amber-400 bg-amber-500/10'
                        : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                    }`}
                  >
                    <span className="w-6 shrink-0 text-center text-xs">{item.active ? '✓' : ''}</span>
                    <span className="truncate">{item.label}</span>
                  </Link>
                ))}
              </div>
            )}

            {/* Barre repliée : le panneau de la section. Il est collé à la barre
                (`left-full`, marge à l'intérieur) pour que le curseur puisse y entrer
                sans traverser un vide qui le refermerait. */}
            {!pinned && hovered === label && (
              <div className="absolute left-full top-0 pl-2 z-[60]">
                <div className="w-56 bg-stone-900 border border-stone-700 rounded-xl shadow-2xl shadow-black/50 py-1.5">
                  <p className="px-3 py-1 text-stone-600 text-[10px] font-semibold uppercase tracking-widest">
                    {label}
                  </p>
                  {items && items.length > 0 ? (
                    <div className="max-h-72 overflow-y-auto">
                      {items.map(item => (
                        <Link
                          key={item.key}
                          to={item.to}
                          className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                            item.active
                              ? 'text-amber-400 bg-amber-500/10'
                              : 'text-stone-300 hover:bg-stone-800'
                          }`}
                        >
                          <span className="w-3 shrink-0 text-xs">{item.active ? '✓' : ''}</span>
                          <span className="truncate">{item.label}</span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="px-3 py-2 text-stone-600 text-xs">Ouvrir la section</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Bottom: outils + compte + déconnexion. Les outils ne dépendent d'aucune
          campagne : leur place est ici, avec les réglages, pas dans le fil du récit. */}
      <div className="border-t border-stone-800 py-3 space-y-0.5 overflow-hidden">
        <NavLink
          to="/outils"
          title="Outils"
          className={({ isActive }) =>
            `flex items-center h-10 px-3 mx-1 rounded-lg transition-colors ${
              isActive
                ? 'bg-amber-500/10 text-amber-400'
                : 'text-stone-500 hover:text-stone-200 hover:bg-stone-800'
            }`
          }
        >
          <span className="text-base shrink-0 w-6 text-center">🎲</span>
          <span className={`ml-3 text-sm whitespace-nowrap ${openLabels}`}>Outils</span>
        </NavLink>
        <NavLink
          to="/account"
          title={user?.name ?? 'Compte'}
          className={({ isActive }) =>
            `flex items-center h-10 px-3 mx-1 rounded-lg transition-colors ${
              isActive
                ? 'bg-amber-500/10 text-amber-400'
                : 'text-stone-500 hover:text-stone-200 hover:bg-stone-800'
            }`
          }
        >
          <span className="text-base shrink-0 w-6 text-center">⚙</span>
          <span className={`ml-3 text-sm whitespace-nowrap truncate max-w-[7rem] ${openLabels}`}>
            {user?.name ?? 'Compte'}
          </span>
        </NavLink>
        <button
          onClick={handleLogout}
          title="Déconnexion"
          className="flex items-center h-10 px-3 mx-1 w-[calc(100%-0.5rem)] rounded-lg transition-colors text-stone-600 hover:text-red-400 hover:bg-stone-800"
        >
          <span className="text-base shrink-0 w-6 text-center">↪</span>
          <span className={`ml-3 text-sm whitespace-nowrap ${openLabels}`}>
            Déconnexion
          </span>
        </button>
      </div>
    </aside>
  )
}
