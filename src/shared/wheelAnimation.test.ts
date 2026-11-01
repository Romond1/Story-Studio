import test from 'node:test';
import assert from 'node:assert/strict';
import { createWheelSpin, sampleWheelSpin, parseWheelSpin } from './lesson/wheelAnimation';
import { createWheelConfig, addWheelActivity, readWheelSettings } from './lesson/spinningWheel';
import { initializeWheel, transitionWheel, restoreWheel, type WheelAction } from './lesson/wheelRuntime';

test('every segment lands at its center after acceleration, cruise and slowdown', () => {
  for (const count of [1, 2, 8, 24, 99, 1000]) for (let index = 0; index < count; index++) {
    const spin = createWheelSpin('spin', 'segment', index, count, 725, 1000, 4800);
    assert.equal(sampleWheelSpin(spin, 999).degrees, 725);
    const end = sampleWheelSpin(spin, 5800);
    assert.equal(end.degrees, spin.toDegrees); assert.equal(end.phase, 'landed');
    assert.ok(Math.abs((end.degrees + (index + .5) * 360 / count) / 360 - Math.round((end.degrees + (index + .5) * 360 / count) / 360)) < .000001);
    assert.ok(spin.toDegrees - spin.fromDegrees >= 5 * 360);
  }
});
test('serialized metadata reconstructs late, reloaded and reduced-motion views deterministically', () => {
  const spin = createWheelSpin('spin', 's', 3, 8, 0, 1000, 4800);
  const restored = parseWheelSpin(JSON.parse(JSON.stringify(spin)))!;
  for (const now of [1000, 1200, 2500, 4000, 5799, 5800, 9000]) assert.deepEqual(sampleWheelSpin(spin, now), sampleWheelSpin(restored, now));
  assert.equal(sampleWheelSpin(spin, 1400, true).degrees, spin.toDegrees);
  assert.equal(sampleWheelSpin(spin, 1400, true).phase, 'accelerating');
  assert.equal(parseWheelSpin({ ...spin, durationMs: Infinity }), null);
  assert.equal(parseWheelSpin({ ...spin, toDegrees: -1 }), null);
});
test('curve is continuous, monotonic and slows to a precise stop', () => {
  const spin = createWheelSpin('spin','s',0,8,0,0,4800);
  let last = 0;
  for (let now = 0; now <= 4800; now++) { const value = sampleWheelSpin(spin,now).degrees; assert.ok(value >= last); last = value; }
  const delta = (now:number) => sampleWheelSpin(spin,now+10).degrees-sampleWheelSpin(spin,now).degrees;
  assert.ok(delta(500)<delta(1800)); assert.ok(delta(3000)>delta(4000)); assert.ok(delta(4000)>delta(4700));
});
function fixture() {
 let config = createWheelConfig(); for(let i=0;i<4;i++) config=addWheelActivity(config,i%2?'event':'question',i%2?undefined:'card');
 config.settings={...config.settings,playCount:4,questionCount:2,sequenceMode:'alternating'}; return config;
}
test('timed runtime rejects premature reveal, duplicate selection and stale reset actions; consecutive spins retain pose',()=>{
 const config=fixture(); let state=initializeWheel(config)!;
 const act=(type:WheelAction['type'],extra:Partial<WheelAction>={})=>transitionWheel(config,state,{type,expectedRevision:state.revision,configKey:state.configKey,sessionId:'session',occurrenceId:'entry',visit:1,entropy:0,...extra});
 state=act('start'); state=act('select',{spin:{startedAt:1000,durationMs:4800}}); const spin=state.spin!;
 assert.ok(spin); assert.deepEqual(restoreWheel(config,JSON.parse(JSON.stringify(state))),state);
 assert.deepEqual(act('select'),state); assert.deepEqual(act('show',{atMs:5799}),state); assert.deepEqual(act('show'),state);
 state=act('show',{atMs:5800}); state=act('complete',{atMs:5800}); state=act('next');
 state=act('select',{spin:{startedAt:6000,durationMs:240}}); assert.equal(state.spin!.fromDegrees,spin.toDegrees);
 assert.equal(state.spin!.segmentId,state.selectedSegmentId); assert.equal(readWheelSettings(config)!.segments.length,4);
 const oldRevision=state.revision; state=act('reset'); assert.equal(state.spin,undefined); assert.equal(state.rotationDegrees,undefined);
 assert.deepEqual(act('show',{expectedRevision:oldRevision,atMs:9000}),state);
});
