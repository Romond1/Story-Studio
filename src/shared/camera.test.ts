import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMERA_DEFAULTS, parseCameraSettings } from './cameraProtocol';
import { CameraSession } from './cameraSession';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

test('camera protocol rejects malformed values and strips private extras', () => {
  assert.equal(parseCameraSettings({ ...CAMERA_DEFAULTS, tolerance: NaN }), null);
  assert.equal(parseCameraSettings({ ...CAMERA_DEFAULTS, preset: 'teacher-notes' }), null);
  assert.equal(parseCameraSettings({ ...CAMERA_DEFAULTS, enabled: 'yes' }), null);
  assert.deepEqual(parseCameraSettings({ ...CAMERA_DEFAULTS, notes: 'private' }), CAMERA_DEFAULTS);
});

test('late permission completion releases its stream after off', async () => {
  let finish!: (stream: { stop: () => void }) => void;
  let stopped = 0;
  const session = new CameraSession<{ stop: () => void }>(() => new Promise(resolve => { finish = resolve; }), stream => stream.stop());
  const first = session.start('');
  await new Promise(resolve => setImmediate(resolve));
  session.stop();
  finish({ stop: () => stopped++ });
  assert.equal(await first, null);
  assert.equal(stopped, 1);
});

test('device replacement never overlaps capture and releases old tracks', async () => {
  let active = 0, maximum = 0;
  const session = new CameraSession(async (id: string) => {
    active++; maximum = Math.max(maximum, active);
    return { id, stop: () => active-- };
  }, stream => stream.stop());
  await session.start('one');
  const two = session.start('two');
  const three = session.start('three');
  assert.equal(await two, null);
  assert.equal((await three)?.id, 'three');
  assert.equal(maximum, 1);
  session.stop();
  assert.equal(active, 0);
});

test('permission failure does not prevent a later retry', async () => {
  let calls = 0;
  const session = new CameraSession(async () => { if (!calls++) throw new Error('denied'); return { stop() {} }; }, stream => stream.stop());
  await assert.rejects(session.start(''), /denied/);
  assert.ok(await session.start(''));
  session.stop();
});

test('camera IPC authenticates roles, filters payloads, and cancels pending consent on reset', async () => {
  const handles = new Map<string, (...args: any[]) => any>();
  const events = new Map<string, (...args: any[]) => any>();
  const makeWindow = () => ({ isDestroyed: () => false, webContents: { mainFrame: {}, isDestroyed: () => false, send: (_channel: string, _value: unknown) => {} } });
  const control = makeWindow(), present = makeWindow();
  const event = (window: ReturnType<typeof makeWindow>) => ({ sender: window.webContents, senderFrame: window.webContents.mainFrame });
  let consent!: (value: { response: number }) => void;
  const exports: any = {};
  const source = ts.transpileModule(readFileSync('src/main/cameraBroadcast.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText;
  vm.runInNewContext(source, { exports, require: (name: string) => {
    if (name === 'electron') return { ipcMain: { handle: (key: string, fn: any) => handles.set(key, fn), on: (key: string, fn: any) => events.set(key, fn) }, dialog: { showMessageBox: () => new Promise(resolve => { consent = resolve; }) } };
    if (name === '../shared/cameraProtocol') return require('./cameraProtocol');
    throw new Error(name);
  } });
  const relay = exports.installCameraBroadcast(() => control, () => present);
  const get = () => handles.get('camera:control-get')!(event(control));
  await assert.rejects(handles.get('camera:set')!(event(present), CAMERA_DEFAULTS), /Only Control/);
  await assert.rejects(handles.get('camera:set')!({ sender: control.webContents, senderFrame: {} }, CAMERA_DEFAULTS), /Only Control/);
  assert.throws(() => handles.get('camera:control-get')!(event(present)), /Only Control/);
  assert.throws(() => handles.get('camera:present-get')!(event(control)), /Only Presenter/);
  await assert.rejects(handles.get('camera:set')!(event(control), { ...CAMERA_DEFAULTS, brightness: Infinity }), /Invalid/);
  const pending = handles.get('camera:set')!(event(control), { ...CAMERA_DEFAULTS, enabled: true });
  relay.reset(); consent({ response: 0 }); await pending;
  assert.equal(get().settings.enabled, false);
  const retry = handles.get('camera:set')!(event(control), { ...CAMERA_DEFAULTS, enabled: true, notes: 'private' });
  consent({ response: 0 }); await retry;
  assert.equal(get().settings.enabled, true);
  assert.equal(get().settings.notes, undefined);
  events.get('camera:status')!(event(control), { state: 'error', devices: [] });
  assert.equal(get().status.state, 'starting');
  events.get('camera:status')!(event(present), { state: 'live', devices: [], teacherNotes: 'private' });
  assert.equal(get().status.state, 'live');
  assert.equal(get().status.teacherNotes, undefined);
  relay.reset();
  events.get('camera:status')!(event(present), { state: 'live', devices: [] });
  assert.equal(get().status.state, 'off');
});
