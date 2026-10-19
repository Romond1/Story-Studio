import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeActivation,commandActivation,nextActivationScene,completeActivation} from './modules/activation';
import type {RunContext} from './modules/model';
const context:RunContext={sessionId:'session',runId:'run',instanceId:'activity',occurrenceId:'occurrence',episodeId:'episode',adventureId:'adventure',participantIds:['captured']};
test('Activation references existing scenes and captures participants without an authored card store',()=>{
 const scenes=['scene-1','scene-2'];let run=initializeActivation(scenes,context);scenes.push('changed');context.participantIds.push('later');
 assert.deepEqual(run.sceneIds,['scene-1','scene-2']);assert.deepEqual(run.context.participantIds,['captured']);
 run=commandActivation(run,'start');run=nextActivationScene(run);assert.equal(run.sceneIds[run.index],'scene-2');
 run=commandActivation(run,'pause');assert.throws(()=>nextActivationScene(run));run=commandActivation(run,'resume');
 const completed=completeActivation(run,'event');assert.equal(completed.run.state,'stopped');assert.deepEqual(completed.event.payload,{participantIds:['captured'],outcome:'completed'});assert.throws(()=>completeActivation(completed.run,'again'));
});
test('Activation reset creates a new run with the same captured participants and first scene',()=>{
 let run=commandActivation(initializeActivation(['one','two'],{...context,participantIds:['captured']}),'start');run=nextActivationScene(run);
 assert.throws(()=>commandActivation(run,'reset',run.context.runId));run=commandActivation(run,'reset','new-run');assert.equal(run.context.runId,'new-run');assert.equal(run.state,'initialized');assert.equal(run.index,0);assert.deepEqual(run.context.participantIds,['captured']);
});
test('Activation completion waits for durable acknowledgment and preserves retry event identity',async()=>{
 const {completeActivationAsync}=await import('./modules/activation');const run=commandActivation(initializeActivation(['one'],{...context,participantIds:['captured']}),'start');const ids:string[]=[];
 await assert.rejects(completeActivationAsync(run,'stable-event',async event=>{ids.push(event.eventId);throw Error('Lost acknowledgment');}));assert.equal(run.state,'running');
 const completed=await completeActivationAsync(run,'stable-event',async event=>{ids.push(event.eventId);return {accepted:true};});assert.deepEqual(ids,['stable-event','stable-event']);assert.equal(completed.run.state,'stopped');
 await assert.rejects(completeActivationAsync(run,'rejected',async()=>({accepted:false,reason:'No active run'})),/No active run/);
});
