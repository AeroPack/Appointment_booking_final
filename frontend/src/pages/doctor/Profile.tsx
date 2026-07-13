import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  Edit2,
  Phone,
  LogOut,
  ExternalLink,
  CalendarClock,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Card } from '@/core/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/core/components/ui/avatar';
import { Input } from '@/core/components/ui/input';
import { Textarea } from '@/core/components/ui/textarea';
import { Badge } from '@/core/components/ui/badge';
import { useGetMeQuery, useUpdateMeMutation } from '@/features/users/usersApi';
import { useGetOwnDoctorProfileQuery, useUpdateDoctorProfileMutation } from '@/features/doctors/doctorsApi';
import { useAppDispatch } from '@/core/store/hooks';
import { logout } from '@/features/auth/authSlice';
import { AppSettingsCard } from '@/core/components/shared/AppSettingsCard';
import { PersonalInfoForm } from '@/core/components/shared/PersonalInfoForm';
import { SecurityTipCard } from '@/core/components/shared/SecurityTipCard';

interface DoctorLocalProfile {
  name: string;
  phone: string;
  email: string;
  dob: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  imageUrl: string;
  title: string;
  speciality: string;
  qualification: string;
  registration_number: string;
  bio: string;
  consultation_fee: string;
  experience_years: string;
}

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const {
    data: me,
    isLoading: meLoading,
    isError: meError,
    refetch: refetchMe,
  } = useGetMeQuery();
  const {
    data: doctorProfile,
    isLoading: profileLoading,
    isError: profileError,
    refetch: refetchProfile,
  } = useGetOwnDoctorProfileQuery();
  const [updateMe] = useUpdateMeMutation();
  const [updateDoctorProfile] = useUpdateDoctorProfileMutation();

  const [formData, setFormData] = useState<DoctorLocalProfile>({
    name: '',
    phone: '',
    email: '',
    dob: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    imageUrl: '/placeholder-user.jpg',
    title: '',
    speciality: '',
    qualification: '',
    registration_number: '',
    bio: '',
    consultation_fee: '',
    experience_years: '',
  });

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveMessage, setSaveMessage] = useState('');

  const hasLoadedRef = useRef(false)
  const handleSaveRef = useRef<() => Promise<void>>(() => Promise.resolve())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (me) {
      setFormData((prev) => ({
        ...prev,
        name:     me.name          ?? '',
        phone:    me.mobile_number ?? '',
        email:    me.email         ?? '',
        dob:      me.date_of_birth ? me.date_of_birth.slice(0, 10) : '',
        address:  me.address       ?? '',
        city:     me.city          ?? '',
        state:    me.state         ?? '',
        zipCode:  me.zip_code      ?? '',
        imageUrl: me.avatar_url    ?? '/placeholder-user.jpg',
      }));
    }
  }, [me]);

  useEffect(() => {
    if (doctorProfile) {
      setFormData((prev) => ({
        ...prev,
        title:               doctorProfile.title               ?? '',
        speciality:          doctorProfile.speciality          ?? '',
        qualification:       doctorProfile.qualification       ?? '',
        registration_number: doctorProfile.registration_number ?? '',
        bio:                 doctorProfile.bio                 ?? '',
        consultation_fee:    doctorProfile.consultation_fee    ?? '',
        experience_years:    doctorProfile.experience_years?.toString() ?? '',
      }));
    }
  }, [doctorProfile]);

  useEffect(() => {
    if (me && doctorProfile) hasLoadedRef.current = true
  }, [me, doctorProfile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (saveStatus === 'saving') return
    setSaveStatus('saving');
    setSaveMessage('');
    try {
      const doctorFields = {
        title:               formData.title               || undefined,
        speciality:          formData.speciality          || undefined,
        qualification:       formData.qualification       || undefined,
        registration_number: formData.registration_number || undefined,
        bio:                 formData.bio                 || undefined,
        consultation_fee:    formData.consultation_fee    ? Number(formData.consultation_fee)  : undefined,
        experience_years:    formData.experience_years    ? Number(formData.experience_years)  : undefined,
      }
      const hasDoctorFields = Object.values(doctorFields).some((v) => v !== undefined)

      await Promise.all([
        updateMe({
          name:          formData.name    || undefined,
          email:         formData.email   || undefined,
          address:       formData.address || undefined,
          city:          formData.city    || undefined,
          state:         formData.state   || undefined,
          zip_code:      formData.zipCode || undefined,
          date_of_birth: formData.dob ? formData.dob.slice(0, 10) : undefined,
        }).unwrap(),
        hasDoctorFields ? updateDoctorProfile(doctorFields).unwrap() : Promise.resolve(),
      ]);
      setSaveStatus('success');
      setSaveMessage('Saved');
      setTimeout(() => { setSaveStatus('idle'); setSaveMessage(''); }, 2000);
    } catch {
      setSaveStatus('error');
      setSaveMessage('Save failed');
      setTimeout(() => { setSaveStatus('idle'); setSaveMessage(''); }, 5000);
    }
  };

  useEffect(() => { handleSaveRef.current = handleSave })

  useEffect(() => {
    if (!hasLoadedRef.current) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { handleSaveRef.current() }, 600)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [formData])

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSave();
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/');
  };

  if (meLoading && profileLoading) {
    return <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center text-slate-500">Loading profile...</div>;
  }

  if (meError && profileError) {
    return (
      <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-[#DC2626] mx-auto" />
          <p className="text-[#191c1e] font-semibold">Failed to load profile</p>
          <p className="text-[#64748B] text-[14px]">Could not connect to server. Please try again.</p>
          <Button onClick={() => { refetchMe(); refetchProfile(); }} variant="outline" className="mt-2">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const getInitials = (name: string) => {
    return name
      .replace('Dr. ', '')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const SaveIndicator = () => {
    if (saveStatus === 'idle') return null;
    return (
      <div className={`flex items-center gap-2 text-[12px] font-medium ${saveStatus === 'success' ? 'text-[#006f64]' : saveStatus === 'error' ? 'text-[#DC2626]' : 'text-[#64748B]'}`}>
        {saveStatus === 'saving' && <Loader2 className="w-3 h-3 animate-spin" />}
        {saveStatus === 'success' && <CheckCircle2 className="w-3 h-3" />}
        {saveStatus === 'error' && <AlertCircle className="w-3 h-3" />}
        {saveMessage}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#191c1e] antialiased font-body-base pb-24 md:pb-12">
      <main className="max-w-[1200px] mx-auto px-5 md:px-10 py-8 md:py-12">

        <div className="hidden md:block mb-10">
          <h1 className="text-[32px] font-bold text-[#191c1e] tracking-tight leading-tight">
            Profile & Settings
          </h1>
          <p className="text-[16px] text-[#64748B] mt-2">
            Manage your professional profile and application preferences.
          </p>
        </div>

        <div className="flex flex-col md:grid md:grid-cols-12 gap-6 md:gap-8">

          {/* MOBILE TOP SECTION */}
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
                aria-label="Edit Profile Photo"
                title="Photo upload coming soon"
              >
                <Camera className="w-5 h-5" />
              </button>
            </div>
            <h2 className="text-[24px] font-bold text-[#191c1e] leading-tight mt-2">{formData.name}</h2>
            <p className="text-[16px] text-[#64748B] mt-1">{formData.phone}</p>
          </div>

          {/* LEFT COLUMN */}
          <div className="md:col-span-7 space-y-6 md:space-y-8">

            {/* Desktop Profile Card */}
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
                  aria-label="Edit Profile Photo"
                  title="Photo upload coming soon"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
              <div>
                <h2 className="text-[20px] font-semibold text-[#191c1e]">{formData.title} {formData.name}</h2>
                <p className="text-[#64748B] flex items-center gap-2 mt-1">
                  <Phone className="w-4 h-4" />
                  {formData.phone}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {me?.is_verified && (
                    <Badge variant="secondary" className="bg-[#6df5e1] text-[#006f64] hover:bg-[#6df5e1] px-3 py-1 rounded-lg text-[12px] font-semibold border-0">
                      Verified Doctor
                    </Badge>
                  )}
                </div>
              </div>
            </Card>

            {/* Professional Identity Card */}
            <Card className="p-8 rounded-xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] border-0 bg-white">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[20px] font-semibold text-[#191c1e]">Professional Identity</h3>
                <SaveIndicator />
              </div>
              <form className="space-y-6" onSubmit={handleFormSubmit}>
                <div className="grid grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-[14px] font-semibold text-[#3e4947]">Title</label>
                    <select
                      name="title"
                      value={formData.title}
                      onChange={handleInputChange}
                      className="h-[48px] px-4 rounded-lg border border-[#bdc9c6] bg-[#f7f9fb] text-[#191c1e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005c55] focus-visible:ring-offset-0 transition-all"
                    >
                      <option value="">Select title</option>
                      <option value="Dr.">Dr.</option>
                      <option value="Prof.">Prof.</option>
                      <option value="Mr.">Mr.</option>
                      <option value="Ms.">Ms.</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[14px] font-semibold text-[#3e4947]">Full Name</label>
                    <Input
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="h-[48px] px-4 rounded-lg border-[#bdc9c6] bg-[#f7f9fb] focus-visible:ring-[#005c55] focus-visible:ring-offset-0 transition-all text-[#191c1e]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-[14px] font-semibold text-[#3e4947]">Speciality</label>
                    <Input
                      name="speciality"
                      value={formData.speciality}
                      onChange={handleInputChange}
                      placeholder="e.g. Cardiology"
                      className="h-[48px] px-4 rounded-lg border-[#bdc9c6] bg-[#f7f9fb] focus-visible:ring-[#005c55] focus-visible:ring-offset-0 transition-all text-[#191c1e]"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[14px] font-semibold text-[#3e4947]">Qualification</label>
                    <Input
                      name="qualification"
                      value={formData.qualification}
                      onChange={handleInputChange}
                      placeholder="e.g. MBBS, MD"
                      className="h-[48px] px-4 rounded-lg border-[#bdc9c6] bg-[#f7f9fb] focus-visible:ring-[#005c55] focus-visible:ring-offset-0 transition-all text-[#191c1e]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-[14px] font-semibold text-[#3e4947]">Registration No.</label>
                    <Input
                      name="registration_number"
                      value={formData.registration_number}
                      onChange={handleInputChange}
                      placeholder="e.g. MCI-12345"
                      className="h-[48px] px-4 rounded-lg border-[#bdc9c6] bg-[#f7f9fb] focus-visible:ring-[#005c55] focus-visible:ring-offset-0 transition-all text-[#191c1e]"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[14px] font-semibold text-[#3e4947]">Years of Experience</label>
                    <Input
                      name="experience_years"
                      type="number"
                      min={0}
                      value={formData.experience_years}
                      onChange={handleInputChange}
                      className="h-[48px] px-4 rounded-lg border-[#bdc9c6] bg-[#f7f9fb] focus-visible:ring-[#005c55] focus-visible:ring-offset-0 transition-all text-[#191c1e]"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[14px] font-semibold text-[#3e4947]">Consultation Fee (₹)</label>
                  <Input
                    name="consultation_fee"
                    type="number"
                    min={0}
                    value={formData.consultation_fee}
                    onChange={handleInputChange}
                    className="h-[48px] px-4 rounded-lg border-[#bdc9c6] bg-[#f7f9fb] focus-visible:ring-[#005c55] focus-visible:ring-offset-0 transition-all text-[#191c1e]"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[14px] font-semibold text-[#3e4947]">About / Bio</label>
                  <Textarea
                    name="bio"
                    value={formData.bio}
                    onChange={handleInputChange}
                    className="min-h-[120px] px-4 py-3 rounded-lg border-[#bdc9c6] bg-[#f7f9fb] focus-visible:ring-[#005c55] focus-visible:ring-offset-0 transition-all text-[#191c1e]"
                  />
                </div>
              </form>
            </Card>

            {/* Contact & Personal */}
            <div>
              <PersonalInfoForm
                formData={formData}
                onChange={handleInputChange}
                onSave={handleSave}
              />
              <div className="mt-4 md:hidden bg-white rounded-xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] overflow-hidden">
                <div className="p-6 flex items-center justify-between">
                  <div className="space-y-1">
                    <label className="text-[12px] font-medium text-[#64748B]">Mobile Number</label>
                    <p className="text-[16px] text-[#191c1e]">{formData.phone || 'Not provided'}</p>
                  </div>
                </div>
              </div>
              <div className="hidden md:block mt-6">
                <Card className="p-8 rounded-xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] border-0 bg-white">
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
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="md:col-span-5 space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">

            {/* Public Profile Preview */}
            <Card className="p-6 rounded-xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] border-0 bg-white">
              <h3 className="text-[16px] font-semibold text-[#191c1e] mb-2">Public Profile Preview</h3>
              <p className="text-[12px] text-[#64748B] mb-4">See how your profile looks to patients.</p>
              <Button
                onClick={() => window.open(`/patient/doctor/${me?.id}`, '_blank')}
                variant="outline"
                className="w-full h-[48px] rounded-full border-[#005c55] text-[#005c55] hover:bg-[#005c55]/5 font-semibold text-[14px] flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Preview Profile
              </Button>
            </Card>

            {/* Availability Quick Link */}
            <Card className="p-6 rounded-xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] border-0 bg-white cursor-pointer hover:bg-[#f7f9fb] transition-colors"
              onClick={() => navigate('/doctor/settings')}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#9cf2e8]/30 flex items-center justify-center text-[#005c55]">
                  <CalendarClock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-[16px] font-semibold text-[#191c1e]">Availability</h3>
                  <p className="text-[12px] text-[#64748B]">Manage your consultation hours</p>
                </div>
              </div>
            </Card>

            <AppSettingsCard onLogout={handleLogout} />

            <SecurityTipCard />

            {/* Mobile Logout */}
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
  );
};
