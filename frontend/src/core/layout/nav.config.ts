// src/core/layout/nav.config.ts
import type { LucideIcon } from 'lucide-react'
import {
  Home, Calendar, Users, User, LayoutDashboard, Clock, FileText, PlusCircle, Tag, MapPin, List, Settings,
} from 'lucide-react'

export type Role = 'doctor' | 'patient' | 'staff'
export interface NavItem { label: string; icon: LucideIcon; to: string }

// One place that defines every role's navigation. Sidebar + BottomNav both read this.
export const NAV: Record<Role, NavItem[]> = {
  patient: [
    { label: 'Home',         icon: Home,            to: '/patient/home' },
    { label: 'Appointments', icon: Calendar,        to: '/patient/appointments' },
    { label: 'Family',       icon: Users,           to: '/patient/family' },
    { label: 'Profile',      icon: User,            to: '/patient/profile' },
  ],
  doctor: [
    { label: 'Dashboard',    icon: LayoutDashboard, to: '/doctor/dashboard' },
    { label: 'Queue',        icon: List,            to: '/doctor/queue' },
    { label: 'Calendar',     icon: Calendar,        to: '/doctor/calendar' },
    { label: 'Availability', icon: Clock,           to: '/doctor/availability' },
    { label: 'Templates',    icon: FileText,        to: '/doctor/templates' },
    { label: 'Settings',     icon: Settings,        to: '/doctor/settings' },
    { label: 'Profile',      icon: User,            to: '/doctor/profile' },
  ],
  staff: [
    { label: 'Dashboard',    icon: LayoutDashboard, to: '/staff/dashboard' },
    { label: 'Patients',     icon: Users,           to: '/staff/patients' },
    { label: 'Book',         icon: PlusCircle,      to: '/staff/book-on-behalf' },
    { label: 'Tags',         icon: Tag,             to: '/staff/tags' },
    { label: 'Venues',       icon: MapPin,          to: '/staff/venues' },
    { label: 'Profile',      icon: User,            to: '/staff/profile' },
  ],
}