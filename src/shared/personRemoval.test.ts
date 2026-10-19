import test from 'node:test';
import assert from 'node:assert/strict';
import {RemovalGate,parseRemovalStatus} from './personRemoval';
test('segmentation allows one frame, drops stale results and reduces expensive work',()=>{
 const g=new RemovalGate();assert.equal(g.begin(0),true);assert.equal(g.begin(200),false);assert.equal(g.finish(0,20,10),true);assert.equal(g.begin(30),false);assert.equal(g.begin(100),true);assert.equal(g.finish(100,600,80),false);assert.equal(g.begin(601),true);g.finish(601,681,80);assert.equal(g.fps,6);
 for(let i=0;i<5;i++){const t=1000+i*200;assert.equal(g.begin(t),true);g.finish(t,t+10,10);}assert.equal(g.fps,12,'cheap inference recovers after startup or temporary contention');
});
test('repeated excessive inference opens circuit until a new session',()=>{
 const g=new RemovalGate();for(let i=0;i<5;i++){assert.equal(g.begin(i*250),true);g.finish(i*250,i*250+180,180);}assert.equal(g.overloaded,true);assert.equal(g.begin(2000),false);
});
test('removal status validates finite telemetry and strips arbitrary payload',()=>{
 assert.deepEqual(parseRemovalStatus({state:'running',fps:12,inferenceMs:7,maskAgeMs:30,renderFps:30,private:'secret'}),{state:'running',fps:12,inferenceMs:7,maskAgeMs:30,renderFps:30});
 for(const patch of [{fps:Infinity},{state:'unknown'},{inferenceMs:-1}])assert.equal(parseRemovalStatus({state:'running',...patch}),null);
});
