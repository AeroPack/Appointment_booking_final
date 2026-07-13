import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Edit2, Phone, LogOut } from 'lucide-react'
import { Button } from '@/core/components/ui/button'
import { Card } from '@/core/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/core/components/ui/avatar'
import { Input } from '@/core/components/ui/input'
import { Badge } from '@/core/components/ui/badge'
import { useGetMeQuery, useUpdateMeMutation } from '@/features/users/usersApi'
import { useAppDispatch } from '@/core/store/hooks'
import { logout } from '@/features/auth/authSlice'
import { AppSettingsCard } from '@/core/components/shared/AppSettingsCard'
import { PersonalInfoForm } from '@/core/components/shared/PersonalInfoForm'
import { SecurityTipCard } from '@/core/components/shared/SecurityTipCard'
import type { SaveStatus } from '@/core/components/shared/PersonalInfoForm'

interface StaffLocalProfile {
  name: string
  phone: string
  email: string
  dob: string
  address: string
  city: string
  state: string
  zipCode: string
  imageUrl: string
}

export const Profile: React.FC = () => {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { data: me, isLoading } = useGetMeQuery()
  const [updateProfile] = useUpdateMeMutation()

  const [formData, setFormData] = useState<StaffLocalProfile>({
    name: '', phone: '', email: '', dob: '',
    address: '', city: '', state: '', zipCode: '',
    imageUrl: '/placeholder-user.jpg',
  })

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveMessage, setSaveMessage] = useState('')

  const hasLoadedRef = useRef(false)
  const handleSaveRef = useRef<() => Promise<void>>(() => Promise.resolve())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (me) {
      setFormData({
        name:     me.name          ?? '',
        phone:    me.mobile_number ?? '',
        email:    me.email         ?? '',
        dob:      me.date_of_birth ? me.date_of_birth.slice(0, 10) : '',
        address:  me.address       ?? '',
        city:     me.city          ?? '',
        state:    me.state         ?? '',
        zipCode:  me.zip_code      ?? '',
        imageUrl: me.avatar_url    ?? '/placeholder-user.jpg',
      })
      hasLoadedRef.current = true
    }
  }, [me])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSave = async () => {
    if (saveStatus === 'saving') return
    setSaveStatus('saving')
    setSaveMessage('')
    try {
      await updateProfile({
        name:          formData.name    || undefined,
        email:         formData.email   || undefined,
        address:       formData.address || undefined,
        city:          formData.city    || undefined,
        state:         formData.state   || undefined,
        zip_code:      formData.zipCode || undefined,
        date_of_birth: formData.dob ? formData.dob.slice(0, 10) : undefined,
      }).unwrap()
      setSaveStatus('success')
      setSaveMessage('Saved')
      setTimeout(() => { setSaveStatus('idle'); setSaveMessage('') }, 2000)
    } catch {
      setSaveStatus('error')
      setSaveMessage('Save failed')
      setTimeout(() => { setSaveStatus('idle'); setSaveMessage('') }, 5000)
    }
  }

  useEffect(() => { handleSaveRef.current = handleSave })

  useEffect(() => {
    if (!hasLoadedRef.current) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { handleSaveRef.current() }, 600)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [formData])

  const handleLogout = () => { dispatch(logout()); navigate('/') }

  if (isLoading) {
    return <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center text-slate-500">Loading profile...</div>
  }

  const getInitials = (name: string) =>
    name.replace('Dr. ', '').split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#191c1e] antialiased font-body-base pb-24 md:pb-12">
      <main className="max-w-[1200px] mx-auto px-5 md:px-10 py-8 md:py-12">

        <div className="hidden md:block mb-10">
          <h1 className="text-[32px] font-bold text-[#191c1e] tracking-tight leading-tight">Profile & Settings</h1>
          <p className="text-[16px] text-[#64748B] mt-2">Manage your personal information and application preferences.</p>
        </div>

        <div className="flex flex-col md:grid md:grid-cols-12 gap-6 md:gap-8">

          {/* Mobile top section */}
          <div className="md:hidden flex flex-col items-center text-center mb-2 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="relative group mb-4">
              <Avatar className="w-32 h-32 ring-4 ring-[#9cf2e8] shadow-sm">
                <AvatarImage src={formData.imageUrl} alt={formData.name} className="object-cover" />
                <AvatarFallback className="bg-[#005c55] text-white text-3xl font-bold">
                  {getInitials(formData.name)}
                </AvatarFallback>
              </Avatar>
              <button
                className="absolute bottom-0 right-0 bg-[#005c55] text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform opacity-50 cursor-not-allowed"
                aria-label="Edit Profile Photo" title="Photo upload coming soon"
              >
                <Camera className="w-5 h-5" />
              </button>
            </div>
            <h2 className="text-[24px] font-bold text-[#191c1e] leading-tight mt-2">{formData.name}</h2>
            <p className="text-[16px] text-[#64748B] mt-1">{formData.phone}</p>
          </div>

          {/* LEFT COLUMN */}
          <div className="md:col-span-7 space-y-6 md:space-y-8">

            {/* Desktop profile card */}
            <Card className="hidden md:flex p-8 rounded-xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] border-0 flex-col md:flex-row gap-8 items-center bg-white">
              <div className="relative group shrink-0">
                <Avatar className="w-32 h-32 border-4 border-[#f2f4f6] ring-2 ring-[#4fdbc8]">
                  <AvatarImage src={formData.imageUrl} alt={formData.name} className="object-cover" />
                  <AvatarFallback className="bg-[#005c55] text-white text-3xl font-bold">
                    {getInitials(formData.name)}
                  </AvatarFallback>
                </Avatar>
                <button
                  className="absolute bottom-1 right-1 bg-[#005c55] text-white p-2.5 rounded-full opacity-50 cursor-not-allowed"
                  aria-label="Edit Profile Photo" title="Photo upload coming soon"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
              <div>
                <h2 className="text-[20px] font-semibold text-[#191c1e]">{formData.name}</h2>
                <p className="text-[#64748B] flex items-center gap-2 mt-1">
                  <Phone className="w-4 h-4" />
                  {formData.phone}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {me?.is_verified && (
                    <Badge variant="secondary" className="bg-[#6df5e1] text-[#006f64] hover:bg-[#6df5e1] px-3 py-1 rounded-lg text-[12px] font-semibold border-0">
                      Active Staff
                    </Badge>
                  )}
                </div>
              </div>
            </Card>

            <PersonalInfoForm
              formData={formData}
              onChange={handleInputChange}
              onSave={handleSave}
              saveStatus={saveStatus}
              saveMessage={saveMessage}
            />

            {/* Mobile: read-only phone */}
            <div className="md:hidden bg-white rounded-xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] overflow-hidden">
              <div className="p-6">
                <label className="text-[12px] font-medium text-[#64748B]">Mobile Number</label>
                <p className="text-[16px] text-[#191c1e] mt-1">{formData.phone || 'Not provided'}</p>
              </div>
            </div>

            {/* Desktop: read-only phone */}
            <Card className="hidden md:block p-8 rounded-xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] border-0 bg-white">
              <h3 className="text-[20px] font-semibold text-[#191c1e] mb-6">Contact</h3>
              <div className="flex flex-col gap-2">
                <label className="text-[14px] font-semibold text-[#3e4947]">Mobile Number</label>
                <Input
                  value={formData.phone}
                  disabled
                  className="h-[48px] px-4 rounded-lg border-[#bdc9c6] bg-[#e9eceb] text-[#6e7977] cursor-not-allowed"
                />
                <p className="text-[12px] text-[#64748B] mt-1">Mobile number cannot be changed</p>
              </div>
            </Card>
          </div>

          {/* RIGHT COLUMN */}
          <div className="md:col-span-5 space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">

            <AppSettingsCard onLogout={handleLogout} />

            <SecurityTipCard />

            {/* Mobile logout */}
            <div className="md:hidden mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
              <Button
                onClick={handleLogout}
                variant="outline"
                className="w-full h-[56px] rounded-xl border border-[#DC2626]/20 bg-white text-[#DC2626] hover:bg-[#ffdad6]/20 font-semibold text-[14px] shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <LogOut className="w-5 h-5" />
                Log out
              </Button>
              <div className="text-center mt-8 opacity-60">
                <p className="text-[12px] font-medium text-[#64748B]">
                  CareConnect Version 2.4.1 (Build 882)<br />
                  Secure Medical Compliance Active
                </p>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}
