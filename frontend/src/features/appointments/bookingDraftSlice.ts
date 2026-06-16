import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '@/core/store/store'

export interface BookingResponse {
  id: string;
  doctor_id: string;
  patient_id: string;
  scheduled_start: string;
  scheduled_end: string;
  token_number: number | null;
  appointment_status: string;
  venue: { id: string; name: string } | null;
}

export interface SelectedSlot {
  scheduledStart: string;
  scheduledEnd: string;
  displayTime: string;
  venueId: string | null;
  venueName: string | null;
}

export interface BookingDraft {
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string | null;
  fee: number | null;
  imageUrl: string | null;
  selectedDate: string;
  selectedSlot: SelectedSlot | null;
  idempotencyKey: string;
  bookingResult: BookingResponse | null;
}

const initialState: BookingDraft = {
  doctorId: '',
  doctorName: '',
  doctorSpecialty: null,
  fee: null,
  imageUrl: null,
  selectedDate: '',
  selectedSlot: null,
  idempotencyKey: '',
  bookingResult: null,
}

function generateIdempotencyKey(): string {
  return crypto.randomUUID()
}

const bookingDraftSlice = createSlice({
  name: 'bookingDraft',
  initialState,
  reducers: {
    setDoctor(state, action: PayloadAction<{
      doctorId: string;
      doctorName: string;
      doctorSpecialty: string | null;
      fee: number | null;
      imageUrl: string | null;
    }>) {
      state.doctorId = action.payload.doctorId
      state.doctorName = action.payload.doctorName
      state.doctorSpecialty = action.payload.doctorSpecialty
      state.fee = action.payload.fee
      state.imageUrl = action.payload.imageUrl
      state.selectedDate = ''
      state.selectedSlot = null
      state.idempotencyKey = ''
      state.bookingResult = null
    },
    setSelectedDate(state, action: PayloadAction<string>) {
      state.selectedDate = action.payload
      state.selectedSlot = null
      state.idempotencyKey = ''
      state.bookingResult = null
    },
    selectSlot(state, action: PayloadAction<{
      selectedDate: string;
      selectedSlot: SelectedSlot;
    }>) {
      state.selectedDate = action.payload.selectedDate
      state.selectedSlot = action.payload.selectedSlot
      state.idempotencyKey = generateIdempotencyKey()
      state.bookingResult = null
    },
    setBookingResult(state, action: PayloadAction<BookingResponse>) {
      state.bookingResult = action.payload
    },
    resetBookingDraft() {
      return initialState
    },
  },
})

export const { setDoctor, setSelectedDate, selectSlot, setBookingResult, resetBookingDraft } = bookingDraftSlice.actions

export const selectBookingDraft = (state: RootState) => state.bookingDraft

export default bookingDraftSlice.reducer
