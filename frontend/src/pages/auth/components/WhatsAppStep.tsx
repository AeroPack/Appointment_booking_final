import React, { useState } from 'react'
import { ArrowRight, Loader2, SkipForward, MessageCircle } from 'lucide-react'
import { Button } from '@/core/components/ui/button'
import { Card, CardContent } from '@/core/components/ui/card'
import { Input } from '@/core/components/ui/input'

interface WhatsAppStepProps {
  onSubmit?: (data: {
    whatsapp_enabled?: boolean
    ultramsg_instance_id?: string
    ultramsg_token?: string
    whatsapp_number?: string
  }) => void
  onSkip?: () => void
  isLoading: boolean
  error?: string
}

export function WhatsAppStep({ onSubmit, onSkip, isLoading, error }: WhatsAppStepProps) {
  const [enabled, setEnabled] = useState(false)
  const [instanceId, setInstanceId] = useState('')
  const [token, setToken] = useState('')
  const [whatsappNumber, setWhatsappNumber] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (onSubmit) {
      onSubmit({
        whatsapp_enabled: enabled,
        ultramsg_instance_id: instanceId || undefined,
        ultramsg_token: token || undefined,
        whatsapp_number: whatsappNumber || undefined,
      })
    }
  }

  const handleSkip = () => {
    if (onSkip) {
      onSkip()
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-5 py-12 bg-background">
      <div className="w-full max-w-[440px] z-10 flex flex-col items-center">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 bg-[#25D366]/10 rounded-full flex items-center justify-center mb-6">
            <MessageCircle className="text-[#25D366] w-8 h-8" />
          </div>
          <h1 className="text-[22px] font-bold leading-[28px] text-text-primary">
            WhatsApp Integration
          </h1>
          <p className="text-[14px] leading-[20px] text-on-surface-variant mt-2">
            Send appointment confirmations via WhatsApp
          </p>
        </div>

        <Card className="w-full border-0 shadow-none bg-transparent md:bg-white md:shadow-[0px_4px_12px_rgba(15,23,42,0.05)] md:border md:border-outline-variant/30 md:rounded-xl">
          <CardContent className="p-0 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-lg">
                <div>
                  <p className="text-[14px] font-semibold text-text-primary">Enable WhatsApp</p>
                  <p className="text-[12px] text-on-surface-variant">Send messages to patients</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEnabled(!enabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    enabled ? 'bg-primary' : 'bg-outline-variant'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {enabled && (
                <>
                  <div className="space-y-2">
                    <label className="block text-[14px] font-semibold text-on-surface-variant">
                      UltraMsg Instance ID
                    </label>
                    <Input
                      type="text"
                      placeholder="instance123456"
                      value={instanceId}
                      onChange={(e) => setInstanceId(e.target.value)}
                      className="h-[48px] border-outline-variant focus:border-primary"
                    />
                    <p className="text-[12px] text-on-surface-variant">
                      Get this from ultramsg.com dashboard
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[14px] font-semibold text-on-surface-variant">
                      Token
                    </label>
                    <Input
                      type="password"
                      placeholder="Your UltraMsg token"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      className="h-[48px] border-outline-variant focus:border-primary"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[14px] font-semibold text-on-surface-variant">
                      WhatsApp Number
                    </label>
                    <div className="flex items-center border border-outline-variant rounded-lg overflow-hidden focus-within:border-primary focus-within:ring-1 focus-within:ring-primary h-[48px]">
                      <div className="bg-surface-container-low px-4 flex items-center border-r border-outline-variant h-full">
                        <span className="text-[16px] font-semibold text-on-surface-variant">+91</span>
                      </div>
                      <Input
                        type="tel"
                        placeholder="00000 00000"
                        value={whatsappNumber}
                        onChange={(e) => setWhatsappNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                        className="border-0 focus-visible:ring-0 h-full rounded-none"
                      />
                    </div>
                  </div>
                </>
              )}

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
                    Complete Setup
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </Button>

              <button
                type="button"
                onClick={handleSkip}
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
