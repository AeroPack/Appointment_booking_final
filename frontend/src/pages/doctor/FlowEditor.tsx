import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type Connection,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Card, CardContent } from '@/core/components/ui/card';
import { Input } from '@/core/components/ui/input';
import {
  useGetFlowDetailQuery,
  useGetOrCreateDraftMutation,
  usePublishVersionMutation,
  useRollbackToVersionMutation,
} from '@/features/flows/flowsApi';
import { NODE_TYPE_DEFINITIONS } from '@/features/flows/nodeTypes';
import type { FlowNodeType, ChoiceOption } from '@/features/flows/flowTypes';
import { buildNodeTypes, validateConnectionRules, createNodeFromPalette, removeStaleChoiceEdges } from '@/features/flows/graphUtils';
import { useAutosaveGraph } from '@/features/flows/hooks/useAutosaveGraph';

const nodeTypes = buildNodeTypes();

function StartNodeForm() {
  return <p className="text-sm text-muted-foreground">Start node - flow entry point</p>;
}

function MessageNodeForm({ data, onChange }: { data: Record<string, unknown>; onChange: (data: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Message Text</label>
      <textarea
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
        value={String(data.text || '')}
        onChange={(e) => onChange({ ...data, text: e.target.value })}
        placeholder="Enter message text..."
        maxLength={1000}
      />
    </div>
  );
}

function ChoiceNodeForm({ data, onChange }: { data: Record<string, unknown>; onChange: (data: Record<string, unknown>) => void }) {
  const text = String(data.text || '');
  const options = Array.isArray(data.options) ? data.options as ChoiceOption[] : [];

  const addOption = () => {
    if (options.length >= 10) return;
    const newOption: ChoiceOption = {
      id: crypto.randomUUID(),
      label: `Option ${options.length + 1}`,
      value: `option_${options.length + 1}`,
    };
    onChange({ ...data, options: [...options, newOption] });
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    const newOptions = options.filter((_, i) => i !== index);
    onChange({ ...data, options: newOptions });
  };

  const updateOption = (index: number, field: 'label' | 'value', value: string) => {
    const updated = options.map((opt, i) => i === index ? { ...opt, [field]: value } : opt);
    onChange({ ...data, options: updated });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label className="text-sm font-medium">Prompt Text</label>
        <textarea
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
          value={text}
          onChange={(e) => onChange({ ...data, text: e.target.value })}
          placeholder="Ask the user..."
          maxLength={500}
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Options</label>
          <Button variant="ghost" size="sm" onClick={addOption} disabled={options.length >= 10}>
            + Add
          </Button>
        </div>
        {options.map((opt, i) => (
          <div key={opt.id} className="flex gap-2">
            <Input
              value={opt.label}
              onChange={(e) => updateOption(i, 'label', e.target.value)}
              placeholder="Label"
              className="flex-1"
            />
            <Input
              value={opt.value}
              onChange={(e) => updateOption(i, 'value', e.target.value)}
              placeholder="Value"
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeOption(i)}
              disabled={options.length <= 2}
              className="text-destructive"
            >
              x
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ApiNodeForm({ data, onChange }: { data: Record<string, unknown>; onChange: (data: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-2">
      <div className="space-y-2">
        <label className="text-sm font-medium">URL</label>
        <Input
          value={String(data.url || '')}
          onChange={(e) => onChange({ ...data, url: e.target.value })}
          placeholder="https://api.example.com/endpoint"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Method</label>
        <select
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={String(data.method || 'GET')}
          onChange={(e) => onChange({ ...data, method: e.target.value })}
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
        </select>
      </div>
    </div>
  );
}

function ConditionNodeForm({ data, onChange }: { data: Record<string, unknown>; onChange: (data: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-2">
      <div className="space-y-2">
        <label className="text-sm font-medium">Variable</label>
        <Input
          value={String(data.variable || '')}
          onChange={(e) => onChange({ ...data, variable: e.target.value })}
          placeholder="patient_name"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Operator</label>
        <select
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={String(data.operator || 'equals')}
          onChange={(e) => onChange({ ...data, operator: e.target.value })}
        >
          <option value="equals">Equals</option>
          <option value="not_equals">Not Equals</option>
          <option value="contains">Contains</option>
          <option value="exists">Exists</option>
        </select>
      </div>
      {String(data.operator) !== 'exists' && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Value</label>
          <Input
            value={String(data.value || '')}
            onChange={(e) => onChange({ ...data, value: e.target.value })}
            placeholder="Expected value"
          />
        </div>
      )}
    </div>
  );
}

function BookingActionNodeForm() {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Books an appointment using collected variables:
      </p>
      <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
        <li>patient_name</li>
        <li>patient_phone</li>
        <li>slot_start</li>
      </ul>
    </div>
  );
}

function EndNodeForm({ data, onChange }: { data: Record<string, unknown>; onChange: (data: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Closing Message (optional)</label>
      <textarea
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
        value={String(data.message || '')}
        onChange={(e) => onChange({ ...data, message: e.target.value })}
        placeholder="Thank you message..."
        maxLength={500}
      />
    </div>
  );
}

function NodeInspector({
  selectedNode,
  onNodeDataChange,
}: {
  selectedNode: Node | null;
  onNodeDataChange: (nodeId: string, data: Record<string, unknown>) => void;
}) {
  if (!selectedNode) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        Select a node to edit its properties
      </div>
    );
  }

  const nodeType = selectedNode.type as FlowNodeType;
  const def = NODE_TYPE_DEFINITIONS[nodeType];

  const handleChange = (newData: Record<string, unknown>) => {
    onNodeDataChange(selectedNode.id, newData);
  };

  const Icon = def.icon;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b">
        <div className="h-6 w-6 rounded flex items-center justify-center" style={{ backgroundColor: def.color }}>
          <Icon className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="font-medium">{def.label}</span>
      </div>
      {nodeType === 'start' && <StartNodeForm />}
      {nodeType === 'message' && <MessageNodeForm data={selectedNode.data} onChange={handleChange} />}
      {nodeType === 'choice' && <ChoiceNodeForm data={selectedNode.data} onChange={handleChange} />}
      {nodeType === 'api' && <ApiNodeForm data={selectedNode.data} onChange={handleChange} />}
      {nodeType === 'condition' && <ConditionNodeForm data={selectedNode.data} onChange={handleChange} />}
      {nodeType === 'booking_action' && <BookingActionNodeForm />}
      {nodeType === 'end' && <EndNodeForm data={selectedNode.data} onChange={handleChange} />}
    </div>
  );
}

function FlowEditorInner() {
  const { flowId } = useParams<{ flowId: string }>();
  const navigate = useNavigate();

  const { data: flowDetail, isLoading: flowLoading } = useGetFlowDetailQuery(flowId!);
  const [getOrCreateDraft] = useGetOrCreateDraftMutation();
  const [publishVersion, { isLoading: isPublishing }] = usePublishVersionMutation();
  const [rollbackToVersion] = useRollbackToVersionMutation();

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [isDraft, setIsDraft] = useState(true);
  const [publishErrors, setPublishErrors] = useState<string[]>([]);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  const { saveStatus, markDirty, updateSnapshot } = useAutosaveGraph(flowId!, currentVersionId);

  const { screenToFlowPosition } = useReactFlow();

  useEffect(() => {
    if (!flowId) return;

    const loadDraft = async () => {
      try {
        const draft = await getOrCreateDraft(flowId).unwrap();
        setCurrentVersionId(draft.id);

        const graph = draft.graph || { nodes: [], edges: [] };
        const flowNodes: Node[] = graph.nodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: n.data,
        }));
        const flowEdges: Edge[] = graph.edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle ?? null,
          targetHandle: e.targetHandle ?? null,
        }));

        setNodes(flowNodes);
        setEdges(flowEdges);
        updateSnapshot(draft.graph);
      } catch {
        // Error handled by RTK Query
      }
    };

    loadDraft();
  }, [flowId, getOrCreateDraft, updateSnapshot]);

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    setNodes((nds) => {
      const updated = applyNodeChanges(changes, nds);
      markDirty(updated, edges);
      return updated;
    });
  }, [edges, markDirty]);

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    setEdges((eds) => {
      const updated = applyEdgeChanges(changes, eds);
      markDirty(nodes, updated);
      return updated;
    });
  }, [nodes, markDirty]);

  const onConnect: OnConnect = useCallback((connection) => {
    const error = validateConnectionRules(connection, nodes, edges);
    if (error) return;

    setEdges((eds) => {
      const newEdge = {
        ...connection,
        id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      };
      const updated = [
        ...eds.map(e => ({ ...e, sourceHandle: e.sourceHandle ?? null, targetHandle: e.targetHandle ?? null })),
        { ...newEdge, sourceHandle: newEdge.sourceHandle ?? null, targetHandle: newEdge.targetHandle ?? null },
      ] as Edge[];
      markDirty(nodes, updated);
      return updated;
    });
  }, [nodes, edges, markDirty]);

  const onNodeDataChange = useCallback((nodeId: string, newData: Record<string, unknown>) => {
    setNodes((nds) => {
      const updated = nds.map((n) =>
        n.id === nodeId ? { ...n, data: newData } : n
      );
      markDirty(updated, edges);
      return updated;
    });
    setEdges((eds) => {
      const node = nodes.find(n => n.id === nodeId);
      if (node?.type === 'choice' && Array.isArray(newData.options)) {
        return removeStaleChoiceEdges(nodeId, newData.options as ChoiceOption[], eds);
      }
      return eds;
    });
  }, [nodes, edges, markDirty]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow') as FlowNodeType;
    if (!type || !NODE_TYPE_DEFINITIONS[type]) return;

    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const newNode = createNodeFromPalette(type, position);

    setNodes((nds) => {
      const updated = [...nds, newNode];
      markDirty(updated, edges);
      return updated;
    });
  }, [screenToFlowPosition, edges, markDirty]);

  const handlePublish = async () => {
    if (!flowId || !currentVersionId) return;

    setPublishErrors([]);
    try {
      await publishVersion({ flowId, versionId: currentVersionId }).unwrap();
      setIsDraft(false);
      setPublishErrors([]);
    } catch (err: unknown) {
      const error = err as { data?: { error?: { details?: string[] } } };
      if (error?.data?.error?.details) {
        setPublishErrors(error.data.error.details);
      } else {
        setPublishErrors(['Publish failed. Please try again.']);
      }
    }
  };

  const handleRollback = async (versionId: string) => {
    if (!flowId) return;

    try {
      await rollbackToVersion({ flowId, versionId }).unwrap();
      setShowVersionHistory(false);
      navigate('/doctor/flows');
    } catch {
      // Error handled by RTK Query
    }
  };

  const isReadOnly = !isDraft || flowDetail?.flow.published_version_id === currentVersionId;

  if (flowLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="h-14 border-b flex items-center justify-between px-4 bg-background">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/doctor/flows')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h1 className="font-semibold">{flowDetail?.flow.name || 'Loading...'}</h1>
          {isReadOnly && (
            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
              Read Only
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {saveStatus === 'saving' && (
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-sm text-green-600">Saved</span>
          )}
          {saveStatus === 'error' && (
            <span className="text-sm text-destructive">Save failed</span>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowVersionHistory(!showVersionHistory)}
          >
            History
          </Button>

          {isDraft && (
            <Button size="sm" onClick={handlePublish} disabled={isPublishing}>
              {isPublishing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Publish
            </Button>
          )}
        </div>
      </div>

      {publishErrors.length > 0 && (
        <div className="border-b bg-red-50 p-3">
          <div className="flex items-start gap-2 max-w-4xl mx-auto">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-destructive">Publish failed with the following errors:</p>
              <ul className="text-sm text-destructive/80 list-disc list-inside">
                {publishErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setPublishErrors([])} className="ml-auto shrink-0">
              Dismiss
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {!isReadOnly && (
          <div className="w-56 border-r bg-background p-3 space-y-2 overflow-y-auto">
            <p className="text-xs font-medium text-muted-foreground mb-2">Drag to add</p>
            {Object.values(NODE_TYPE_DEFINITIONS).map((def) => (
              <div
                key={def.type}
                className="flex items-center gap-2 p-2 rounded-md border cursor-grab hover:bg-accent/50 transition-colors"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', def.type);
                  e.dataTransfer.effectAllowed = 'move';
                }}
              >
                <div className="h-6 w-6 rounded flex items-center justify-center" style={{ backgroundColor: def.color }}>
                  <def.icon className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-sm">{def.label}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex-1" onDrop={onDrop} onDragOver={onDragOver}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={isReadOnly ? undefined : onNodesChange}
            onEdgesChange={isReadOnly ? undefined : onEdgesChange}
            onConnect={isReadOnly ? undefined : onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            nodesDraggable={!isReadOnly}
            nodesConnectable={!isReadOnly}
            elementsSelectable={!isReadOnly}
            isValidConnection={(conn) => 'sourceHandle' in conn && validateConnectionRules(conn as Connection, nodes, edges) === null}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>

        {!isReadOnly && (
          <div className="w-72 border-l bg-background overflow-y-auto">
            <NodeInspector
              selectedNode={selectedNode}
              onNodeDataChange={onNodeDataChange}
            />
          </div>
        )}
      </div>

      {showVersionHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md max-h-[80vh] overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Version History</h2>
                <Button variant="ghost" size="sm" onClick={() => setShowVersionHistory(false)}>
                  Close
                </Button>
              </div>
              <div className="space-y-2 overflow-y-auto max-h-[60vh]">
                {flowDetail?.versions.map((v) => (
                  <div
                    key={v.id}
                    className={`p-3 rounded-lg border ${v.id === currentVersionId ? 'border-primary bg-primary/5' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Version {v.version_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(v.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                          v.status === 'published' ? 'bg-green-100 text-green-700' :
                          v.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {v.status}
                        </span>
                        {v.status === 'archived' && isDraft && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRollback(v.id)}
                          >
                            Rollback
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export function FlowEditor() {
  return (
    <ReactFlowProvider>
      <FlowEditorInner />
    </ReactFlowProvider>
  );
}
