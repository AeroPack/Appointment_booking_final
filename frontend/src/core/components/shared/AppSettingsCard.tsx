import { useState } from 'react'
import { Bell, Globe, HelpCircle, Accessibility, ChevronRight, LogOut } from 'lucide-react'
import { Button } from '@/core/components/ui/button'
import { Card } from '@/core/components/ui/card'
import { Switch } from '@/core/components/ui/switch'

interface AppSettingsCardProps {
  onLogout: () => void
}

export function AppSettingsCard({ onLogout }: AppSettingsCardProps) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  return (
    <Card className="rounded-xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] border-0 bg-white overflow-hidden">
      <div className="px-6 py-4 md:p-8 md:pb-4 border-b border-[#e0e3e5] md:border-none bg-[#f2f4f6] md:bg-white">
        <h3 className="text-[14px] md:text-[20px] font-semibold text-[#005c55] md:text-[#191c1e] uppercase md:normal-case tracking-wider md:tracking-normal">
          App Settings
        </h3>
      </div>

      <div className="flex flex-col divide-y divide-[#e0e3e5]/50 md:divide-[#e0e3e5]">
        <div className="p-6 flex items-center justify-between hover:bg-[#f7f9fb] transition-colors cursor-pointer group active:bg-[#f2f4f6] md:active:bg-[#f7f9fb]">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#9cf2e8]/30 flex items-center justify-center text-[#005c55]">
              <Bell className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-[16px] font-semibold text-[#191c1e]">Notifications</p>
              <p className="text-[12px] text-[#64748B]">Appointments, messages, and alerts</p>
            </div>
          </div>
          <span className="md:hidden">
            <ChevronRight className="w-5 h-5 text-[#6e7977] group-hover:translate-x-1 transition-transform" />
          </span>
          <span className="hidden md:block">
            <Switch
              checked={notificationsEnabled}
              onCheckedChange={setNotificationsEnabled}
              className="data-[state=checked]:bg-[#006b5f]"
            />
          </span>
        </div>

        <div className="p-6 flex items-center justify-between hover:bg-[#f7f9fb] transition-colors cursor-pointer group active:bg-[#f2f4f6] md:active:bg-[#f7f9fb]">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#71f8e4]/30 flex items-center justify-center text-[#006b5f]">
              <Globe className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-[16px] font-semibold text-[#191c1e]">Language</p>
              <p className="text-[12px] text-[#64748B]">English (US)</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#6e7977] group-hover:translate-x-1 transition-transform" />
        </div>

        <div className="p-6 flex items-center justify-between hover:bg-[#f7f9fb] transition-colors cursor-pointer group active:bg-[#f2f4f6] md:active:bg-[#f7f9fb]">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#ffe5db]/50 flex items-center justify-center text-[#7f4025]">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-[16px] font-semibold text-[#191c1e]">Help & Support</p>
              <p className="text-[12px] text-[#64748B]">FAQs, contact, and legal docs</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#6e7977] group-hover:translate-x-1 transition-transform" />
        </div>

        <div className="hidden md:flex p-6 items-center justify-between hover:bg-[#f7f9fb] transition-colors cursor-pointer group">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#a3faef]/30 flex items-center justify-center text-[#005c55]">
              <Accessibility className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-[16px] font-semibold text-[#191c1e]">Accessibility</p>
              <p className="text-[12px] text-[#64748B]">Screen reader and high contrast</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#6e7977] group-hover:translate-x-1 transition-transform" />
        </div>
      </div>

      <div className="hidden md:block p-8 border-t border-[#e0e3e5]/50 bg-[#f2f4f6]/50">
        <Button
          onClick={onLogout}
          variant="outline"
          className="w-full h-[48px] rounded-full border border-[#DC2626] text-[#DC2626] hover:bg-[#DC2626]/5 hover:text-[#DC2626] font-semibold text-[14px] transition-all active:scale-[0.98] flex justify-center gap-2 bg-transparent shadow-none"
        >
          <LogOut className="w-4 h-4" />
          Log out
        </Button>
      </div>
    </Card>
  )
}
