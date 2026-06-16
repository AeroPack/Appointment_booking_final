import { Navigate, Outlet } from 'react-router-dom'
import { useAppSelector } from '@/core/store/hooks'
import { selectToken, selectAuthUser } from '@/features/auth/auth.selectors'

interface RoleGuardProps {
  allow: Array<'patient' | 'doctor' | 'staff'>
  children?: React.ReactNode
}

const roleDashboard: Record<string, string> = {
  patient: '/patient/home',
  doctor: '/doctor/dashboard',
  staff: '/staff/dashboard',
}

export function RoleGuard({ allow, children }: RoleGuardProps) {
  const token = useAppSelector(selectToken)
  const user = useAppSelector(selectAuthUser)

  if (!token) {
    return <Navigate to="/login" replace />
  }

  if (!user || !allow.includes(user.role)) {
    const fallback = user ? roleDashboard[user.role] ?? '/login' : '/login'
    return <Navigate to={fallback} replace />
  }

  return <>{children ?? <Outlet />}</>
}
