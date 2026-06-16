import { useState, useEffect } from 'react';
import {
  Bell,
  Save,
  Clock,
  Zap,
  MapPin,
  XCircle,
  Info,
  MessageSquare,
  Sparkles,
  Edit2,
  List,
  Calendar,
  Settings,
  ArrowUpRight
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Card, CardContent } from '@/core/components/ui/card';
import { Switch } from '@/core/components/ui/switch';
import { Input } from '@/core/components/ui/input';
import { useAppSelector } from '@/core/store/hooks';
import { useListTemplatesQuery, useUpdateTemplateMutation } from '@/features/settings/settingsApi';
import type { MessageTemplateRow } from '@/core/types/generated/settings';

function findTemplate(templates: MessageTemplateRow[] | undefined, type: string, offset?: number): MessageTemplateRow | undefined {
  return templates?.find(t => {
    if (t.template_type !== type) return false;
    if (offset !== undefined) return t.offset_minutes === offset;
    return true;
  });
}

export function Templates() {
  const authUser = useAppSelector(state => state.auth.user);
  const doctorId = authUser?.id ?? '';

  const { data: templates, isLoading } = useListTemplatesQuery(doctorId);
  const [updateTemplate, { isLoading: isSaving }] = useUpdateTemplateMutation();

  const [localTemplates, setLocalTemplates] = useState<Record<string, { subject: string; content: string; active: boolean }>>({});

  useEffect(() => {
    if (!templates) return;

    const map: Record<string, { subject: string; content: string; active: boolean }> = {};

    const t24 = findTemplate(templates, 'reminder', 1440);
    if (t24) map['24h'] = { subject: t24.subject ?? '', content: t24.content, active: t24.is_active };

    const t1 = findTemplate(templates, 'reminder', 60);
    if (t1) map['1h'] = { subject: t1.subject ?? '', content: t1.content, active: t1.is_active };

    const t15 = findTemplate(templates, 'reminder', 15);
    if (t15) map['15m'] = { subject: t15.subject ?? '', content: t15.content, active: t15.is_active };

    const cancel = findTemplate(templates, 'appointment_cancelled');
    if (cancel) map['cancellation'] = { subject: cancel.subject ?? '', content: cancel.content, active: cancel.is_active };

    setLocalTemplates(map);
  }, [templates]);

  const handleToggle = (key: string, checked: boolean) => {
    setLocalTemplates(prev => {
      const existing = prev[key] ?? { subject: '', content: '', active: true };
      return { ...prev, [key]: { ...existing, active: checked } };
    });
  };

  const handleContentChange = (key: string, field: 'subject' | 'content', value: string) => {
    setLocalTemplates(prev => {
      const existing = prev[key] ?? { subject: '', content: '', active: true };
      return { ...prev, [key]: { ...existing, [field]: value } };
    });
  };

  const handleSaveAll = async () => {
    if (!templates) return;
    for (const [key, data] of Object.entries(localTemplates)) {
      let type: string;
      let offset: number | undefined;
      if (key === '24h') { type = 'reminder'; offset = 1440; }
      else if (key === '1h') { type = 'reminder'; offset = 60; }
      else if (key === '15m') { type = 'reminder'; offset = 15; }
      else { type = 'appointment_cancelled'; offset = undefined; }

      const existing = findTemplate(templates, type, offset);
      if (existing) {
        await updateTemplate({
          id: existing.id,
          data: {
            content: data.content,
            subject: data.subject || undefined,
            is_active: data.active,
            template_type: type,
            offset_minutes: offset ?? null,
          },
        });
      }
    }
  };

  const getContent = (key: string, field: 'subject' | 'content'): string => {
    return localTemplates[key]?.[field] ?? '';
  };

  const isActive = (key: string): boolean => {
    return localTemplates[key]?.active ?? true;
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface font-sans pb-28 md:pb-12">

      {/* MOBILE APP BAR */}
      <header className="md:hidden w-full top-0 sticky z-50 bg-surface-container-lowest shadow-sm border-b border-surface-container">
        <div className="flex justify-between items-center px-4 h-16 max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center overflow-hidden">
              <img src="https://i.pravatar.cc/150?u=doc_medsync" alt="Profile" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-headline-md font-headline-md text-primary font-bold">MedSync Pro</h1>
          </div>
          <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors">
            <Bell className="w-5 h-5 text-primary" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-10 py-6 md:py-12 space-y-8 md:space-y-12">

        {/* PAGE HEADER */}
        <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-text-main mb-2">
              Message Templates
            </h1>
            <p className="font-body-base text-text-muted md:text-on-surface-variant max-w-2xl">
              <span className="md:hidden">Configure automated notifications sent to your patients.</span>
              <span className="hidden md:inline">Configure automated communication triggers and content for your clinic.</span>
            </p>
          </div>
          {/* Desktop Actions */}
          <div className="hidden md:flex gap-4">
            <Button variant="outline" className="px-6 rounded-full border-outline text-primary hover:bg-surface-container-high font-label-bold transition-colors">
              Discard Changes
            </Button>
            <Button
              onClick={handleSaveAll}
              disabled={isSaving || isLoading}
              className="px-8 bg-primary text-white rounded-full shadow-md hover:bg-primary/90 font-label-bold gap-2"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </section>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>

        {/* MOBILE AVAILABLE CHIPS */}
        <section className="md:hidden bg-surface-container-lowest border border-outline-variant/30 p-4 rounded-xl flex flex-wrap gap-2 items-center shadow-sm">
          <span className="text-[12px] font-label-bold text-on-surface-variant uppercase tracking-wider mr-1">
            AVAILABLE CHIPS:
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full border border-outline-variant bg-white text-primary text-[13px] font-medium shadow-sm">
            {'{patient_name}'}
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full border border-outline-variant bg-white text-primary text-[13px] font-medium shadow-sm">
            {'{slot_time}'}
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full border border-outline-variant bg-white text-primary text-[13px] font-medium shadow-sm">
            {'{venue}'}
          </span>
        </section>

        {/* REMINDERS SECTION */}
        <section>
          <div className="flex items-center justify-between md:justify-start gap-3 mb-6">
            <div className="flex items-center gap-2">
              <Bell className="hidden md:block w-6 h-6 text-primary" />
              <h2 className="font-headline-md text-headline-md text-text-main md:text-on-surface">Reminders</h2>
            </div>
            <div className="md:hidden flex items-center gap-1.5 text-[12px] font-label-bold text-status-success">
              <span className="w-2 h-2 rounded-full bg-status-success" />
              Auto-send active
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">

            {/* Card 1: 24h Reminder */}
            <Card className="rounded-xl shadow-sm border border-outline-variant/30 md:border-transparent md:hover:border-primary-fixed transition-colors">
              <CardContent className="p-5 md:p-6 flex flex-col gap-4 md:gap-6">
                <div className="flex md:hidden justify-between items-start">
                  <span className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-label-bold text-[12px] flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    24h Before Appointment
                  </span>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={isActive('24h')}
                      onCheckedChange={(c) => handleToggle('24h', c)}
                      className="data-[state=checked]:bg-primary"
                    />
                    <span className="text-[12px] font-label-bold text-on-surface-variant">SMS/WA</span>
                  </div>
                </div>

                <div className="hidden md:flex justify-between items-start">
                  <div>
                    <h3 className="font-label-bold text-base text-on-surface mb-1">24h Appointment Reminder</h3>
                    <p className="text-[12px] text-on-surface-variant">Sent exactly 24 hours prior to the slot.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={isActive('24h')}
                      onCheckedChange={(c) => handleToggle('24h', c)}
                      className="data-[state=checked]:bg-primary"
                    />
                    <span className="text-[13px] font-label-bold text-on-surface">Active</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] md:text-[11px] font-label-bold text-on-surface-variant md:uppercase tracking-wider">
                      <span className="md:hidden">Message Subject</span>
                      <span className="hidden md:inline">EMAIL SUBJECT</span>
                    </label>
                    <Input
                      value={getContent('24h', 'subject')}
                      onChange={(e) => handleContentChange('24h', 'subject', e.target.value)}
                      className="h-12 border-outline-variant md:bg-surface-bright focus-visible:ring-primary text-body-base"
                    />
                  </div>

                  <div className="flex flex-col gap-2 relative">
                    <label className="text-[13px] md:text-[11px] font-label-bold text-on-surface-variant md:uppercase tracking-wider">
                      <span className="md:hidden">Message Body</span>
                      <span className="hidden md:inline">MESSAGE BODY</span>
                    </label>
                    <div className="relative">
                      <textarea
                        value={getContent('24h', 'content')}
                        onChange={(e) => handleContentChange('24h', 'content', e.target.value)}
                        rows={4}
                        className="w-full p-4 rounded-lg border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary md:bg-surface-bright text-body-base resize-none outline-none pr-10 md:pr-4"
                      />
                      <div className="md:hidden absolute bottom-3 right-3 text-primary pointer-events-none">
                        <Edit2 className="w-5 h-5" />
                      </div>
                    </div>
                  </div>

                  <div className="hidden md:block pt-2">
                    <p className="text-[11px] font-label-bold text-on-surface-variant uppercase tracking-wider mb-3">
                      DYNAMIC PLACEHOLDERS
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center px-3 py-1.5 rounded-full text-[12px] font-medium bg-surface-container-high text-on-surface">{'{patient_name}'}</span>
                      <span className="inline-flex items-center px-3 py-1.5 rounded-full text-[12px] font-medium bg-surface-container-high text-on-surface">{'{slot_time}'}</span>
                      <span className="inline-flex items-center px-3 py-1.5 rounded-full text-[12px] font-medium bg-surface-container-high text-on-surface">{'{doctor_name}'}</span>
                      <span className="inline-flex items-center px-3 py-1.5 rounded-full text-[12px] font-medium bg-surface-container-high text-on-surface">{'{clinic_name}'}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: 1h SMS */}
            <Card className="rounded-xl shadow-sm border border-outline-variant/30 md:border-transparent md:hover:border-primary-fixed transition-colors">
              <CardContent className="p-5 md:p-6 flex flex-col gap-4 md:gap-6">
                <div className="flex md:hidden justify-between items-start">
                  <span className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-label-bold text-[12px] flex items-center gap-1.5">
                    <Zap className="w-4 h-4" />
                    1h Before Appointment
                  </span>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={isActive('1h')}
                      onCheckedChange={(c) => handleToggle('1h', c)}
                      className="data-[state=checked]:bg-primary"
                    />
                    <span className="text-[12px] font-label-bold text-on-surface-variant">SMS/WA</span>
                  </div>
                </div>

                <div className="hidden md:flex justify-between items-start">
                  <div>
                    <h3 className="font-label-bold text-base text-on-surface mb-1">1h SMS Alert</h3>
                    <p className="text-[12px] text-on-surface-variant">Short notice SMS push notification.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={isActive('1h')}
                      onCheckedChange={(c) => handleToggle('1h', c)}
                      className="data-[state=checked]:bg-primary"
                    />
                    <span className="text-[13px] font-label-bold text-on-surface">Active</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] md:text-[11px] font-label-bold text-on-surface-variant md:uppercase tracking-wider">
                      <span className="md:hidden">Message Subject</span>
                      <span className="hidden md:inline">SMS CONTENT</span>
                    </label>
                    <textarea
                      value={getContent('1h', 'content')}
                      onChange={(e) => handleContentChange('1h', 'content', e.target.value)}
                      rows={3}
                      className="w-full p-4 rounded-lg border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary md:bg-surface-bright text-body-base resize-none outline-none"
                    />
                  </div>

                  <div className="hidden md:block pt-2">
                    <p className="text-[11px] font-label-bold text-on-surface-variant uppercase tracking-wider mb-3">
                      DYNAMIC PLACEHOLDERS
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center px-3 py-1.5 rounded-full text-[12px] font-medium bg-surface-container-high text-on-surface">{'{slot_time}'}</span>
                      <span className="inline-flex items-center px-3 py-1.5 rounded-full text-[12px] font-medium bg-surface-container-high text-on-surface">{'{map_link}'}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 3: 15m Before (Mobile Only) */}
            <Card className="md:hidden rounded-xl shadow-sm border border-outline-variant/30 opacity-60 grayscale pointer-events-none">
              <CardContent className="p-5 flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <span className="px-3 py-1.5 rounded-lg bg-secondary-container/30 text-on-secondary-container font-label-bold text-[12px] flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    15m Before Appointment
                  </span>
                  <div className="flex items-center gap-2">
                    <Switch disabled checked={isActive('15m')} />
                    <span className="text-[12px] font-label-bold text-on-surface-variant">Inactive</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-label-bold text-on-surface-variant">Message Subject</label>
                    <Input disabled value={getContent('15m', 'subject') || 'Arrival check-in: {venue}'} className="h-12 border-outline-variant text-body-base" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-label-bold text-on-surface-variant">Message Body</label>
                    <textarea
                      disabled
                      value={getContent('15m', 'content') || `Hi {patient_name}, please head to the reception at {venue} for your appointment.`}
                      rows={3}
                      className="w-full p-4 rounded-lg border border-outline-variant text-body-base resize-none outline-none bg-surface-container-low"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        </section>

        {/* CANCELLATION SECTION */}
        <section>
          <div className="flex items-center gap-2 mb-4 md:mb-6">
            <XCircle className="w-6 h-6 text-error" />
            <h2 className="font-headline-md text-headline-md text-text-main md:text-on-surface">
              <span className="md:hidden">Cancellation message</span>
              <span className="hidden md:inline">Cancellation Policy Notice</span>
            </h2>
          </div>

          <Card className="rounded-xl overflow-hidden shadow-sm border border-error/20 md:border-transparent md:hover:border-error/30 transition-colors">
            <CardContent className="p-5 md:p-8 flex flex-col lg:flex-row gap-6 md:gap-10">

              <div className="hidden lg:block lg:w-1/3">
                <h3 className="font-label-bold text-base text-on-surface mb-2">Cancellation Confirmation</h3>
                <p className="font-body-base text-on-surface-variant mb-6 text-sm">
                  This message is triggered when a patient or admin cancels an existing appointment slot.
                </p>
                <div className="p-4 bg-error-container/20 border border-error-container/50 rounded-lg">
                  <div className="flex items-center gap-2 text-error mb-2">
                    <Info className="w-4 h-4" />
                    <span className="font-label-bold text-[11px] uppercase tracking-wider">Compliance Tip</span>
                  </div>
                  <p className="text-[12px] text-error leading-relaxed">
                    Ensure you mention if any cancellation fees were applied as per clinic policy.
                  </p>
                </div>
              </div>

              <div className="lg:w-2/3 space-y-4 md:space-y-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] md:text-[11px] font-label-bold text-on-surface-variant md:uppercase tracking-wider">
                    <span className="md:hidden">Subject</span>
                    <span className="hidden md:inline">SUBJECT LINE</span>
                  </label>
                  <Input
                    value={getContent('cancellation', 'subject')}
                    onChange={(e) => handleContentChange('cancellation', 'subject', e.target.value)}
                    className="h-12 border-outline-variant md:bg-surface-bright focus-visible:ring-primary text-body-base"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[13px] md:text-[11px] font-label-bold text-on-surface-variant md:uppercase tracking-wider">
                    <span className="md:hidden">Cancellation Message Body</span>
                    <span className="hidden md:inline">MESSAGE CONTENT</span>
                  </label>
                  <textarea
                    value={getContent('cancellation', 'content')}
                    onChange={(e) => handleContentChange('cancellation', 'content', e.target.value)}
                    rows={4}
                    className="w-full p-4 rounded-lg border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary md:bg-surface-bright text-body-base resize-none outline-none"
                  />
                </div>

                <div className="md:hidden flex items-center justify-between p-4 bg-error-container/20 rounded-xl mt-2">
                  <span className="text-[13px] text-error font-label-bold">Auto-notify patient on system cancellation</span>
                  <Switch
                    checked={isActive('cancellation')}
                    onCheckedChange={(c) => handleToggle('cancellation', c)}
                    className="data-[state=checked]:bg-error"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* DESKTOP HELP BANNER */}
        <section className="hidden md:flex relative overflow-hidden rounded-3xl bg-[#0f766e] p-10 text-white items-center gap-8 shadow-sm">
          <div className="relative z-10 flex-1">
            <h3 className="font-headline-lg text-2xl mb-3">Mastering Placeholders</h3>
            <p className="font-body-base opacity-90 max-w-xl leading-relaxed">
              Use conditional tags to show specific pre-care instructions based on the procedure type selected in the appointment.
            </p>
            <button className="mt-8 flex items-center gap-2 font-label-bold hover:underline text-white opacity-90 hover:opacity-100">
              Read documentation
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
          <div className="w-48 h-48 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md shrink-0 relative z-10">
            <Sparkles className="w-16 h-16 text-white" />
          </div>
        </section>

        {/* MOBILE SAVE BUTTON */}
        <div className="md:hidden fixed bottom-[88px] left-0 right-0 max-w-[768px] mx-auto px-4 z-40 pointer-events-none">
          <div className="bg-surface-container-lowest/95 backdrop-blur-md p-4 rounded-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.05)] border border-surface-container flex justify-center pointer-events-auto">
            <Button
              onClick={handleSaveAll}
              disabled={isSaving || isLoading}
              className="w-full h-[52px] bg-primary text-white rounded-full font-label-bold text-base hover:bg-primary/90 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg"
            >
              <Save className="w-5 h-5" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>

        {/* MOBILE BOTTOM NAV */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 flex justify-around items-center h-[80px] px-2 pb-safe bg-surface-container-lowest border-t border-surface-container z-50 rounded-t-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
          <button className="flex flex-col items-center justify-center text-on-surface-variant w-16 h-full hover:bg-surface-container-low transition-colors rounded-xl active:scale-95">
            <List className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-medium">Queue</span>
          </button>
          <button className="flex flex-col items-center justify-center text-on-surface-variant w-16 h-full hover:bg-surface-container-low transition-colors rounded-xl active:scale-95">
            <Calendar className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-medium">Schedule</span>
          </button>
          <button className="flex flex-col items-center justify-center text-on-surface-variant w-16 h-full hover:bg-surface-container-low transition-colors rounded-xl active:scale-95">
            <MessageSquare className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-medium">Messages</span>
          </button>
          <button className="flex flex-col items-center justify-center text-primary w-16 h-full">
            <div className="bg-secondary-container w-14 h-8 rounded-full flex items-center justify-center mb-1">
              <Settings className="w-5 h-5 text-on-secondary-container" />
            </div>
            <span className="text-[10px] font-medium">Settings</span>
          </button>
        </nav>

        </>
        )}

      </main>
    </div>
  );
}

export default Templates;
