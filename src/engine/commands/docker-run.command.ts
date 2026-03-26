import { BaseCommand } from './base-command.js';
import type { CommandData } from './command.interface.js';
import type { RunContext } from '../context.js';

export interface DockerRunCommandData extends CommandData {
  type: 'docker_run';
  image: string;
  command: string;
}

export class DockerRunCommand extends BaseCommand {
  private readonly image: string;
  private readonly command: string;

  constructor({ image, command }: { stepId: string; image: string; command: string }) {
    super();
    this.image = image;
    this.command = command;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async execute(_ctx: RunContext): Promise<void> {
    // Stub — Docker execution not implemented in this iteration
    throw new Error(`DockerRunCommand not implemented (image: ${this.image}, command: ${this.command})`);
  }

  toJSON(): DockerRunCommandData {
    return { type: 'docker_run', image: this.image, command: this.command };
  }
}
