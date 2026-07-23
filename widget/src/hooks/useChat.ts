import { useState, useCallback, useRef } from 'react';
import type { ChatMessage, FlowStep, ButtonOption, SlotsResponse, WidgetConfig } from '../types';
import { ApiClient } from '../api/client';

let messageIdCounter = 0;
function nextId(): string {
  return `msg-${++messageIdCounter}-${Date.now()}`;
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  return d.toLocaleDateString('en-US', options);
}

function formatTimeDisplay(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function useChat(config: WidgetConfig) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [step, setStep] = useState<FlowStep>('greeting');
  const [isTyping, setIsTyping] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [doctorName, setDoctorName] = useState('');

  const apiRef = useRef(new ApiClient(config.apiHost, config.widgetKey));
  const bookingDataRef = useRef<{
    patientName?: string;
    patientPhone?: string;
    selectedDate?: string;
    selectedSlot?: string;
    slotsData?: SlotsResponse;
  }>({});

  const addBotMessage = useCallback((content: string, buttons?: ButtonOption[]) => {
    const msg: ChatMessage = { id: nextId(), type: 'bot', content, buttons, timestamp: new Date() };
    setMessages((prev) => [...prev, msg]);
  }, []);

  const addUserMessage = useCallback((content: string) => {
    const msg: ChatMessage = { id: nextId(), type: 'user', content, timestamp: new Date() };
    setMessages((prev) => [...prev, msg]);
  }, []);

  const startChat = useCallback(async () => {
    setIsOpen(true);
    if (messages.length > 0) return;

    try {
      const doctor = await apiRef.current.getDoctorInfo();
      setDoctorName(doctor.name);
    } catch {
      setDoctorName('the doctor');
    }

    addBotMessage(config.greeting, [
      { label: 'Book Appointment', value: 'book' },
      { label: 'Ask a Question', value: 'faq' },
    ]);
    setStep('greeting');
  }, [messages.length, config.greeting, addBotMessage]);

  const handleButtonClick = useCallback(async (value: string) => {
    if (step === 'greeting') {
      if (value === 'book') {
        addUserMessage('Book Appointment');
        addBotMessage("Great! What's your name?");
        setStep('collect_name');
      } else if (value === 'faq') {
        addUserMessage('Ask a Question');
        addBotMessage('What would you like to know? You can ask about fees, clinic location, working hours, or anything else.');
        setStep('collect_phone');
      }
      return;
    }

    if (step === 'show_dates') {
      addUserMessage(value);
      setIsTyping(true);
      try {
        const slotsData = await apiRef.current.getSlots(value, value);
        bookingDataRef.current.selectedDate = value;
        bookingDataRef.current.slotsData = slotsData;

        const day = slotsData.days.find((d) => d.date === value);
        const availableSlots = day?.slots.filter((s) => !s.is_full) || [];

        if (availableSlots.length === 0) {
          addBotMessage('No available slots on that date. Please pick another date.', generateDateButtons(slotsData));
          setIsTyping(false);
          return;
        }

        const timeButtons: ButtonOption[] = availableSlots.map((s) => ({
          label: `${formatTimeDisplay(s.start)}${s.venue ? ` (${s.venue.name})` : ''}`,
          value: s.start,
        }));

        addBotMessage(`Available times on ${formatDateDisplay(value)}:`, timeButtons);
        setStep('show_times');
      } catch {
        addBotMessage('Sorry, I couldn\'t fetch available slots. Please try again.');
      }
      setIsTyping(false);
      return;
    }

    if (step === 'show_times') {
      addUserMessage(formatTimeDisplay(value));
      bookingDataRef.current.selectedSlot = value;
      addBotMessage('Any reason for your visit? (optional)', [
        { label: 'Skip', value: 'skip' },
      ]);
      setStep('collect_reason');
      return;
    }

    if (step === 'collect_reason') {
      addUserMessage(value === 'skip' ? 'No reason provided' : value);
      let reason = value === 'skip' ? undefined : value;
      if (reason) {
        reason = await apiRef.current.extractField(reason, 'reason');
      }

      setIsTyping(true);
      try {
        const result = await apiRef.current.bookAppointment({
          patient_name: bookingDataRef.current.patientName || 'Patient',
          patient_phone: bookingDataRef.current.patientPhone || '',
          slot_start: bookingDataRef.current.selectedSlot || '',
          reason,
        });

        const venueStr = result.venue ? ` at ${result.venue.name}` : '';
        const venueLine = result.venue ? `Venue: ${result.venue.name}\n` : '';
        addBotMessage(
          `Booked! Your token is #${result.token_number}.\n\n` +
          `Doctor: ${result.doctor_name}\n` +
          `Date: ${formatDateDisplay(result.scheduled_start.split('T')[0])}\n` +
          `Time: ${formatTimeDisplay(result.scheduled_start)}\n` +
          venueLine +
          `Patient: ${result.patient_name}`
        );
        setStep('done');
      } catch (err) {
        addBotMessage(`Sorry, booking failed: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`);
      }
      setIsTyping(false);
      return;
    }
  }, [step, addUserMessage, addBotMessage]);

  const handleTextSubmit = useCallback(async (text: string) => {
    if (step === 'collect_name') {
      const extracted = await apiRef.current.extractField(text, 'name');
      addUserMessage(text);
      bookingDataRef.current.patientName = extracted;
      addBotMessage('What\'s your phone number?');
      setStep('collect_phone');
      return;
    }

    if (step === 'collect_phone') {
      addUserMessage(text);

      if (!bookingDataRef.current.patientName) {
        setIsTyping(true);
        try {
          const faqResult = await apiRef.current.searchFaq(text);
          if (faqResult.matched && faqResult.answer) {
            addBotMessage(faqResult.answer);
          } else {
            addBotMessage('I\'m not sure about that. You can ask about: fees, clinic location, working hours, or services offered.', [
              { label: 'Book Appointment', value: 'book' },
            ]);
          }
        } catch {
          addBotMessage('I couldn\'t find an answer for that. Please try rephrasing your question.', [
            { label: 'Book Appointment', value: 'book' },
          ]);
        }
        setIsTyping(false);
        return;
      }

      if (!bookingDataRef.current.patientPhone) {
        const extracted = await apiRef.current.extractField(text, 'phone');
        bookingDataRef.current.patientPhone = extracted;
      }
      setIsTyping(true);
      try {
        const today = new Date();
        const from = today.toISOString().split('T')[0];
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() + 13);
        const to = endDate.toISOString().split('T')[0];

        const slotsData = await apiRef.current.getSlots(from, to);
        bookingDataRef.current.slotsData = slotsData;

        const datesWithSlots = slotsData.days.filter(
          (d) => d.date >= from && d.slots.some((s) => !s.is_full)
        );

        if (datesWithSlots.length === 0) {
          addBotMessage('Sorry, there are no available slots in the next 2 weeks. Please try again later.');
          setIsTyping(false);
          return;
        }

        addBotMessage('Pick a date:', generateDateButtons(slotsData, from));
        setStep('show_dates');
      } catch {
        addBotMessage('Sorry, I couldn\'t fetch available dates. Please try again.');
      }
      setIsTyping(false);
      return;
    }

    if (step === 'greeting') {
      addUserMessage(text);
      setIsTyping(true);
      try {
        const extractedQuery = await apiRef.current.extractField(text, 'faq');
        const faqResult = await apiRef.current.searchFaq(extractedQuery);
        if (faqResult.matched && faqResult.answer) {
          addBotMessage(faqResult.answer, [
            { label: 'Book Appointment', value: 'book' },
            { label: 'Ask Another Question', value: 'faq' },
          ]);
        } else {
          addBotMessage('I\'m not sure about that. Would you like to book an appointment or ask something else?', [
            { label: 'Book Appointment', value: 'book' },
            { label: 'Ask a Question', value: 'faq' },
          ]);
        }
      } catch {
        addBotMessage('I couldn\'t process that. What would you like to do?', [
          { label: 'Book Appointment', value: 'book' },
          { label: 'Ask a Question', value: 'faq' },
        ]);
      }
      setIsTyping(false);
      return;
    }
  }, [step, addUserMessage, addBotMessage]);

  return {
    messages,
    step,
    isTyping,
    isOpen,
    setIsOpen,
    startChat,
    handleButtonClick,
    handleTextSubmit,
    doctorName,
  };
}

function generateDateButtons(slotsData: SlotsResponse, fromDate?: string): ButtonOption[] {
  const today = fromDate || new Date().toISOString().split('T')[0];
  const available = slotsData.days
    .filter((d) => d.date >= today && d.slots.some((s) => !s.is_full))
    .slice(0, 5);

  return available.map((d) => ({
    label: formatDateDisplay(d.date),
    value: d.date,
  }));
}
