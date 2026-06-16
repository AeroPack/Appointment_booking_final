import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Calendar, Clock, MapPin, Ticket } from 'lucide-react'
import { Button } from '@/core/components/ui/button'
import { StatusPill } from '@/core/components/common/StatusPill'
import { useGetAppointmentQuery, useCancelAppointmentMutation } from '@/features/appointments/appointmentsApi'

export function AppointmentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: appt, isLoading } = useGetAppointmentQuery(id!, { skip: !id })
  const [cancelAppointment, { isLoading: isCancelling }] = useCancelAppointmentMutation()

  if (isLoading) {
    return <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center text-slate-500">Loading appointment...</div>
  }

  if (!appt) {
    return <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center text-slate-500">Appointment not found.</div>
  }

  const handleCancel = async () => {
    if (window.confirm('Are you sure you want to cancel this appointment?')) {
      await cancelAppointment(id!)
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#0F172A] font-sans">
      <main className="max-w-3xl mx-auto px-4 md:px-10 py-8 md:py-12 space-y-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-600 hover:text-[#005c55] transition-colors">
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#0F172A]">{appt.doctor_name}</h1>
              <p className="text-slate-500 mt-1">Appointment Details</p>
            </div>
            <StatusPill status={appt.appointment_status} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6 border-y border-slate-100">
            <div className="flex items-center gap-4">
              <Calendar className="w-5 h-5 text-[#005c55]" />
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Date</p>
                <p className="font-bold text-[#0F172A]">{new Date(appt.scheduled_start).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Clock className="w-5 h-5 text-[#005c55]" />
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Time</p>
                <p className="font-bold text-[#0F172A]">{new Date(appt.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {new Date(appt.scheduled_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <MapPin className="w-5 h-5 text-[#005c55]" />
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Venue</p>
                <p className="font-bold text-[#0F172A]">{appt.venue_name ?? 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Ticket className="w-5 h-5 text-[#005c55]" />
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Token</p>
                <p className="font-bold text-[#0F172A]">{appt.token_number ? `#${appt.token_number}` : '—'}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/patient/home')}
              className="rounded-full border-slate-300 text-slate-600"
            >
              Back to Home
            </Button>
            {appt.appointment_status === 'booked' && (
              <Button
                onClick={handleCancel}
                disabled={isCancelling}
                className="rounded-full bg-red-600 text-white hover:bg-red-700"
              >
                {isCancelling ? 'Cancelling...' : 'Cancel Appointment'}
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
