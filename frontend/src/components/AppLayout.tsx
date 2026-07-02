import { type ReactNode } from 'react'
import { Sidebar } from './Sidebar'

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Sidebar />
      <div className="ml-14">{children}</div>
    </>
  )
}
