// src/core/layout/Header.tsx
import { Menu, Bell, Search } from 'lucide-react'

// Header only renders the name, so it accepts the minimal shape it needs.
// This avoids coupling to AuthUser's location (the generated auth.ts holds
// backend row/payload types, not the frontend AuthUser).
interface HeaderProps {
  user: { name: string | null } | null
  onOpenMenu: () => void
}

function initials(name?: string | null) {
  if (!name) return 'U'
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

export function Header({ user, onOpenMenu }: HeaderProps) {
  return (
    <>
      {/* Mobile header */}
      <header className="lg:hidden flex items-center justify-between h-14 px-4 border-b border-border bg-card">
        <button onClick={onOpenMenu} aria-label="Open menu"><Menu className="h-6 w-6" /></button>
        <span className="font-medium truncate">Hi, {user?.name ?? 'there'}</span>
        <button aria-label="Notifications"><Bell className="h-6 w-6" /></button>
      </header>

      {/* Desktop header */}
      <header className="hidden lg:flex items-center h-16 px-6 border-b border-border bg-card">
        <div className="flex-1 max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm"
              placeholder="Search..."
            />
          </div>
          <div className="flex items-center gap-4">
            <button aria-label="Notifications"><Bell className="h-5 w-5" /></button>
            <div className="h-9 w-9 rounded-full bg-primary/10 text-primary grid place-items-center text-sm font-medium">
              {initials(user?.name)}
            </div>
          </div>
        </div>
      </header>
    </>
  )
}