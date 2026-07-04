// src/core/layout/Sidebar.tsx
import { NavLink } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { Logo } from '@/core/components/common/Logo'
import type { NavItem } from './nav.config'

interface SidebarProps {
  items: NavItem[]
  onLogout: () => void
  onNavigate?: () => void   // used by the mobile drawer to close on link tap
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
    isActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted'
  }`

// Inner content only (logo + nav + logout). The responsive wrapper lives in AppLayout,
// so this same component renders both the desktop aside and the mobile drawer.
export function Sidebar({ items, onLogout, onNavigate }: SidebarProps) {
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center gap-2 h-16 px-6 border-b border-border">
        <Logo /> <span className="font-semibold">Aeropack Pvt Ltd</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map(({ label, icon: Icon, to }) => (
          <NavLink key={to} to={to} className={linkClass} onClick={onNavigate}>
            <Icon className="h-5 w-5 shrink-0" /> {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-border">
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-muted"
        >
          <LogOut className="h-5 w-5" /> Logout
        </button>
      </div>
    </div>
  )
}