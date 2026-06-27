// src/core/layout/Header.tsx
import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Bell, Search, User, LogOut } from 'lucide-react'
import { useAppDispatch } from '@/core/store/hooks'
import { logout } from '@/features/auth/authSlice'
import { Button } from '@/core/components/ui/button'
import { SEARCH_FEATURES, CATEGORY_LABELS, type SearchFeature, type Role } from './search.config'

// Header only renders the name, so it accepts the minimal shape it needs.
// This avoids coupling to AuthUser's location (the generated auth.ts holds
// backend row/payload types, not the frontend AuthUser).
interface HeaderProps {
  user: { name: string | null; role?: string } | null
  onOpenMenu: () => void
}

function initials(name?: string | null) {
  if (!name) return 'U'
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

function getProfileRoute(role?: string) {
  switch (role) {
    case 'doctor': return '/doctor/profile'
    case 'staff': return '/staff/profile'
    default: return '/patient/profile'
  }
}

function fuzzyMatch(query: string, feature: SearchFeature): boolean {
  const q = query.toLowerCase()
  const label = feature.label.toLowerCase()
  const keywords = feature.keywords.map(k => k.toLowerCase())

  // Direct label match
  if (label.includes(q)) return true

  // Keyword match
  return keywords.some(k => k.includes(q))
}

export function Header({ user, onOpenMenu }: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const dispatch = useAppDispatch()

  const role = (user?.role ?? 'patient') as Role

  // Filter features based on search query
  const filteredFeatures = useMemo(() => {
    if (!searchQuery.trim()) {
      return SEARCH_FEATURES[role] ?? []
    }
    return (SEARCH_FEATURES[role] ?? []).filter(f => fuzzyMatch(searchQuery, f))
  }, [searchQuery, role])

  // Group features by category
  const groupedFeatures = useMemo(() => {
    const groups: Record<string, SearchFeature[]> = {}
    filteredFeatures.forEach(f => {
      if (!groups[f.category]) groups[f.category] = []
      groups[f.category]?.push(f)
    })
    return groups
  }, [filteredFeatures])

  // Flatten for keyboard navigation
  const flatFeatures = useMemo(() => filteredFeatures, [filteredFeatures])

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
        setSearchQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [filteredFeatures])

  const handleLogout = () => {
    setDropdownOpen(false)
    setShowLogoutConfirm(true)
  }

  const confirmLogout = () => {
    dispatch(logout())
    navigate('/login', { replace: true })
  }

  const selectFeature = useCallback((feature: SearchFeature) => {
    setSearchOpen(false)
    setSearchQuery('')
    navigate(feature.route)
  }, [navigate])

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, flatFeatures.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (flatFeatures[selectedIndex]) {
          selectFeature(flatFeatures[selectedIndex])
        }
        break
      case 'Escape':
        setSearchOpen(false)
        setSearchQuery('')
        searchInputRef.current?.blur()
        break
    }
  }

  const renderSearchResults = () => {
    if (flatFeatures.length === 0) {
      return (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
          No features found
        </div>
      )
    }

    let globalIndex = -1

    return Object.entries(groupedFeatures).map(([category, features]) => (
      <div key={category}>
        <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {CATEGORY_LABELS[category] ?? category}
        </div>
        {features.map(feature => {
          globalIndex++
          const isSelected = globalIndex === selectedIndex
          return (
            <button
              key={feature.id}
              onClick={() => selectFeature(feature)}
              onMouseEnter={() => setSelectedIndex(globalIndex)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                isSelected
                  ? 'bg-accent text-accent-foreground'
                  : 'text-foreground hover:bg-accent/50'
              }`}
            >
              <feature.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{feature.label}</span>
            </button>
          )
        })}
      </div>
    ))
  }

  return (
    <>
      {/* Mobile header */}
      <header className="lg:hidden flex items-center justify-between h-14 px-4 border-b border-border bg-card">
        <button onClick={onOpenMenu} aria-label="Open menu"><Menu className="h-6 w-6" /></button>
        <span className="font-medium truncate">Hi, {user?.name ?? 'there'}</span>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="h-8 w-8 rounded-full bg-primary/10 text-primary grid place-items-center text-sm font-medium"
          >
            {initials(user?.name)}
          </button>
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-lg shadow-lg z-50 py-1">
              <button
                onClick={() => {
                  setDropdownOpen(false)
                  navigate(getProfileRoute(user?.role))
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors"
              >
                <User className="h-4 w-4" />
                Profile
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Desktop header */}
      <header className="hidden lg:flex items-center h-16 px-6 border-b border-border bg-card">
        <div className="flex-1 max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md" ref={searchRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setSearchOpen(true)
                }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={handleSearchKeyDown}
                className="w-full rounded-lg border border-border bg-background pl-9 pr-12 py-2 text-sm"
                placeholder="Search features..."
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-muted-foreground">
                <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted font-mono">⌘K</kbd>
              </div>
            </div>

            {/* Search results dropdown */}
            {searchOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                {renderSearchResults()}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <button aria-label="Notifications"><Bell className="h-5 w-5" /></button>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="h-9 w-9 rounded-full bg-primary/10 text-primary grid place-items-center text-sm font-medium cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all"
              >
                {initials(user?.name)}
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-lg shadow-lg z-50 py-1">
                  <button
                    onClick={() => {
                      setDropdownOpen(false)
                      navigate(getProfileRoute(user?.role))
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                  >
                    <User className="h-4 w-4" />
                    Profile
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Logout confirmation modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card w-full max-w-sm rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-foreground mb-2">Confirm Logout</h3>
            <p className="text-sm text-muted-foreground mb-6">Are you sure you want to logout?</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowLogoutConfirm(false)}>
                No
              </Button>
              <Button variant="destructive" onClick={confirmLogout}>
                Yes, Logout
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}