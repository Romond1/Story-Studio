import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ProgressionRepository } from '../main/progressionRepository';
import { ProgressionService } from '../main/progressionService';
const context={sessionId:'session',runId:'run',instanceId:'instance',occurrenceId:'occurrence',episodeId:'episode',adventureId:'adventure',participantIds:['student']};
const roster=[{id:'student',name:'Student',archived:false,createdAt:'now',updatedAt:'now'}];
test('only observed running transport events persist; saved receipt replay survives restart',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'progression-authority-'));
 try{const repository=new ProgressionRepository(path.join(root,'store.json'));const host={getScope:()=>({folderPath:'project',episodeId:'episode',adventureId:'adventure',leaseId:'lease'}),getRoster:async()=>roster};const service=new ProgressionService(repository,host);
 const registered=await service.registerRun({expectedFolder:'project',activityId:'activity',moduleType:'language-snake',context});assert.equal(registered.accepted,true);
 const event={version:1 as const,eventId:'complete',context,sequence:2,type:'activity-completed' as const,payload:{participantIds:['student'],outcome:'won' as const}};
 await assert.rejects(service.recordEvent(event),/observed|authorized/i);
 const envelope={channel:'story-studio-module' as const,version:1 as const,moduleType:'language-snake' as const,moduleVersion:1 as const,hostGeneration:1,requestId:'request',context};
 assert.equal(service.authorizeInitialize({...envelope,type:'initialize'} as any),true);service.hostCommand({...envelope,type:'initialize'} as any);service.acceptedModule({...envelope,type:'ack',command:'start',sequence:1});service.acceptedModule({...envelope,type:'event',sequence:2,event});service.acceptedModule({...envelope,type:'event',sequence:3,event:{...event,sequence:3,payload:{...event.payload,outcome:'lost'}}});service.retire(context.instanceId);assert.equal((await service.recordEvent(event)).accepted,true);
 const postStop={...event,eventId:'post-stop',sequence:4};service.acceptedModule({...envelope,type:'event',sequence:4,event:postStop});await assert.rejects(service.recordEvent(postStop),/observed/);
 const restarted=new ProgressionService(new ProgressionRepository(path.join(root,'store.json')),host);assert.equal((await restarted.recordEvent(event)).duplicate,true);
 assert.equal((await restarted.recordEvent({...event,payload:{...event.payload,outcome:'lost'}})).accepted,false);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('stale registration scopes and unregistered initialization are rejected',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'progression-scope-'));
 try{const service=new ProgressionService(new ProgressionRepository(path.join(root,'store.json')),{getScope:()=>({folderPath:'project',episodeId:'episode',adventureId:'adventure',leaseId:'lease'}),getRoster:async()=>roster});await assert.rejects(service.registerRun({expectedFolder:'old',activityId:'activity',moduleType:'language-snake',context}),/changed|scope/i);assert.equal(service.authorizeInitialize({context,moduleType:'language-snake'} as any),false);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('Activation completion captures participants and another registered run reads approved inventory only',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'progression-activation-'));
 try{const service=new ProgressionService(new ProgressionRepository(path.join(root,'store.json')),{getScope:()=>({folderPath:'project',episodeId:'episode',adventureId:'adventure',leaseId:'lease'}),getRoster:async()=>roster});const adventureDefinition={id:'adventure',version:'1',name:'Adventure',description:'',rewards:[{id:'coin',name:'Coin',kind:'currency' as const}],relics:[]};
 await service.registerRun({expectedFolder:'project',activityId:'activation',moduleType:'activation-cards',context,adventureDefinition});await assert.rejects(service.completeActivation({commandId:'completion',runId:context.runId,outcome:'completed'}),/not running/);await service.lifecycle({runId:context.runId,state:'running'});assert.equal((await service.completeActivation({commandId:'completion',runId:context.runId,outcome:'completed'})).accepted,true);
 const history=(await service.getSnapshot()).history.find(row=>row.kind==='activity-completed')!;const request=await service.requestReward({commandId:'request',eventKey:history.id,rewardId:'coin',quantity:2});assert.equal((await service.decideReward({commandId:'approve',requestId:request.requestIds![0],decision:'approve'})).accepted,true);
 const next={...context,runId:'mastery',instanceId:'mastery-instance'};await service.registerRun({expectedFolder:'project',activityId:'boss',moduleType:'final-boss-hero',context:next,adventureDefinition});assert.deepEqual(await service.getRunInventory(next),[{participantId:'student',rewards:[{rewardId:'coin',quantity:2}]}]);await assert.rejects(service.getRunInventory({...next,participantIds:['other']}),/context/);
 assert.equal((await service.completeActivation({commandId:'completion',runId:context.runId,outcome:'completed'})).duplicate,true);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
