import { useCallback, useRef, useState } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { useAutosaveDraftMutation } from '../flowsApi';
import type { FlowNodeType, FlowGraph } from '../flowTypes';

const AUTOSAVE_DELAY_MS = 1000;
const SAVED_DISPLAY_MS = 2000;

export function useAutosaveGraph(flowId: string, versionId: string | null) {
  const [autosaveDraft] = useAutosaveDraftMutation();
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflightSave = useRef<AbortController | null>(null);
  const graphSnapshot = useRef<string>('');

  const performSave = useCallback(async (nodes: Node[], edges: Edge[]) => {
    if (!flowId || !versionId) return;

    if (inflightSave.current) {
      inflightSave.current.abort();
    }

    const controller = new AbortController();
    inflightSave.current = controller;

    const graph: FlowGraph = {
      nodes: nodes.map(n => ({
        id: n.id,
        type: n.type as FlowNodeType,
        position: n.position,
        data: n.data as Record<string, unknown>,
      })),
      edges: edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      })),
    };

    const snapshot = JSON.stringify(graph);
    if (snapshot === graphSnapshot.current) return;

    setSaveStatus('saving');
    try {
      await autosaveDraft({ flowId, versionId, graph }).unwrap();
      if (!controller.signal.aborted) {
        graphSnapshot.current = snapshot;
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), SAVED_DISPLAY_MS);
      }
    } catch {
      if (!controller.signal.aborted) {
        setSaveStatus('error');
      }
    }
  }, [flowId, versionId, autosaveDraft]);

  const scheduleSave = useCallback((nodes: Node[], edges: Edge[]) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      performSave(nodes, edges);
    }, AUTOSAVE_DELAY_MS);
  }, [performSave]);

  const markDirty = useCallback((nodes: Node[], edges: Edge[]) => {
    scheduleSave(nodes, edges);
  }, [scheduleSave]);

  const updateSnapshot = useCallback((graph: FlowGraph) => {
    graphSnapshot.current = JSON.stringify(graph);
  }, []);

  return { saveStatus, markDirty, updateSnapshot };
}
