import type { LucideIcon } from 'lucide-react'
import {
  Home, Calendar, Users, User, LayoutDashboard, FileText, PlusCircle, Tag, MapPin,
  List, Settings, UserPlus, Stethoscope
} from 'lucide-react'

export type Role = 'doctor' | 'patient' | 'staff'

export interface SearchFeature {
  id: string
  label: string
  icon: LucideIcon
  route: string
  category: 'pages' | 'actions' | 'account'
  keywords: string[]
}

export const SEARCH_FEATURES: Record<Role, SearchFeature[]> = {
  patient: [
    // Pages
    { id: 'patient-home', label: 'Home', icon: Home, route: '/patient/home', category: 'pages', keywords: ['home', 'dashboard', 'main'] },
    { id: 'patient-appointments', label: 'My Appointments', icon: Calendar, route: '/patient/appointments', category: 'pages', keywords: ['appointments', 'bookings', 'schedule'] },
    { id: 'patient-doctors', label: 'Find a Doctor', icon: Stethoscope, route: '/patient/doctors', category: 'pages', keywords: ['doctors', 'find', 'search', 'browse'] },
    { id: 'patient-family', label: 'Family Members', icon: Users, route: '/patient/family', category: 'pages', keywords: ['family', 'members', 'dependents', 'relations'] },
    // Actions
    { id: 'patient-book', label: 'Book Appointment', icon: PlusCircle, route: '/patient/doctors', category: 'actions', keywords: ['book', 'appointment', 'schedule', 'new'] },
    { id: 'patient-add-family', label: 'Add Family Member', icon: UserPlus, route: '/patient/family', category: 'actions', keywords: ['add', 'family', 'member', 'new'] },
    // Account
    { id: 'patient-profile', label: 'My Profile', icon: User, route: '/patient/profile', category: 'account', keywords: ['profile', 'account', 'settings'] },
  ],
  doctor: [
    // Pages
    { id: 'doctor-dashboard', label: 'Dashboard', icon: LayoutDashboard, route: '/doctor/dashboard', category: 'pages', keywords: ['dashboard', 'overview', 'stats'] },
    { id: 'doctor-queue', label: 'Patient Queue', icon: List, route: '/doctor/queue', category: 'pages', keywords: ['queue', 'patients', 'waiting', 'list'] },
    { id: 'doctor-calendar', label: 'Calendar', icon: Calendar, route: '/doctor/calendar', category: 'pages', keywords: ['calendar', 'schedule', 'appointments'] },
    { id: 'doctor-templates', label: 'Message Templates', icon: FileText, route: '/doctor/templates', category: 'pages', keywords: ['templates', 'messages', 'notifications'] },
    { id: 'doctor-settings', label: 'Settings', icon: Settings, route: '/doctor/settings', category: 'pages', keywords: ['settings', 'configuration', 'preferences'] },
    // Actions
    { id: 'doctor-book', label: 'Book Appointment', icon: PlusCircle, route: '/doctor/calendar', category: 'actions', keywords: ['book', 'appointment', 'schedule', 'new'] },
    { id: 'doctor-view-queue', label: 'View Queue', icon: List, route: '/doctor/queue', category: 'actions', keywords: ['view', 'queue', 'patients'] },
    // Account
    { id: 'doctor-profile', label: 'My Profile', icon: User, route: '/doctor/profile', category: 'account', keywords: ['profile', 'account', 'settings'] },
  ],
  staff: [
    // Pages
    { id: 'staff-dashboard', label: 'Dashboard', icon: LayoutDashboard, route: '/staff/dashboard', category: 'pages', keywords: ['dashboard', 'overview', 'stats'] },
    { id: 'staff-patients', label: 'Patients', icon: Users, route: '/staff/patients', category: 'pages', keywords: ['patients', 'directory', 'list'] },
    { id: 'staff-book', label: 'Book on Behalf', icon: PlusCircle, route: '/staff/book-on-behalf', category: 'pages', keywords: ['book', 'behalf', 'appointment', 'schedule'] },
    { id: 'staff-tags', label: 'Tags', icon: Tag, route: '/staff/tags', category: 'pages', keywords: ['tags', 'labels', 'categories'] },
    { id: 'staff-venues', label: 'Venues', icon: MapPin, route: '/staff/venues', category: 'pages', keywords: ['venues', 'locations', 'places'] },
    // Actions
    { id: 'staff-book-patient', label: 'Book for a Patient', icon: UserPlus, route: '/staff/book-on-behalf', category: 'actions', keywords: ['book', 'patient', 'appointment', 'new'] },
    { id: 'staff-add-patient', label: 'Add New Patient', icon: UserPlus, route: '/staff/patients', category: 'actions', keywords: ['add', 'patient', 'new', 'create'] },
    { id: 'staff-create-tag', label: 'Create Tag', icon: Tag, route: '/staff/tags', category: 'actions', keywords: ['create', 'tag', 'new'] },
    { id: 'staff-add-venue', label: 'Add Venue', icon: MapPin, route: '/staff/venues', category: 'actions', keywords: ['add', 'venue', 'new', 'location'] },
    // Account
    { id: 'staff-profile', label: 'My Profile', icon: User, route: '/staff/profile', category: 'account', keywords: ['profile', 'account', 'settings'] },
  ],
}

export const CATEGORY_LABELS: Record<string, string> = {
  pages: 'Pages',
  actions: 'Actions',
  account: 'Account',
}

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  pages: List,
  actions: PlusCircle,
  account: User,
}
