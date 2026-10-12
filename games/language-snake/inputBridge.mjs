const CHANNEL = 'story-studio-game';
const MODIFIER_KEYS = new Set(['Control', 'Alt', 'Meta', 'Shift', 'AltGraph']);

// Every command must originate from the host of this exact iframe instance.
// The packaged Electron app uses the opaque "null" file origin; window identity
// and the session identifier remain required in that case.
export function readGameInputMessage(event, { parentWindow, instanceId, origin }) {
  if (!instanceId || event.source !== parentWindow || event.origin !== origin) return null;
  const data = event.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (data.channel !== CHANNEL || data.type !== 'input' || data.instanceId !== instanceId) return null;
  if (data.phase !== 'keydown' && data.phase !== 'keyup') return null;
  if (typeof data.key !== 'string' || !data.key || data.key.length > 64) return null;
  if (typeof data.code !== 'string' || data.code.length > 64 || typeof data.repeat !== 'boolean') return null;
  if (data.ctrlKey || data.altKey || data.metaKey || MODIFIER_KEYS.has(data.key)) return null;
  if (data.shiftKey !== undefined && typeof data.shiftKey !== 'boolean') return null;
  return { key: data.key, code: data.code, phase: data.phase, repeat: data.repeat, ...(typeof data.shiftKey === 'boolean' ? { shiftKey: data.shiftKey } : {}) };
}
