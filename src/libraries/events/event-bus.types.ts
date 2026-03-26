import type { NodeType } from '../../engine/composite/workflow-node.js';
import type { WorkflowStatus } from '../../components/workflow/workflow.types.js';
import type { StepStatus } from '../../components/step/step.types.js';

export interface NodeStatusEvent {
  id: string;
  type: NodeType;
  status: WorkflowStatus | StepStatus;
  error?: string;
}

export interface StepResultEvent {
  stepId: string;
  status: StepStatus;
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
