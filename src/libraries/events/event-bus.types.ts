import type { NodeType } from '../../engine/composite/workflow-node.js';

// Status values the engine actually emits — excludes 'pending' and 'skipped'
// which are set only at creation time, never via events.
export type NodeStatus = 'running' | 'success' | 'failed';

export interface NodeStatusEvent {
  id: string;
  type: NodeType;
  status: NodeStatus;
  runId: string;
  error?: string;
}

export interface StepResultEvent {
  stepId: string;
  status: 'success' | 'failed';
  log: string;
  duration_ms: number;
}

export interface RunStartEvent {
  runId: string;
  workflowId: string;
}

export interface RunCompleteEvent {
  runId: string;
  status: 'success' | 'failed';
  error?: string;
}

export interface BusEvents {
  'node:status': [NodeStatusEvent];
  'step:result': [StepResultEvent];
  'run:start': [RunStartEvent];
  'run:complete': [RunCompleteEvent];
}
