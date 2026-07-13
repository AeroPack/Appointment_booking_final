import React, { useState } from 'react'
import { ArrowRight, Loader2, SkipForward } from 'lucide-react'
import { Button } from '@/core/components/ui/button'
import { Card, CardContent } from '@/core/components/ui/card'
import { Input } from '@/core/components/ui/input'

interface ProfileStepProps {
  onSubmit?: (data: {
    title?: 'Dr.' | 'Prof.' | 'Mr.' | 'Ms.'
    speciality?: string
    qualification?: string
    registration_number?: string
    consultation_fee?: number
    experience_years?: number
    bio?: string
  }) => void
  onSkip?: () => void
  isLoading: boolean
  error?: string
}

export function ProfileStep({ onSubmit, onSkip, isLoading, error }: ProfileStepProps) {
  const [title, setTitle] = useState<string>('')
  const [speciality, setSpeciality] = useState('')
  const [qualification, setQualification] = useState('')
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [consultationFee, setConsultationFee] = useState('')
  const [experienceYears, setExperienceYears] = useState('')
  const [bio, setBio] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (onSubmit) {
      onSubmit({
        title: title as 'Dr.' | 'Prof.' | 'Mr.' | 'Ms.' | undefined,
        speciality: speciality || undefined,
        qualification: qualification || undefined,
        registration_number: registrationNumber || undefined,
        consultation_fee: consultationFee ? parseFloat(consultationFee) : undefined,
        experience_years: experienceYears ? parseInt(experienceYears) : undefined,
        bio: bio || undefined,
      })
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-5 py-12 bg-background">
      <div className="w-full max-w-[440px] z-10 flex flex-col items-center">
        <div className="flex flex-col items-center text-center mb-6">
          <h1 className="text-[22px] font-bold leading-[28px] text-text-primary">
            Complete your profile
          </h1>
          <p className="text-[14px] leading-[20px] text-on-surface-variant mt-2">
            Help patients understand your expertise
          </p>
        </div>

        <Card className="w-full border-0 shadow-none bg-transparent md:bg-white md:shadow-[0px_4px_12px_rgba(15,23,42,0.05)] md:border md:border-outline-variant/30 md:rounded-xl">
          <CardContent className="p-0 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="block text-[14px] font-semibold text-on-surface-variant">
                  Title
                </label>
                <select
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full h-[48px] px-4 border border-outline-variant rounded-lg bg-white text-[14px] focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select title</option>
                  <option value="Dr.">Dr.</option>
                  <option value="Prof.">Prof.</option>
                  <option value="Mr.">Mr.</option>
                  <option value="Ms.">Ms.</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-[14px] font-semibold text-on-surface-variant">
                  Speciality
                </label>
                <Input
                  type="text"
                  placeholder="e.g., Cardiology, General Practice"
                  value={speciality}
                  onChange={(e) => setSpeciality(e.target.value)}
                  className="h-[48px] border-outline-variant focus:border-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[14px] font-semibold text-on-surface-variant">
                  Qualification
                </label>
                <Input
                  type="text"
                  placeholder="e.g., MBBS, MD"
                  value={qualification}
                  onChange={(e) => setQualification(e.target.value)}
                  className="h-[48px] border-outline-variant focus:border-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[14px] font-semibold text-on-surface-variant">
                  Registration Number
                </label>
                <Input
                  type="text"
                  placeholder="Medical council registration"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                  className="h-[48px] border-outline-variant focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-[14px] font-semibold text-on-surface-variant">
                    Consultation Fee (₹)
                  </label>
                  <Input
                    type="number"
                    placeholder="500"
                    value={consultationFee}
                    onChange={(e) => setConsultationFee(e.target.value)}
                    min="0"
                    className="h-[48px] border-outline-variant focus:border-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[14px] font-semibold text-on-surface-variant">
                    Experience (years)
                  </label>
                  <Input
                    type="number"
                    placeholder="10"
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                    min="0"
                    max="50"
                    className="h-[48px] border-outline-variant focus:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[14px] font-semibold text-on-surface-variant">
                  Bio
                </label>
                <textarea
                  placeholder="Tell patients about yourself..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="w-full px-4 py-3 border border-outline-variant rounded-lg focus:border-primary focus:ring-1 focus:ring-primary resize-none text-[14px]"
                />
                <p className="text-[12px] text-on-surface-variant text-right">
                  {bio.length}/500
                </p>
              </div>

              {error && (
                <p className="text-[12px] font-medium text-status-error">{error}</p>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-[48px] bg-primary hover:bg-primary-container text-white rounded-full text-[14px] font-semibold"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Continue
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </Button>

              <button
                type="button"
                onClick={onSkip}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 text-[14px] font-medium text-on-surface-variant hover:text-text-primary"
              >
                <SkipForward className="w-4 h-4" />
                Skip for now
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
