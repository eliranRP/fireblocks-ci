import { fromRow } from '../../src/engine/commands/command-factory.js';
import { RunScriptCommand } from '../../src/engine/commands/run-script.command.js';
import { DockerRunCommand } from '../../src/engine/commands/docker-run.command.js';
import { ValidationError } from '../../src/libraries/error-handler/errors.js';
import type { StepRow } from '../../src/components/step/step.types.js';

function makeStepRow(overrides: Partial<StepRow> = {}): StepRow {
  return {
    id: 'step-1',
    job_id: 'job-1',
    name: 'test step',
    position: 0,
    command_type: 'run_script',
    command_json: JSON.stringify({ type: 'run_script', script: 'echo hello', workDir: '/tmp' }),
    status: 'pending',
    log: null,
    duration_ms: null,
    started_at: null,
    finished_at: null,
    ...overrides,
  };
}

describe('CommandFactory.fromRow', () => {
  it('creates RunScriptCommand from run_script row', () => {
    const cmd = fromRow(makeStepRow());
    expect(cmd).toBeInstanceOf(RunScriptCommand);
    expect(cmd.toJSON()).toMatchObject({ type: 'run_script', script: 'echo hello' });
  });

  it('creates DockerRunCommand from docker_run row', () => {
    const cmd = fromRow(
      makeStepRow({
        command_type: 'docker_run',
        command_json: JSON.stringify({ type: 'docker_run', image: 'node:20', command: 'npm test' }),
      }),
    );
    expect(cmd).toBeInstanceOf(DockerRunCommand);
    expect(cmd.toJSON()).toMatchObject({ type: 'docker_run', image: 'node:20' });
  });

  it('throws ValidationError for unknown command type', () => {
    expect(() =>
      fromRow(makeStepRow({ command_type: 'unknown_type', command_json: '{}' })),
    ).toThrow(ValidationError);
  });
});
