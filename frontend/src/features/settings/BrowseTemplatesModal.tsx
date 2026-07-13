import { useState } from "react"
import { X, Check } from "lucide-react"
import { Button } from "@/core/components/ui/button"
import { type TemplateCategory } from "./TemplateCard"

// ─── Preset Library ──────────────────────────────────────────────────────────

interface TemplatePreset {
  name: string
  subject: string
  content: string
}

const TEMPLATE_PRESETS: Record<string, TemplatePreset[]> = {
  reminder_24h: [
    {
      name: "Formal",
      subject: "Appointment Reminder - {{patient_name}}",
      content:
        "Dear {{patient_name}},\n\nThis is a reminder that you have an appointment with {{doctor_name}} at {{slot_time}}.\n\nPlease arrive 10 minutes early.\n\nThank you,\n{{clinic_name}}",
    },
    {
      name: "Friendly",
      subject: "See you tomorrow, {{patient_name}}!",
      content:
        "Hi {{patient_name}}! 👋\n\nJust a friendly reminder about your appointment with {{doctor_name}} tomorrow at {{slot_time}}.\n\nWe look forward to seeing you!\n\n{{clinic_name}}",
    },
    {
      name: "Concise",
      subject: "Reminder: Appointment at {{slot_time}}",
      content:
        "{{patient_name}}, reminder: appointment with {{doctor_name}} at {{slot_time}}. Reply CONFIRM to confirm or CANCEL to cancel.",
    },
  ],
  reminder_6h: [
    {
      name: "Formal",
      subject: "Appointment in 6 hours - {{patient_name}}",
      content:
        "Dear {{patient_name}},\n\nYour appointment with {{doctor_name}} is scheduled for {{slot_time}} today.\n\nPlease ensure you have all necessary documents.\n\n{{clinic_name}}",
    },
    {
      name: "Friendly",
      subject: "Your appointment is in 6 hours",
      content:
        "Hi {{patient_name}}! Your appointment with {{doctor_name}} is coming up at {{slot_time}} today.\n\nSee you soon!\n\n{{clinic_name}}",
    },
    {
      name: "Concise",
      subject: "Appointment in 6h at {{slot_time}}",
      content:
        "{{patient_name}}, your appointment with {{doctor_name}} is in 6 hours at {{slot_time}}. Reply CONFIRM to confirm.",
    },
  ],
  reminder_1h: [
    {
      name: "Formal",
      subject: "Appointment in 1 hour",
      content:
        "Dear {{patient_name}},\n\nYour appointment with {{doctor_name}} begins in 1 hour at {{slot_time}}.\n\nPlease proceed to the clinic.\n\n{{clinic_name}}",
    },
    {
      name: "Friendly",
      subject: "See you in 1 hour!",
      content:
        "Hi {{patient_name}}! Just 1 more hour until your appointment with {{doctor_name}} at {{slot_time}}.\n\nSee you soon!",
    },
    {
      name: "Concise",
      subject: "Appointment in 1 hour",
      content:
        "{{patient_name}}, appointment with {{doctor_name}} in 1 hour at {{slot_time}}. See you soon!",
    },
  ],
  cancel: [
    {
      name: "Formal",
      subject: "Appointment Cancellation Confirmation",
      content:
        "Dear {{patient_name}},\n\nYour appointment with {{doctor_name}} at {{slot_time}} has been cancelled.\n\nIf this was a mistake, please contact us to reschedule.\n\n{{clinic_name}}",
    },
    {
      name: "Friendly",
      subject: "Your appointment has been cancelled",
      content:
        "Hi {{patient_name}},\n\nYour appointment with {{doctor_name}} at {{slot_time}} has been cancelled.\n\nNeed to rebook? Just reply to this message!\n\n{{clinic_name}}",
    },
    {
      name: "Concise",
      subject: "Appointment Cancelled",
      content:
        "{{patient_name}}, your appointment with {{doctor_name}} at {{slot_time}} has been cancelled. Contact us to reschedule.",
    },
  ],
  delay: [
    {
      name: "Formal",
      subject: "Appointment Delay Notice",
      content:
        "Dear {{patient_name}},\n\nWe regret to inform you that your appointment with {{doctor_name}} at {{slot_time}} has been delayed.\n\nWe apologize for the inconvenience. Please contact us for more details.\n\n{{clinic_name}}",
    },
    {
      name: "Friendly",
      subject: "Heads up - appointment delayed",
      content:
        "Hi {{patient_name}},\n\nSorry for the wait! Your appointment with {{doctor_name}} at {{slot_time}} has been delayed.\n\nWe'll update you shortly. Thanks for your patience!\n\n{{clinic_name}}",
    },
    {
      name: "Concise",
      subject: "Appointment Delayed",
      content:
        "{{patient_name}}, your appointment with {{doctor_name}} at {{slot_time}} has been delayed. We apologize for the inconvenience.",
    },
  ],
  reschedule: [
    {
      name: "Formal",
      subject: "Appointment Rescheduled",
      content:
        "Dear {{patient_name}},\n\nYour appointment with {{doctor_name}} has been rescheduled to {{slot_time}}.\n\nPlease confirm your availability. If the new time does not work, please contact us.\n\n{{clinic_name}}",
    },
    {
      name: "Friendly",
      subject: "Your appointment has been rescheduled",
      content:
        "Hi {{patient_name}}! 📅\n\nYour appointment with {{doctor_name}} has been moved to {{slot_time}}.\n\nDoes this work for you? Reply YES to confirm or NO to suggest another time.\n\n{{clinic_name}}",
    },
    {
      name: "Concise",
      subject: "Rescheduled: {{slot_time}}",
      content:
        "{{patient_name}}, your appointment with {{doctor_name}} is now at {{slot_time}}. Reply YES to confirm.",
    },
  ],
  on_leave: [
    {
      name: "Formal",
      subject: "Doctor On Leave Notice",
      content:
        "Dear {{patient_name}},\n\nPlease be informed that {{doctor_name}} will be on leave. Your appointment has been affected.\n\nPlease contact the clinic to reschedule.\n\n{{clinic_name}}",
    },
    {
      name: "Friendly",
      subject: "Schedule Update - Doctor on Leave",
      content:
        "Hi {{patient_name}},\n\nJust letting you know that {{doctor_name}} will be on leave. Your appointment needs to be rescheduled.\n\nPlease call us or reply to this message to book a new slot.\n\n{{clinic_name}}",
    },
    {
      name: "Concise",
      subject: "Doctor On Leave",
      content:
        "{{patient_name}}, {{doctor_name}} is on leave. Your appointment needs rescheduling. Contact {{clinic_name}}.",
    },
  ],
}

// ─── Component ────────────────────────────────────────────────────────────────

interface BrowseTemplatesModalProps {
  open: boolean
  categoryKey: string | null
  categories: TemplateCategory[]
  onClose: () => void
  onUse: (categoryKey: string, { subject, content }: { subject: string; content: string }) => void
}

export function BrowseTemplatesModal({
  open,
  categoryKey,
  categories,
  onClose,
  onUse,
}: BrowseTemplatesModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(categoryKey)
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null)

  if (!open) return null

  const activeCategory = selectedCategory
    ? categories.find((c) => c.key === selectedCategory)
    : null
  const presets = selectedCategory ? TEMPLATE_PRESETS[selectedCategory] ?? [] : []

  const handleUse = () => {
    if (!selectedCategory || selectedPreset === null) return
    const preset = presets[selectedPreset]
    if (!preset) return
    onUse(selectedCategory, { subject: preset.subject, content: preset.content })
    setSelectedPreset(null)
  }

  const handleClose = () => {
    setSelectedPreset(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-card rounded-xl shadow-lg border border-border w-full max-w-4xl max-h-[85vh] flex flex-col mx-4">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Browse Templates</h2>
          <button
            onClick={handleClose}
            className="p-1 rounded-md hover:bg-accent text-muted-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-48 border-r border-border overflow-y-auto shrink-0">
            <div className="p-2">
              {categories.map((cat) => {
                const Icon = cat.icon
                return (
                  <button
                    key={cat.key}
                    onClick={() => {
                      setSelectedCategory(cat.key)
                      setSelectedPreset(null)
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                      selectedCategory === cat.key
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-accent"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{cat.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {!selectedCategory && (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Select a category to browse templates
              </div>
            )}

            {selectedCategory && !activeCategory && (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Category not found
              </div>
            )}

            {selectedCategory && activeCategory && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground mb-4">
                  Choose a template for <span className="font-medium text-foreground">{activeCategory.label}</span>
                </p>
                {presets.map((preset, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedPreset(index)}
                    className={`w-full text-left p-4 rounded-lg border transition-colors ${
                      selectedPreset === index
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/50 hover:bg-accent/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-foreground">{preset.name}</span>
                          {selectedPreset === index && (
                            <Check className="h-4 w-4 text-primary shrink-0" />
                          )}
                        </div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">{preset.subject}</p>
                        <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-line">
                          {preset.content}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-border">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleUse}
            disabled={selectedPreset === null}
          >
            Use this template
          </Button>
        </div>
      </div>
    </div>
  )
}
