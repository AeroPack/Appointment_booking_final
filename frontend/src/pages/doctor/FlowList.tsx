import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, Workflow, Calendar, Settings, Repeat, XCircle, Pencil, Check, X, HelpCircle, ChevronDown, MessageSquare, ListChecks, CalendarClock, GitBranch, Timer, FileText, CircleOff, Play } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Card, CardContent } from '@/core/components/ui/card';
import { Input } from '@/core/components/ui/input';
import { useGetFlowsQuery, useCreateFlowMutation, useRenameFlowMutation } from '@/features/flows/flowsApi';
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
  { value: 'custom', label: 'Custom', description: 'Custom automation triggered by keywords', icon: Settings },
] as const;

export function FlowList() {
  const navigate = useNavigate();
  const { data: flows, isLoading } = useGetFlowsQuery();
  const [createFlow, { isLoading: isCreating }] = useCreateFlowMutation();
  const [renameFlow] = useRenameFlowMutation();

  const [showNewModal, setShowNewModal] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');
  const [selectedTrigger, setSelectedTrigger] = useState<string>('book');
  const [keywords, setKeywords] = useState<string>('');

  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const isRenamingRef = useRef(false);

  const [showHelp, setShowHelp] = useState(() => {
    return localStorage.getItem('flows_help_dismissed') !== 'true';
  });

  const handleCreate = async () => {
    if (!newFlowName.trim()) return;
    try {
      const keywordsArray = keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
      const result = await createFlow({ name: newFlowName.trim(), trigger_type: selectedTrigger, keywords: keywordsArray }).unwrap();
      setShowNewModal(false);
      setNewFlowName('');
      setSelectedTrigger('book');
      setKeywords('');
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

  const startRename = (flow: FlowSummary) => {
    setEditingFlowId(flow.id);
    setEditingName(flow.name);
  };

  useEffect(() => {
    if (editingFlowId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingFlowId]);

  const saveRename = async () => {
    if (isRenamingRef.current) return;
    if (!editingFlowId || !editingName.trim()) {
      setEditingFlowId(null);
      return;
    }
    isRenamingRef.current = true;
    try {
      await renameFlow({ flowId: editingFlowId, name: editingName.trim() }).unwrap();
      toast.success('Flow renamed');
    } catch {
      toast.error('Failed to rename flow');
    } finally {
      isRenamingRef.current = false;
      setEditingFlowId(null);
    }
  };

  const dismissHelp = () => {
    setShowHelp(false);
    localStorage.setItem('flows_help_dismissed', 'true');
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

      {/* Help Panel */}
      {showHelp && (
        <Card className="border-[#0f766e]/20 bg-[#f0fdfa]">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-[#0f766e]" />
                <h3 className="font-semibold text-[#191c1e]">How Flows Work</h3>
              </div>
              <button onClick={dismissHelp} className="p-1 rounded hover:bg-black/5 text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              Flows automate patient interactions - booking, rescheduling, cancellations, and custom workflows.
              Each flow is a chain of nodes that execute in sequence.
            </p>

            {/* Visual Example */}
            <div className="bg-white rounded-lg border p-4 mb-4">
              <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Example: Appointment Booking Flow</p>
              <div className="flex items-center gap-1 overflow-x-auto pb-2">
                {[
                  { icon: Play, label: 'Start', color: '#22c55e' },
                  { icon: MessageSquare, label: 'Welcome', color: '#3b82f6' },
                  { icon: ListChecks, label: 'Choice', color: '#f59e0b' },
                  { icon: CalendarClock, label: 'Pick Slot', color: '#0ea5e9' },
                  { icon: GitBranch, label: 'Check', color: '#ec4899' },
                  { icon: FileText, label: 'Send SMS', color: '#059669' },
                  { icon: CircleOff, label: 'End', color: '#ef4444' },
                ].map((node, i) => (
                  <div key={i} className="flex items-center shrink-0">
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium" style={{ borderColor: node.color + '40', backgroundColor: node.color + '10' }}>
                      <node.icon className="h-3 w-3" style={{ color: node.color }} />
                      {node.label}
                    </div>
                    {i < 6 && <div className="w-4 h-px bg-gray-300 shrink-0" />}
                  </div>
                ))}
              </div>
            </div>

            {/* Steps */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {[
                { step: '1', text: 'Click "New Flow" and choose a trigger type (Booking, Cancel, or Custom)' },
                { step: '2', text: 'Drag nodes from the left palette onto the canvas' },
                { step: '3', text: 'Connect nodes by dragging from one handle to another' },
                { step: '4', text: 'Click each node to configure its properties on the right' },
                { step: '5', text: 'Click "Publish" when ready - your flow goes live for patients' },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-2">
                  <div className="h-5 w-5 rounded-full bg-[#0f766e] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    {item.step}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>

            {/* Node Reference */}
            <details className="group">
              <summary className="flex items-center gap-1 text-xs font-medium text-[#0f766e] cursor-pointer hover:underline">
                <ChevronDown className="h-3 w-3 group-open:rotate-180 transition-transform" />
                Node Reference
              </summary>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { icon: Play, label: 'Start', desc: 'Entry point', color: '#22c55e' },
                  { icon: MessageSquare, label: 'Message', desc: 'Send text', color: '#3b82f6' },
                  { icon: ListChecks, label: 'Choice', desc: 'User picks option', color: '#f59e0b' },
                  { icon: CalendarClock, label: 'Slot Picker', desc: 'Date selection', color: '#0ea5e9' },
                  { icon: GitBranch, label: 'Condition', desc: 'If/else branch', color: '#ec4899' },
                  { icon: Timer, label: 'Delay', desc: 'Wait before next', color: '#f97316' },
                  { icon: FileText, label: 'Template', desc: 'SMS/WhatsApp msg', color: '#059669' },
                  { icon: CalendarClock, label: 'Book Action', desc: 'Create appointment', color: '#14b8a6' },
                  { icon: CircleOff, label: 'End', desc: 'Flow terminates', color: '#ef4444' },
                ].map((node) => (
                  <div key={node.label} className="flex items-center gap-2 p-2 rounded border text-xs">
                    <node.icon className="h-3.5 w-3.5 shrink-0" style={{ color: node.color }} />
                    <div>
                      <span className="font-medium">{node.label}</span>
                      <span className="text-muted-foreground ml-1">{node.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </CardContent>
        </Card>
      )}

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
                      className="cursor-pointer hover:bg-accent/50 transition-colors group"
                      onClick={() => { if (editingFlowId !== flow.id) navigate(`/doctor/flows/${flow.id}`); }}
                    >
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Workflow className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            {editingFlowId === flow.id ? (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <Input
                                  ref={editInputRef}
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveRename();
                                    if (e.key === 'Escape') setEditingFlowId(null);
                                  }}
                                  onBlur={saveRename}
                                  className="h-7 text-sm font-medium px-2 py-0"
                                />
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={saveRename}>
                                  <Check className="h-3.5 w-3.5 text-green-600" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditingFlowId(null)}>
                                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{flow.name}</p>
                                <button
                                  onClick={(e) => { e.stopPropagation(); startRename(flow); }}
                                  className="p-1 rounded hover:bg-black/5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                            <p className="text-sm text-muted-foreground">
                              {flow.trigger_type === 'book' ? 'Booking' : flow.trigger_type === 'reschedule' ? 'Reschedule' : flow.trigger_type === 'cancel' ? 'Cancel' : 'Custom'} flow
                            </p>
                            {flow.keywords && flow.keywords.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {flow.keywords.map((keyword, idx) => (
                                  <span key={idx} className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 rounded">
                                    {keyword}
                                  </span>
                                ))}
                              </div>
                            )}
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

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Keywords (comma-separated)</label>
                <Input
                  placeholder="e.g., Hi, Hello, Hey"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Optional: Words that trigger this flow (case-insensitive)
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
