import { parseHostToModuleMessage, parseModuleToHostMessage, sameRunContext, type HostToModuleMessage, type ModuleToHostMessage } from '../shared/modules/protocol';
import { transitionLifecycle } from '../shared/modules/runtime';
import type { LifecycleCommand, ModuleLifecycle } from '../shared/modules/model';

type Initialize = Extract<HostToModuleMessage, { type: 'initialize' }>;
/** Runtime-only bridge. It has no lesson writer or permanent reward authority. */
export class ModuleTransport {
  private initialization: Initialize | null = null;
  private sequence = 0;
  private state: ModuleLifecycle = 'stopped';
  private commands = new Map<string, { command: LifecycleCommand; state: ModuleLifecycle }>();
  constructor(private runtime: () => { generation: number; available: boolean; instanceId?: string; moduleType?: string },
    private toPresent: (message: HostToModuleMessage) => void,
    private toControl: (message: ModuleToHostMessage) => void) {}
  clear() { this.initialization = null; this.sequence = 0; this.state = 'stopped'; this.commands.clear(); }
  private current(message: HostToModuleMessage | ModuleToHostMessage) {
    const runtime = this.runtime();
    return runtime.available && runtime.generation === message.hostGeneration
      && runtime.instanceId === message.context.instanceId && runtime.moduleType === message.moduleType;
  }
  send(value: unknown): boolean {
    const message = parseHostToModuleMessage(value);
    if (!message || !this.current(message)) return false;
    if (message.type === 'initialize') {
      if (this.initialization && !sameRunContext(this.initialization.context, message.context)) return false;
      if (!this.initialization) { this.initialization = message; this.sequence = 0; this.state = 'initialized'; this.commands.set(message.requestId, { command: 'initialize', state: 'initialized' }); }
      else if (JSON.stringify(this.initialization) !== JSON.stringify(message)) return false;
    } else if (!this.initialization || !sameRunContext(this.initialization.context, message.context)) return false;
    if (['start','pause','resume','reset','stop','dispose'].includes(message.type)) {
      if (message.type === 'reset') return false; // A reset is a fresh iframe and instance.
      try {
        const next = transitionLifecycle(this.state, message.type as LifecycleCommand, message.context.runId, message.context.runId);
        if (message.type === 'stop' || message.type === 'dispose') this.commands.clear();
        this.commands.set(message.requestId, { command: message.type as LifecycleCommand, state: next });
        if (message.type === 'pause' || message.type === 'stop' || message.type === 'dispose') this.state = next;
      } catch { return false; }
    }
    this.toPresent(message);
    if (message.type === 'dispose') this.clear();
    return true;
  }
  get(instanceId: string): Initialize | null {
    return this.initialization && this.initialization.context.instanceId === instanceId && this.current(this.initialization) ? this.initialization : null;
  }
  receive(value: unknown): boolean {
    const message = parseModuleToHostMessage(value);
    if (!message || !this.initialization || !this.current(message)
      || !sameRunContext(this.initialization.context, message.context)
      || message.sequence <= this.sequence) return false;
    if (message.type === 'event' && this.state !== 'running') return false;
    if (message.type === 'error') { this.state = 'stopped'; this.commands.clear(); }
    if (message.type === 'ack') {
      const pending = this.commands.get(message.requestId);
      if (!pending || pending.command !== message.command) return false;
      this.commands.delete(message.requestId); this.state = pending.state;
    }
    this.sequence = message.sequence;
    this.toControl(message);
    return true;
  }
}
