import { useState } from 'react'
import { PenLine, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react'
import { Card } from '@/core/components/ui/card'
import { Input } from '@/core/components/ui/input'

export type SaveStatus = 'idle' | 'saving' | 'success' | 'error'

interface PersonalInfoFormData {
  email: string
  dob: string
  address: string
  city: string
  state: string
  zipCode: string
}

interface PersonalInfoFormProps {
  formData: PersonalInfoFormData
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onSave: () => void
  saveStatus?: SaveStatus
  saveMessage?: string
}

function StatusIndicator({ status, message }: { status: SaveStatus; message?: string }) {
  if (status === 'idle') return null
  return (
    <div className={`flex items-center gap-1.5 text-[12px] font-medium ${
      status === 'success' ? 'text-[#006f64]' :
      status === 'error'   ? 'text-[#DC2626]' :
      'text-[#64748B]'
    }`}>
      {status === 'saving'  && <Loader2      className="w-3 h-3 animate-spin" />}
      {status === 'success' && <CheckCircle2 className="w-3 h-3" />}
      {status === 'error'   && <AlertCircle  className="w-3 h-3" />}
      {message}
    </div>
  )
}

const FIELDS: { label: string; name: keyof PersonalInfoFormData; type?: string }[] = [
  { label: 'Email Address',   name: 'email'   },
  { label: 'Date of Birth',   name: 'dob',    type: 'date' },
  { label: 'Primary Address', name: 'address' },
  { label: 'City',            name: 'city'    },
  { label: 'State',           name: 'state'   },
  { label: 'Zip Code',        name: 'zipCode' },
]

function formatDob(value: string) {
  if (!value) return '—'
  const d = new Date(value + 'T00:00:00')
  if (isNaN(d.getTime())) return value
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

export function PersonalInfoForm({
  formData,
  onChange,
  onSave,
  saveStatus = 'idle',
  saveMessage,
}: PersonalInfoFormProps) {
  const [mobileEditing, setMobileEditing] = useState(false)

  return (
    <>
      {/* Mobile view */}
      <div className="md:hidden bg-white rounded-xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
        <div className="px-6 py-4 bg-[#f2f4f6] border-b border-[#e0e3e5] flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-[#005c55] uppercase tracking-wider">Personal Information</h3>
          {!mobileEditing && (
            <button
              onClick={() => setMobileEditing(true)}
              className="text-[12px] font-semibold text-[#005c55] underline"
            >
              Edit All
            </button>
          )}
        </div>

        {mobileEditing ? (
          <div className="p-4 space-y-4">
            {FIELDS.map((field) => (
              <div key={field.name} className="flex flex-col gap-1">
                <label className="text-[12px] font-medium text-[#64748B]">{field.label}</label>
                <Input
                  type={field.type}
                  name={field.name}
                  value={formData[field.name]}
                  onChange={onChange}
                  className="h-[44px] px-4 rounded-lg border-[#bdc9c6] bg-[#f7f9fb] focus-visible:ring-[#005c55] focus-visible:ring-offset-0 transition-all text-[#191c1e]"
                />
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setMobileEditing(false)}
                className="flex-1 h-[44px] rounded-lg border border-[#bdc9c6] text-[#6e7977] font-semibold text-[14px] flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={() => { onSave(); setMobileEditing(false) }}
                className="flex-1 h-[44px] rounded-lg bg-[#005c55] text-white font-semibold text-[14px] flex items-center justify-center gap-2"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            {FIELDS.map((field, i) => (
              <div
                key={field.name}
                className={`p-6 flex items-center justify-between group hover:bg-[#f7f9fb] transition-colors active:bg-[#f2f4f6] ${i < FIELDS.length - 1 ? 'border-b border-[#e0e3e5]' : ''}`}
                onClick={() => setMobileEditing(true)}
              >
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-[#64748B]">{field.label}</label>
                  <p className="text-[16px] text-[#191c1e] max-w-[240px] truncate">
                    {field.name === 'dob' ? formatDob(formData.dob) : formData[field.name]}
                  </p>
                </div>
                <PenLine className="w-5 h-5 text-[#6e7977]" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Desktop view */}
      <Card className="hidden md:block p-8 rounded-xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] border-0 bg-white">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-[20px] font-semibold text-[#191c1e]">Personal Information</h3>
          <StatusIndicator status={saveStatus} message={saveMessage} />
        </div>
        <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); onSave() }}>
          <div className="grid grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-[14px] font-semibold text-[#3e4947]">Email Address</label>
              <Input
                name="email"
                value={formData.email}
                onChange={onChange}
                className="h-[48px] px-4 rounded-lg border-[#bdc9c6] bg-[#f7f9fb] focus-visible:ring-[#005c55] focus-visible:ring-offset-0 transition-all text-[#191c1e]"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[14px] font-semibold text-[#3e4947]">Date of Birth</label>
              <Input
                type="date"
                name="dob"
                value={formData.dob}
                onChange={onChange}
                className="h-[48px] px-4 rounded-lg border-[#bdc9c6] bg-[#f7f9fb] focus-visible:ring-[#005c55] focus-visible:ring-offset-0 transition-all text-[#191c1e]"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[14px] font-semibold text-[#3e4947]">Residential Address</label>
            <Input
              name="address"
              value={formData.address}
              onChange={onChange}
              className="h-[48px] px-4 rounded-lg border-[#bdc9c6] bg-[#f7f9fb] focus-visible:ring-[#005c55] focus-visible:ring-offset-0 transition-all text-[#191c1e]"
            />
          </div>
          <div className="grid grid-cols-3 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-[14px] font-semibold text-[#3e4947]">City</label>
              <Input
                name="city"
                value={formData.city}
                onChange={onChange}
                className="h-[48px] px-4 rounded-lg border-[#bdc9c6] bg-[#f7f9fb] focus-visible:ring-[#005c55] focus-visible:ring-offset-0 transition-all text-[#191c1e]"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[14px] font-semibold text-[#3e4947]">State</label>
              <Input
                name="state"
                value={formData.state}
                onChange={onChange}
                className="h-[48px] px-4 rounded-lg border-[#bdc9c6] bg-[#f7f9fb] focus-visible:ring-[#005c55] focus-visible:ring-offset-0 transition-all text-[#191c1e]"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[14px] font-semibold text-[#3e4947]">Zip Code</label>
              <Input
                name="zipCode"
                value={formData.zipCode}
                onChange={onChange}
                className="h-[48px] px-4 rounded-lg border-[#bdc9c6] bg-[#f7f9fb] focus-visible:ring-[#005c55] focus-visible:ring-offset-0 transition-all text-[#191c1e]"
              />
            </div>
          </div>
        </form>
      </Card>
    </>
  )
}
