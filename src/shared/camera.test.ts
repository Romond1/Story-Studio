import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMERA_DEFAULTS, parseCameraSettings, transformCameraLayout } from './cameraProtocol';
import { CameraSession } from './cameraSession';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

test('free camera layout stays bounded and legacy settings remain valid', () => {
  assert.ok(parseCameraSettings(CAMERA_DEFAULTS));
  const layout = { x: .12, y: .2, width: .3, height: .4 };
  assert.deepEqual((parseCameraSettings({ ...CAMERA_DEFAULTS, layout }) as any)?.layout, layout);
  assert.ok(parseCameraSettings({...CAMERA_DEFAULTS,layout:{x:-.5,y:-.3,width:1.5,height:1.4}}));
  for (const patch of [{ x: -4 }, { width: 0 }, { x: 1.1 }, { height: NaN }, {width:5}])
    assert.equal(parseCameraSettings({ ...CAMERA_DEFAULTS, layout: { ...layout, ...patch } }), null);
});

test('all four resize corners preserve the opposite anchor and permit offscreen crop',()=>{
 const rect={x:.1,y:.2,width:.4,height:.3};
 for(const corner of ['nw','ne','sw','se'] as const){
  const next=transformCameraLayout(rect,corner,corner.includes('w')?-.3:.3,corner.includes('n')?-.3:.3);
  assert.ok(next.width>.4&&next.height>.3);
  if(corner.includes('w'))assert.ok(Math.abs(next.x+next.width-(rect.x+rect.width))<.00001);else assert.equal(next.x,rect.x);
  if(corner.includes('n'))assert.ok(Math.abs(next.y+next.height-(rect.y+rect.height))<.00001);else assert.equal(next.y,rect.y);
 }
 assert.ok(transformCameraLayout(rect,'move',-.3,-.3).x<0);
 const tiny=transformCameraLayout(rect,'se',-10,-10);assert.equal(tiny.width,.03);assert.equal(tiny.height,.03);
 const huge=transformCameraLayout(rect,'se',10,10);assert.equal(huge.width,4);assert.equal(huge.height,4);
 assert.ok(transformCameraLayout(rect,'move',-10,-10).x+rect.width>0);
});

test('camera protocol rejects malformed values and strips private extras', () => {
  assert.equal(parseCameraSettings({ ...CAMERA_DEFAULTS, tolerance: NaN }), null);
  assert.equal(parseCameraSettings({ ...CAMERA_DEFAULTS, preset: 'teacher-notes' }), null);
  assert.equal(parseCameraSettings({ ...CAMERA_DEFAULTS, enabled: 'yes' }), null);
  assert.equal(parseCameraSettings({...CAMERA_DEFAULTS,personRemoval:'yes'}),null);
  assert.equal(parseCameraSettings({ ...CAMERA_DEFAULTS, tracking: { enabled: 'yes', markers: true, hat: true } }), null);
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
  const savedPreferences: any[] = [];
  const exports: any = {};
  const source = ts.transpileModule(readFileSync('src/main/cameraBroadcast.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText;
  vm.runInNewContext(source, { exports, require: (name: string) => {
    if (name === 'electron') return { app: { getPath: () => 'test-profile' }, ipcMain: { handle: (key: string, fn: any) => handles.set(key, fn), on: (key: string, fn: any) => events.set(key, fn) }, dialog: { showMessageBox: () => new Promise(resolve => { consent = resolve; }) } };
    if (name === 'node:path') return { default: require('node:path') };
    if (name === './cameraPreferences') return { createCameraPreferencesStore: () => ({ load: () => ({ ...CAMERA_DEFAULTS }), save: (settings: any) => savedPreferences.push(settings) }) };
    if (name === '../shared/cameraProtocol') return require('./cameraProtocol');
    if (name === '../shared/personRemoval') return require('./personRemoval');
    if (name === '../shared/faceTrackingProtocol') return require('./faceTrackingProtocol');
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
  const layout={x:.1,y:.2,width:.3,height:.4};
  events.get('camera:layout')!(event(present),layout);
  assert.equal(get().settings.layout,undefined,'editing is opt-in');
  await handles.get('camera:set')!(event(control),{...get().settings,editLayout:true});
  events.get('camera:layout')!(event(control),layout);
  assert.equal(get().settings.layout,undefined,'only Presenter can request free placement');
  events.get('camera:layout')!(event(present),{...layout,x:2});
  assert.equal(get().settings.layout,undefined,'out of bounds layout rejected');
  events.get('camera:layout')!(event(present),{...layout,enabled:false,private:'secret'});
  assert.equal(get().settings.layout.x,.1);
  assert.equal(get().settings.layout.private,undefined);
  assert.equal(get().settings.enabled,true,'layout request cannot change capture');
  assert.equal(savedPreferences[savedPreferences.length - 1].layout.x, .1, 'Presenter placement is saved');
  assert.equal(get().preferencesSaved, true);
  await handles.get('camera:set')!(event(control),{...get().settings,personRemoval:true});
  events.get('camera:removal-status')!(event(control),{state:'running',fps:12});
  assert.notEqual(get().removalStatus?.state,'running');
  events.get('camera:status')!(event(control), { state: 'error', devices: [] });
  assert.equal(get().status.state, 'starting');
  events.get('camera:status')!(event(present), { state: 'live', devices: [], teacherNotes: 'private' });
  assert.equal(get().status.state, 'live');
  events.get('camera:removal-status')!(event(present),{state:'running',fps:12,private:'secret'});
  assert.equal(get().removalStatus.state,'running');assert.equal(get().removalStatus.private,undefined);
  assert.equal(get().status.teacherNotes, undefined);
  events.get('camera:tracking-status')!(event(present), { state: 'tracking' });
  assert.notEqual(get().trackingStatus?.state, 'tracking', 'disabled tracking cannot publish live state');
  await handles.get('camera:set')!(event(control), { ...CAMERA_DEFAULTS, enabled: true, tracking: { enabled: true, markers: true, hat: true } });
  assert.equal(savedPreferences[savedPreferences.length - 1].tracking.enabled, true, 'tracking preferences are saved');
  events.get('camera:tracking-status')!(event(control), { state: 'tracking' });
  assert.notEqual(get().trackingStatus?.state, 'tracking', 'Control cannot impersonate tracker');
  events.get('camera:tracking-status')!(event(present), { state: 'tracking', landmarks: ['private'] });
  assert.equal(get().trackingStatus.state, 'tracking');
  assert.equal(get().trackingStatus.landmarks, undefined);
  relay.reset();
  events.get('camera:status')!(event(present), { state: 'live', devices: [] });
  assert.equal(get().status.state, 'off');
  events.get('camera:tracking-status')!(event(present), { state: 'tracking' });
  assert.notEqual(get().trackingStatus?.state, 'tracking', 'late worker status cannot revive disabled camera');
});
