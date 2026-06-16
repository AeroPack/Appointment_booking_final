// src/core/layout/BottomNav.tsx
import { NavLink } from 'react-router-dom'
import type { NavItem } from './nav.config'

interface BottomNavProps {
  items: NavItem[]
}

// Mobile-only bottom tab bar. Shows up to 5 primary items.
export function BottomNav({ items }: BottomNavProps) {
  return (
    <nav className="lg:hidden fixed inset-x-0 bottom-0 z-30 flex items-center justify-around h-16 border-t border-border bg-card">
      {items.slice(0, 5).map(({ label, icon: Icon, to }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 text-xs ${isActive ? 'text-primary' : 'text-muted-foreground'}`
          }
        >
          <Icon className="h-5 w-5" /> {label}
        </NavLink>
      ))}
    </nav>
  )
}