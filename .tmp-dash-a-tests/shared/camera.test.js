"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const cameraProtocol_1 = require("./cameraProtocol");
const cameraSession_1 = require("./cameraSession");
const node_fs_1 = require("node:fs");
const node_vm_1 = __importDefault(require("node:vm"));
const typescript_1 = __importDefault(require("typescript"));
(0, node_test_1.default)('camera protocol rejects malformed values and strips private extras', () => {
    strict_1.default.equal((0, cameraProtocol_1.parseCameraSettings)({ ...cameraProtocol_1.CAMERA_DEFAULTS, tolerance: NaN }), null);
    strict_1.default.equal((0, cameraProtocol_1.parseCameraSettings)({ ...cameraProtocol_1.CAMERA_DEFAULTS, preset: 'teacher-notes' }), null);
    strict_1.default.equal((0, cameraProtocol_1.parseCameraSettings)({ ...cameraProtocol_1.CAMERA_DEFAULTS, enabled: 'yes' }), null);
    strict_1.default.equal((0, cameraProtocol_1.parseCameraSettings)({ ...cameraProtocol_1.CAMERA_DEFAULTS, tracking: { enabled: 'yes', markers: true, hat: true } }), null);
    strict_1.default.deepEqual((0, cameraProtocol_1.parseCameraSettings)({ ...cameraProtocol_1.CAMERA_DEFAULTS, notes: 'private' }), cameraProtocol_1.CAMERA_DEFAULTS);
});
(0, node_test_1.default)('late permission completion releases its stream after off', async () => {
    let finish;
    let stopped = 0;
    const session = new cameraSession_1.CameraSession(() => new Promise(resolve => { finish = resolve; }), stream => stream.stop());
    const first = session.start('');
    await new Promise(resolve => setImmediate(resolve));
    session.stop();
    finish({ stop: () => stopped++ });
    strict_1.default.equal(await first, null);
    strict_1.default.equal(stopped, 1);
});
(0, node_test_1.default)('device replacement never overlaps capture and releases old tracks', async () => {
    let active = 0, maximum = 0;
    const session = new cameraSession_1.CameraSession(async (id) => {
        active++;
        maximum = Math.max(maximum, active);
        return { id, stop: () => active-- };
    }, stream => stream.stop());
    await session.start('one');
    const two = session.start('two');
    const three = session.start('three');
    strict_1.default.equal(await two, null);
    strict_1.default.equal((await three)?.id, 'three');
    strict_1.default.equal(maximum, 1);
    session.stop();
    strict_1.default.equal(active, 0);
});
(0, node_test_1.default)('permission failure does not prevent a later retry', async () => {
    let calls = 0;
    const session = new cameraSession_1.CameraSession(async () => { if (!calls++)
        throw new Error('denied'); return { stop() { } }; }, stream => stream.stop());
    await strict_1.default.rejects(session.start(''), /denied/);
    strict_1.default.ok(await session.start(''));
    session.stop();
});
(0, node_test_1.default)('camera IPC authenticates roles, filters payloads, and cancels pending consent on reset', async () => {
    const handles = new Map();
    const events = new Map();
    const makeWindow = () => ({ isDestroyed: () => false, webContents: { mainFrame: {}, isDestroyed: () => false, send: (_channel, _value) => { } } });
    const control = makeWindow(), present = makeWindow();
    const event = (window) => ({ sender: window.webContents, senderFrame: window.webContents.mainFrame });
    let consent;
    const exports = {};
    const source = typescript_1.default.transpileModule((0, node_fs_1.readFileSync)('src/main/cameraBroadcast.ts', 'utf8'), { compilerOptions: { module: typescript_1.default.ModuleKind.CommonJS, target: typescript_1.default.ScriptTarget.ES2021 } }).outputText;
    node_vm_1.default.runInNewContext(source, { exports, require: (name) => {
            if (name === 'electron')
                return { ipcMain: { handle: (key, fn) => handles.set(key, fn), on: (key, fn) => events.set(key, fn) }, dialog: { showMessageBox: () => new Promise(resolve => { consent = resolve; }) } };
            if (name === '../shared/cameraProtocol')
                return require('./cameraProtocol');
            if (name === '../shared/faceTrackingProtocol')
                return require('./faceTrackingProtocol');
            throw new Error(name);
        } });
    const relay = exports.installCameraBroadcast(() => control, () => present);
    const get = () => handles.get('camera:control-get')(event(control));
    await strict_1.default.rejects(handles.get('camera:set')(event(present), cameraProtocol_1.CAMERA_DEFAULTS), /Only Control/);
    await strict_1.default.rejects(handles.get('camera:set')({ sender: control.webContents, senderFrame: {} }, cameraProtocol_1.CAMERA_DEFAULTS), /Only Control/);
    strict_1.default.throws(() => handles.get('camera:control-get')(event(present)), /Only Control/);
    strict_1.default.throws(() => handles.get('camera:present-get')(event(control)), /Only Presenter/);
    await strict_1.default.rejects(handles.get('camera:set')(event(control), { ...cameraProtocol_1.CAMERA_DEFAULTS, brightness: Infinity }), /Invalid/);
    const pending = handles.get('camera:set')(event(control), { ...cameraProtocol_1.CAMERA_DEFAULTS, enabled: true });
    relay.reset();
    consent({ response: 0 });
    await pending;
    strict_1.default.equal(get().settings.enabled, false);
    const retry = handles.get('camera:set')(event(control), { ...cameraProtocol_1.CAMERA_DEFAULTS, enabled: true, notes: 'private' });
    consent({ response: 0 });
    await retry;
    strict_1.default.equal(get().settings.enabled, true);
    strict_1.default.equal(get().settings.notes, undefined);
    events.get('camera:status')(event(control), { state: 'error', devices: [] });
    strict_1.default.equal(get().status.state, 'starting');
    events.get('camera:status')(event(present), { state: 'live', devices: [], teacherNotes: 'private' });
    strict_1.default.equal(get().status.state, 'live');
    strict_1.default.equal(get().status.teacherNotes, undefined);
    events.get('camera:tracking-status')(event(present), { state: 'tracking' });
    strict_1.default.notEqual(get().trackingStatus?.state, 'tracking', 'disabled tracking cannot publish live state');
    await handles.get('camera:set')(event(control), { ...cameraProtocol_1.CAMERA_DEFAULTS, enabled: true, tracking: { enabled: true, markers: true, hat: true } });
    events.get('camera:tracking-status')(event(control), { state: 'tracking' });
    strict_1.default.notEqual(get().trackingStatus?.state, 'tracking', 'Control cannot impersonate tracker');
    events.get('camera:tracking-status')(event(present), { state: 'tracking', landmarks: ['private'] });
    strict_1.default.equal(get().trackingStatus.state, 'tracking');
    strict_1.default.equal(get().trackingStatus.landmarks, undefined);
    relay.reset();
    events.get('camera:status')(event(present), { state: 'live', devices: [] });
    strict_1.default.equal(get().status.state, 'off');
    events.get('camera:tracking-status')(event(present), { state: 'tracking' });
    strict_1.default.notEqual(get().trackingStatus?.state, 'tracking', 'late worker status cannot revive disabled camera');
});
