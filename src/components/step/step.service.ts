import * as stepDal from './step.dal.js';
import type { StepRow } from './step.types.js';

export function getStep(stepId: string): StepRow {
  return stepDal.findById(stepId);
}

export function getStepLog(stepId: string): string | null {
  const step = stepDal.findById(stepId);
  return step.log;
}
