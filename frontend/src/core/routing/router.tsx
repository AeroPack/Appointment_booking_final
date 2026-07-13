import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { RoleGuard } from '@/core/routing/guard/RoleGuard'

import { AuthFlow } from '@/pages/auth/AuthFlow'
import { SignupFlow } from '@/pages/auth/SignupFlow'
import { AppLayout } from '@/core/layout/AppLayout'

// Patient
import { Home } from '@/pages/patient/Home'
import { DoctorDetail as PatientDoctorDetail } from '@/pages/patient/DoctorDetail'
import { DoctorList } from '@/pages/patient/DoctorList'
import { FindSlots } from '@/pages/patient/FindSlots'
import { Confirm } from '@/pages/patient/Confirm'
import { Success } from '@/pages/patient/Success'
import { MyAppointments } from '@/pages/patient/MyAppointments'
import { AppointmentDetail as PatientAppointmentDetail } from '@/pages/patient/AppointmentDetail'
import { Family } from '@/pages/patient/Family'
import { Profile } from '@/pages/patient/Profile'

// Doctor
import { Dashboard as DoctorDashboard } from '@/pages/doctor/Dashboard'
import { PatientQueue as DoctorQueue } from '@/pages/doctor/PatientQueue'
import { CalendarPage as DoctorCalendar } from '@/pages/doctor/CalendarPage'
import { AppointmentDetail as DoctorAppointmentDetail } from '@/pages/doctor/AppointmentDetail'
import { Settings as DoctorSettings } from '@/pages/doctor/Settings'
import { Profile as DoctorProfile } from '@/pages/doctor/Profile'
import ChatbotSettings from '@/pages/doctor/ChatbotSettings'

// Staff
import { Dashboard as StaffDashboard } from '@/pages/staff/Dashboard'
import { BookOnBehalf } from '@/pages/staff/BookOnBehalf'
import { Patients } from '@/pages/staff/Patients'
import { Tags } from '@/pages/staff/Tags'
import { Venues } from '@/pages/staff/Venues'
import { Profile as StaffProfile } from '@/pages/staff/Profile'
export function Router() {
  return (
    <BrowserRouter future={{ v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<AuthFlow />} />
        <Route path="/login" element={<AuthFlow />} />
        <Route path="/signup" element={<SignupFlow />} />

        <Route element={<AppLayout />}>
          {/* Patient */}
          <Route element={<RoleGuard allow={['patient']} />}>
            <Route path="/patient/home" element={<Home />} />
            <Route path="/patient/doctors" element={<DoctorList />} />
            <Route path="/patient/doctor/:id" element={<PatientDoctorDetail />} />
            <Route path="/patient/find-slots" element={<FindSlots />} />
            <Route path="/patient/confirm" element={<Confirm />} />
            <Route path="/patient/success" element={<Success />} />
            <Route path="/patient/appointments" element={<MyAppointments />} />
            <Route path="/patient/appointment/:id" element={<PatientAppointmentDetail />} />
            <Route path="/patient/family" element={<Family />} />
            <Route path="/patient/profile" element={<Profile />} />
          </Route>

          {/* Doctor */}
          <Route element={<RoleGuard allow={['doctor']} />}>
            <Route path="/doctor/dashboard" element={<DoctorDashboard />} />
            <Route path="/doctor/queue" element={<DoctorQueue />} />
            <Route path="/doctor/calendar" element={<DoctorCalendar />} />
            <Route path="/doctor/appointment/:id" element={<DoctorAppointmentDetail />} />
            <Route path="/doctor/settings" element={<DoctorSettings />} />
            <Route path="/doctor/chatbot" element={<ChatbotSettings />} />
            <Route path="/doctor/profile" element={<DoctorProfile />} />
            <Route path="/doctor/tags" element={<Tags />} />
          </Route>

          {/* Staff */}
          <Route element={<RoleGuard allow={['staff']} />}>
            <Route path="/staff/dashboard" element={<StaffDashboard />} />
            <Route path="/staff/book-on-behalf" element={<BookOnBehalf />} />
            <Route path="/staff/patients" element={<Patients />} />
            <Route path="/staff/tags" element={<Tags />} />
            <Route path="/staff/venues" element={<Venues />} />
            <Route path="/staff/profile" element={<StaffProfile />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}