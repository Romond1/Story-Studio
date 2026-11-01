import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGameEffect, sampleEffectParticle, effectProgress, effectParticleCount } from './gameEffects';
const cue={version:1 as const,id:'turn:effect:3',kind:'coins' as const,startedAt:1000,durationMs:2800,intensity:1,sound:false,caption:'Well done!'};
test('effect cues whitelist public data and reject unbounded resources',()=>{
 assert.deepEqual(parseGameEffect({...cue,teacherInstructions:'PRIVATE'}),cue);
 for(const patch of [{durationMs:99999},{intensity:99},{startedAt:NaN},{kind:'unknown'},{sound:'yes'},{caption:'x'.repeat(201)}]) assert.equal(parseGameEffect({...cue,...patch}),null);
 assert.ok(effectParticleCount(cue)<=160); assert.equal(effectParticleCount({...cue,intensity:0}),0);
});
test('effects reconstruct deterministic trajectories across late/reloaded windows',()=>{
 const restored=parseGameEffect(JSON.parse(JSON.stringify(cue)))!;
 for(const elapsed of [0,300,1000,2000,2800]) for(let i=0;i<40;i++) assert.deepEqual(sampleEffectParticle(cue,i,elapsed/2800),sampleEffectParticle(restored,i,elapsed/2800));
 assert.equal(effectProgress(cue,900),0); assert.equal(effectProgress(cue,3800),1); assert.equal(effectProgress(cue,9000),1);
 const coin=sampleEffectParticle(cue,3,.45),star=sampleEffectParticle({...cue,kind:'stars'},3,.45);
 assert.notDeepEqual(coin,star); assert.ok(Number.isFinite(coin.x));
});

test('effect size and intensity remain bounded and survive serialization',()=>{
 for(const scale of [.5,1,3]) assert.equal(parseGameEffect({...cue,scale})?.scale,scale);
 for(const patch of [{scale:0},{scale:3.01},{scale:NaN},{intensity:3.01}]) assert.equal(parseGameEffect({...cue,...patch}),null);
 assert.ok(effectParticleCount({...cue,intensity:3})>effectParticleCount(cue));
 assert.ok(effectParticleCount({...cue,intensity:3})<=160);
});

test('starburst keeps spreading and fading without collecting in the corner',()=>{
 const star={...cue,kind:'stars' as const};
 for(let i=0;i<30;i++) {
  const middle=sampleEffectParticle(star,i,.4),late=sampleEffectParticle(star,i,.9),end=sampleEffectParticle(star,i,1);
  assert.ok(Math.hypot(late.x-.29,late.y-.5)>Math.hypot(middle.x-.29,middle.y-.5));
  assert.ok(Math.hypot(end.x-.88,end.y-.09)>.15);
  assert.ok(late.alpha<middle.alpha);assert.equal(end.alpha,0);
 }
});
