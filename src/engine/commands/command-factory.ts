import type { ICommand } from './command.interface.js';
import { RunScriptCommand } from './run-script.command.js';
import { DockerRunCommand } from './docker-run.command.js';
import type { StepRow } from '../../components/step/step.types.js';
import { ValidationError } from '../../libraries/error-handler/errors.js';

export function fromRow(row: StepRow): ICommand {
  const data = JSON.parse(row.command_json) as Record<string, unknown>;

  switch (row.command_type) {
    case 'run_script':
      return new RunScriptCommand({
        stepId: row.id,
        script: String(data['script'] ?? ''),
        workDir: String(data['workDir'] ?? process.cwd()),
      });
    case 'docker_run':
      return new DockerRunCommand({
        stepId: row.id,
        image: String(data['image'] ?? ''),
        command: String(data['command'] ?? ''),
      });
    default: {
      // Exhaustiveness check — TypeScript will error here if a new CommandType is added
      // to step.types.ts without a corresponding case above.
      const unreachable: never = row.command_type;
      throw new ValidationError(`Unknown command type: ${unreachable}`);
    }
  }
}
