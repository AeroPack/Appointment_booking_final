import { useNavigate } from 'react-router-dom'
import { Shield } from 'lucide-react'

export function SecurityTipCard() {
  const navigate = useNavigate()

  return (
    <div className="hidden md:block bg-[#0f766e] text-[#a3faef] p-6 rounded-xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] relative overflow-hidden">
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2 text-white">
          <Shield className="w-5 h-5" />
          <h4 className="text-[14px] font-semibold">Security Tip</h4>
        </div>
        <p className="text-[12px] leading-relaxed text-white/90">
          Keep your health data safe. Enable two-factor authentication in the security panel to add an extra layer of protection to your medical records.
        </p>
        <button
          onClick={() => navigate('/doctor/settings')}
          className="mt-4 text-[12px] underline font-semibold text-white hover:text-[#a3faef] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white rounded"
        >
          Configure Security
        </button>
      </div>
      <div className="absolute -right-4 -bottom-4 opacity-10 pointer-events-none">
        <Shield className="w-32 h-32 text-white" />
      </div>
    </div>
  )
}
