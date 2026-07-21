import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, Workflow, Calendar } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Card, CardContent } from '@/core/components/ui/card';
import { Input } from '@/core/components/ui/input';
import { useGetFlowsQuery, useCreateFlowMutation } from '@/features/flows/flowsApi';
import type { FlowSummary } from '@/features/flows/flowTypes';

export function FlowList() {
  const navigate = useNavigate();
  const { data: flows, isLoading } = useGetFlowsQuery();
  const [createFlow, { isLoading: isCreating }] = useCreateFlowMutation();

  const [showNewModal, setShowNewModal] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');

  const handleCreate = async () => {
    if (!newFlowName.trim()) return;
    try {
      const result = await createFlow({ name: newFlowName.trim() }).unwrap();
      setShowNewModal(false);
      setNewFlowName('');
      navigate(`/doctor/flows/${result.id}`);
    } catch {
      // Error handled by RTK Query
    }
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
        <div className="space-y-3">
          {flows.map((flow: FlowSummary) => (
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
      )}

      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 space-y-4">
              <h2 className="text-lg font-semibold">New Booking Flow</h2>
              <Input
                placeholder="Flow name (e.g., Book Appointment)"
                value={newFlowName}
                onChange={(e) => setNewFlowName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowNewModal(false)}>
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
