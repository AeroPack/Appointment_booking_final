// src/core/layout/AppLayout.tsx
import { useState, useEffect, useRef } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Loader2, X } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/core/store/hooks'
import { selectAuthUser, selectToken } from '@/features/auth/auth.selectors'
import { logout, setUser } from '@/features/auth/authSlice'
import { useGetMeQuery } from '@/features/users/usersApi'
import { NAV, type Role } from './nav.config'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { BottomNav } from './BottomNav'

// Single shell for all roles. Sidebar/header/bottom-nav contents come from NAV[role].
export function AppLayout() {
  const user = useAppSelector(selectAuthUser)
  const token = useAppSelector(selectToken)
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const role = (user?.role ?? 'patient') as Role
  const items = NAV[role] ?? []

  // Re-validate user from API on page refresh (background, no flash)
  const initialized = useRef(false)
  const { data: me, error, isLoading } = useGetMeQuery(undefined, {
    skip: !token || initialized.current,
  })

  useEffect(() => {
    if (me) {
      initialized.current = true
      dispatch(setUser(me))
    }
  }, [me, dispatch])

  useEffect(() => {
    if (error) {
      dispatch(logout())
      navigate('/login', { replace: true })
    }
  }, [error, dispatch, navigate])

  const handleLogout = () => {
    dispatch(logout())
    navigate('/login', { replace: true })
  }

  // Full-page loader while validating a stale token on first load
  if (!user && token && isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-border bg-card">
        <Sidebar items={items} onLogout={handleLogout} />
      </aside>

      {/* Main column */}
      <div className="flex flex-1 flex-col min-w-0">
        <Header user={user} onOpenMenu={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <BottomNav items={items} />

      {/* Mobile drawer (reuses Sidebar) */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-card shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 z-10 text-muted-foreground"
            >
              <X className="h-5 w-5" />
            </button>
            <Sidebar items={items} onLogout={handleLogout} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
    </div>
  )
}