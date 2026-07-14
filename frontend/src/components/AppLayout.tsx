import { useCallback, useState, type ReactNode } from 'react'
import { Sidebar } from './Sidebar'

const PIN_KEY = 'taverne-sidebar-pinned'

/**
 * La barre de navigation s'épingle : repliée, elle ne montre que ses icônes et il
 * faut la survoler pour voir les séances, personnages et rencontres. Épinglée, elle
 * reste ouverte — et le contenu se décale d'autant, sinon elle le recouvrirait.
 */
export function AppLayout({ children }: { children: ReactNode }) {
  const [pinned, setPinned] = useState(() => localStorage.getItem(PIN_KEY) === '1')

  const togglePin = useCallback(() => {
    setPinned(prev => {
      const next = !prev
      localStorage.setItem(PIN_KEY, next ? '1' : '0')
      return next
    })
  }, [])

  return (
    <>
      <Sidebar pinned={pinned} onTogglePin={togglePin} />
      <div className={`transition-all duration-200 ${pinned ? 'ml-48' : 'ml-14'}`}>{children}</div>
    </>
  )
}
