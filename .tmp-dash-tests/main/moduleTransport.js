"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleTransport = void 0;
const protocol_1 = require("../shared/modules/protocol");
const runtime_1 = require("../shared/modules/runtime");
/** Runtime-only bridge. It has no lesson writer or permanent reward authority. */
class ModuleTransport {
    constructor(runtime, toPresent, toControl) {
        this.runtime = runtime;
        this.toPresent = toPresent;
        this.toControl = toControl;
        this.initialization = null;
        this.sequence = 0;
        this.state = 'stopped';
        this.commands = new Map();
    }
    clear() { this.initialization = null; this.sequence = 0; this.state = 'stopped'; this.commands.clear(); }
    current(message) {
        const runtime = this.runtime();
        return runtime.available && runtime.generation === message.hostGeneration
            && runtime.instanceId === message.context.instanceId && runtime.moduleType === message.moduleType;
    }
    send(value) {
        const message = (0, protocol_1.parseHostToModuleMessage)(value);
        if (!message || !this.current(message))
            return false;
        if (message.type === 'initialize') {
            if (this.initialization && !(0, protocol_1.sameRunContext)(this.initialization.context, message.context))
                return false;
            if (!this.initialization) {
                this.initialization = message;
                this.sequence = 0;
                this.state = 'initialized';
                this.commands.set(message.requestId, { command: 'initialize', state: 'initialized' });
            }
            else if (JSON.stringify(this.initialization) !== JSON.stringify(message))
                return false;
        }
        else if (!this.initialization || !(0, protocol_1.sameRunContext)(this.initialization.context, message.context))
            return false;
        if (['start', 'pause', 'resume', 'reset', 'stop', 'dispose'].includes(message.type)) {
            if (message.type === 'reset')
                return false; // A reset is a fresh iframe and instance.
            try {
                const next = (0, runtime_1.transitionLifecycle)(this.state, message.type, message.context.runId, message.context.runId);
                if (message.type === 'stop' || message.type === 'dispose')
                    this.commands.clear();
                this.commands.set(message.requestId, { command: message.type, state: next });
                if (message.type === 'pause' || message.type === 'stop' || message.type === 'dispose')
                    this.state = next;
            }
            catch {
                return false;
            }
        }
        this.toPresent(message);
        if (message.type === 'dispose')
            this.clear();
        return true;
    }
    get(instanceId) {
        return this.initialization && this.initialization.context.instanceId === instanceId && this.current(this.initialization) ? this.initialization : null;
    }
    receive(value) {
        const message = (0, protocol_1.parseModuleToHostMessage)(value);
        if (!message || !this.initialization || !this.current(message)
            || !(0, protocol_1.sameRunContext)(this.initialization.context, message.context)
            || message.sequence <= this.sequence)
            return false;
        if (message.type === 'event' && this.state !== 'running')
            return false;
        if (message.type === 'error') {
            this.state = 'stopped';
            this.commands.clear();
        }
        if (message.type === 'ack') {
            const pending = this.commands.get(message.requestId);
            if (!pending || pending.command !== message.command)
                return false;
            this.commands.delete(message.requestId);
            this.state = pending.state;
        }
        this.sequence = message.sequence;
        this.toControl(message);
        return true;
    }
}
exports.ModuleTransport = ModuleTransport;
