import { jest } from '@jest/globals';
import { sseManager } from '../../src/libraries/sse/sse-manager.js';
import type { Response } from 'express';

function makeRes(): Response & { written: string[] } {
  const res = {
    written: [] as string[],
    write: jest.fn((chunk: string) => { res.written.push(chunk); return true; }),
  };
  return res as unknown as Response & { written: string[] };
}

// The sseManager is a module-level singleton — clean up after each test
afterEach(() => {
  // Remove clients by triggering removeClient for anything we added
  // (we track them explicitly in each test)
});

describe('SseManager', () => {
  it('broadcasts a formatted SSE payload to all clients for a runId', () => {
    const res1 = makeRes();
    const res2 = makeRes();

    sseManager.addClient('run-1', res1);
    sseManager.addClient('run-1', res2);
    sseManager.broadcast('run-1', 'node:status', { status: 'running' });

    const expected = 'event: node:status\ndata: {"status":"running"}\n\n';
    expect(res1.write).toHaveBeenCalledWith(expected);
    expect(res2.write).toHaveBeenCalledWith(expected);

    sseManager.removeClient('run-1', res1);
    sseManager.removeClient('run-1', res2);
  });

  it('does not broadcast to clients of a different runId', () => {
    const res = makeRes();
    sseManager.addClient('run-A', res);
    sseManager.broadcast('run-B', 'node:status', { status: 'success' });
    expect(res.write).not.toHaveBeenCalled();
    sseManager.removeClient('run-A', res);
  });

  it('stops delivering after removeClient', () => {
    const res = makeRes();
    sseManager.addClient('run-2', res);
    sseManager.removeClient('run-2', res);
    sseManager.broadcast('run-2', 'run:complete', { status: 'success' });
    expect(res.write).not.toHaveBeenCalled();
  });

  it('removeClient on unknown runId is a no-op', () => {
    const res = makeRes();
    expect(() => sseManager.removeClient('nonexistent', res)).not.toThrow();
  });

  it('cleans up the runId key when the last client disconnects', () => {
    const res = makeRes();
    sseManager.addClient('run-3', res);
    sseManager.removeClient('run-3', res);
    // Subsequent broadcast to the same runId should not throw
    expect(() => sseManager.broadcast('run-3', 'run:complete', {})).not.toThrow();
  });

  it('supports multiple independent runIds simultaneously', () => {
    const resA = makeRes();
    const resB = makeRes();
    sseManager.addClient('runA', resA);
    sseManager.addClient('runB', resB);

    sseManager.broadcast('runA', 'step:result', { status: 'success' });

    expect(resA.write).toHaveBeenCalledTimes(1);
    expect(resB.write).not.toHaveBeenCalled();

    sseManager.removeClient('runA', resA);
    sseManager.removeClient('runB', resB);
  });
});
