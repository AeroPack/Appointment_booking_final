import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, Workflow, Calendar, Settings, Repeat, XCircle } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Card, CardContent } from '@/core/components/ui/card';
import { Input } from '@/core/components/ui/input';
import { useGetFlowsQuery, useCreateFlowMutation } from '@/features/flows/flowsApi';
import type { FlowSummary } from '@/features/flows/flowTypes';
import { toast } from 'sonner';

const AUTOMATION_TRIGGERS = ['booking_confirmed', 'reminder', 'appointment_cancelled', 'appointment_rescheduled'];

const FLOW_DESCRIPTIONS: Record<string, string> = {
  booking_confirmed: 'Sends a confirmation message when an appointment is booked',
  reminder: 'Sends reminders before the appointment time',
  appointment_cancelled: 'Notifies the patient when an appointment is cancelled',
  appointment_rescheduled: 'Notifies the patient when an appointment is rescheduled',
};

const TRIGGER_OPTIONS = [
  { value: 'book', label: 'Booking', description: 'Handles new appointment bookings', icon: Workflow },
  { value: 'reschedule', label: 'Reschedule', description: 'Handles appointment rescheduling', icon: Repeat },
  { value: 'cancel', label: 'Cancel', description: 'Handles appointment cancellations', icon: XCircle },
] as const;

export function FlowList() {
  const navigate = useNavigate();
  const { data: flows, isLoading } = useGetFlowsQuery();
  const [createFlow, { isLoading: isCreating }] = useCreateFlowMutation();

  const [showNewModal, setShowNewModal] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');
  const [selectedTrigger, setSelectedTrigger] = useState<string>('book');

  const handleCreate = async () => {
    if (!newFlowName.trim()) return;
    try {
      const result = await createFlow({ name: newFlowName.trim(), trigger_type: selectedTrigger }).unwrap();
      setShowNewModal(false);
      setNewFlowName('');
      setSelectedTrigger('book');
      navigate(`/doctor/flows/${result.id}`);
    } catch (err: any) {
      if (err?.status === 409) {
        toast.error('A flow with this trigger type already exists. Choose a different type.');
      } else {
        toast.error('Failed to create flow. Please try again.');
      }
    }
  };

  const handleCloseModal = () => {
    setShowNewModal(false);
    setNewFlowName('');
    setSelectedTrigger('book');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Workflow className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Booking Flows</h1>
        </div>
        <Button onClick={() => setShowNewModal(true)} disabled={isCreating}>
          <Plus className="h-4 w-4 mr-2" />
          New Flow
        </Button>
      </div>

      {flows && flows.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Workflow className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No booking flows yet</p>
            <Button onClick={() => setShowNewModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create your first flow
            </Button>
          </CardContent>
        </Card>
      )}

      {flows && flows.length > 0 && (
        <div className="space-y-8">
          {/* Automation Flows */}
          {flows.some(f => AUTOMATION_TRIGGERS.includes(f.trigger_type)) && (
            <div>
              <div className="mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Settings className="h-5 w-5 text-primary" />
                  Automation Flows
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  These flows handle appointment notifications. Edit message content in Templates.
                </p>
              </div>
              <div className="space-y-3">
                {flows
                  .filter(f => AUTOMATION_TRIGGERS.includes(f.trigger_type))
                  .map((flow: FlowSummary) => (
                    <Card
                      key={flow.id}
                      className="cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => navigate(`/doctor/flows/${flow.id}`)}
                    >
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                            <Workflow className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{flow.name}</p>
                              <span className="px-2 py-0.5 text-[10px] font-medium bg-emerald-100 text-emerald-700 rounded-full">
                                System
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {FLOW_DESCRIPTIONS[flow.trigger_type] || flow.trigger_type}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {flow.published_version_id ? (
                            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                              Published
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">
                              Draft
                            </span>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate('/doctor/settings/templates');
                            }}
                          >
                            <Settings className="h-3.5 w-3.5 mr-1" />
                            Edit Messages
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          )}

          {/* Custom Flows */}
          {flows.some(f => !AUTOMATION_TRIGGERS.includes(f.trigger_type)) && (
            <div>
              <div className="mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Workflow className="h-5 w-5 text-primary" />
                  Custom Flows
                </h2>
              </div>
              <div className="space-y-3">
                {flows
                  .filter(f => !AUTOMATION_TRIGGERS.includes(f.trigger_type))
                  .map((flow: FlowSummary) => (
                    <Card
                      key={flow.id}
                      className="cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => navigate(`/doctor/flows/${flow.id}`)}
                    >
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Workflow className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{flow.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {flow.trigger_type === 'book' ? 'Booking' : flow.trigger_type === 'reschedule' ? 'Reschedule' : 'Cancel'} flow
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {flow.published_version_id ? (
                            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                              Published
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">
                              Draft
                            </span>
                          )}
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            {new Date(flow.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 space-y-5">
              <h2 className="text-lg font-semibold">New Flow</h2>
              <Input
                placeholder="Flow name (e.g., Book Appointment)"
                value={newFlowName}
                onChange={(e) => setNewFlowName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
              />

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Trigger Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {TRIGGER_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = selectedTrigger === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setSelectedTrigger(opt.value)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-center ${
                          isSelected
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-border hover:border-primary/50 text-muted-foreground'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="text-xs font-medium">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {TRIGGER_OPTIONS.find(o => o.value === selectedTrigger)?.description}
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleCloseModal}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={!newFlowName.trim() || isCreating}>
                  {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
