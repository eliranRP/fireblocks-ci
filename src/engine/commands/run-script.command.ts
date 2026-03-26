import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { BaseCommand } from './base-command.js';
import type { CommandData } from './command.interface.js';
import type { RunContext } from '../context.js';
import { eventBus } from '../../libraries/events/event-bus.js';

const execAsync = promisify(exec);

export interface RunScriptCommandData extends CommandData {
  type: 'run_script';
  script: string;
  workDir: string;
}

export interface RunScriptCommandOptions {
  stepId: string;
  script: string;
  workDir: string;
  env?: Record<string, string>;
}

export class RunScriptCommand extends BaseCommand {
  private readonly stepId: string;
  private readonly script: string;
  private readonly workDir: string;
  private readonly env: Record<string, string>;

  constructor({ stepId, script, workDir, env = {} }: RunScriptCommandOptions) {
    super();
    this.stepId = stepId;
    this.script = script;
    this.workDir = workDir;
    this.env = env;
  }

  async execute(ctx: RunContext): Promise<void> {
    const start = Date.now();
    try {
      const { stdout, stderr } = await execAsync(this.script, {
        cwd: this.workDir,
        env: { ...process.env, ...ctx.env, ...this.env },
      });
      const log = stdout || stderr;
      ctx.logs.push(log);
      eventBus.emit('step:result', {
        stepId: this.stepId,
        status: 'success',
        log,
        duration_ms: Date.now() - start,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      eventBus.emit('step:result', {
        stepId: this.stepId,
        status: 'failed',
        log: message,
        duration_ms: Date.now() - start,
      });
      throw err;
    }
  }

  toJSON(): RunScriptCommandData {
    return { type: 'run_script', script: this.script, workDir: this.workDir };
  }
}
