import test from 'node:test';import assert from 'node:assert/strict';import { installHostedModuleBridge } from './hostedBridge.mjs';
const context={sessionId:'session',runId:'run',instanceId:'instance',occurrenceId:'occurrence',episodeId:'episode',adventureId:'adventure',participantIds:['p1']};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('retry learns the authoritative revision after a lost acknowledgment',async()=>{
 const h=harness();h.send('initialize',{config:{},configRevision:2,mediaMap:{}});await flush();
 const pending=h.bridge.proposeConfig({questionText:'retry'});await flush();let request=h.sent.at(-1);
 h.send('config-ack',{requestId:request.requestId,accepted:false,configRevision:3,reason:'Retry Save'});await pending;
 const retry=h.bridge.proposeConfig({questionText:'retry'});await flush();request=h.sent.at(-1);
 assert.equal(request.expectedRevision,3);h.send('config-ack',{requestId:request.requestId,accepted:true,configRevision:4});await retry;await h.bridge.dispose();
});
test('configuration export failure keeps the editor alive for recovery',async()=>{
 const sent=[],listeners=new Map(),parent={postMessage:value=>sent.push(value)};
 const win={parent,location:{origin:'test'},crypto:{randomUUID:()=>String(sent.length)},addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
 const bridge=installHostedModuleBridge({targetWindow:win,moduleType:'final-boss-hero',instanceId:'instance',scheduler:{pause:async()=>{},dispose(){}},parseHostCommand:value=>value,adapter:{initialize(){},exportConfig(){throw Error('Repair missing reference');}}});
 const send=(type)=>listeners.get('message')({source:parent,origin:'test',data:{type,moduleType:'final-boss-hero',context,hostGeneration:1,requestId:type,config:{},configRevision:0}});
 send('initialize');await flush();send('config-request');await flush();
 assert.equal(sent.at(-1).type,'config-failed');assert.equal(bridge.state,'initialized');await bridge.dispose();
});
test('editor requests match responses and reject pending work when closed',async()=>{
 const h=harness();h.send('initialize',{config:{},configRevision:0,mediaMap:{}});await flush();
 assert.equal(typeof h.bridge.requestEditor,'function');
 const pending=h.bridge.requestEditor('media-list'),request=h.sent.at(-1);
 assert.equal(request.operation,'media-list');
 h.send('editor-response',{requestId:request.requestId,ok:true,assets:[]});
 assert.deepEqual((await pending).assets,[]);
 const abandoned=h.bridge.requestEditor('media-import'),rejected=assert.rejects(abandoned,/closed/i);
 await h.bridge.dispose();await rejected;
});
function harness(){const sent=[],calls=[],listeners=new Map(),parent={postMessage:message=>sent.push(message)};const win={parent,location:{origin:'test'},crypto:{randomUUID:()=>`id-${sent.length}`},addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};const scheduler={pause:async()=>calls.push('pause'),resume:async()=>calls.push('resume'),stop:()=>calls.push('stop'),dispose:()=>calls.push('dispose')};const bridge=installHostedModuleBridge({targetWindow:win,moduleType:'language-snake',instanceId:'instance',scheduler,parseHostCommand:value=>value,adapter:{exportConfig:()=>({questionText:'latest editor value'}),initialize:async()=>calls.push('initialize'),start:async()=>calls.push('start'),reset:async()=>calls.push('reset'),stop:async()=>calls.push('adapter-stop'),dispose:async()=>calls.push('adapter-dispose')}});const send=(type,extra={},source=parent)=>listeners.get('message')?.({source,origin:'test',data:{channel:'story-studio-module',version:1,moduleType:'language-snake',moduleVersion:1,hostGeneration:1,requestId:type,context,type,...extra}});return{sent,calls,bridge,send};}
test('host bridge authenticates sender, deduplicates commands and preserves lifecycle ordering',async()=>{const h=harness();h.send('initialize',{config:{},configRevision:1,mediaMap:{}},{});await flush();assert.deepEqual(h.calls,[]);h.send('initialize',{config:{},configRevision:1,mediaMap:{}});await flush();assert.deepEqual(h.calls,['pause','initialize']);assert.equal(h.sent.at(-1).type,'ready');h.send('start');h.send('start');await flush();assert.deepEqual(h.calls.slice(-2),['start','resume']);h.send('pause');await flush();h.send('resume');await flush();assert.equal(h.bridge.state,'running');h.send('dispose');await flush();assert.equal(h.bridge.state,'disposed');assert.equal(h.calls.at(-1),'dispose');});
test('config proposals wait for matching acknowledgement and reject stale revision',async()=>{const h=harness();h.send('initialize',{config:{},configRevision:2,mediaMap:{}});await flush();const pending=h.bridge.proposeConfig({questionText:'edited'});await flush();const proposal=h.sent.at(-1);assert.equal(proposal.type,'config-proposal');assert.equal(proposal.expectedRevision,2);h.send('config-ack',{requestId:proposal.requestId,accepted:true,configRevision:3});await pending;assert.equal(h.bridge.configRevision,3);h.send('stop');await flush();assert.throws(()=>h.bridge.emit('activity-completed',{participantIds:['p1'],outcome:'won'}),/running/);});

test('host Save flush waits for prior proposal then exports latest config with matching request identity',async()=>{const h=harness();h.send('initialize',{config:{},configRevision:0,mediaMap:{}});await flush();const first=h.bridge.proposeConfig({questionText:'earlier'});await flush();const proposal=h.sent.at(-1);h.send('config-request',{requestId:'save-flush'});await flush();assert.equal(h.sent.at(-1).requestId,proposal.requestId);h.send('config-ack',{requestId:proposal.requestId,accepted:true,configRevision:1});await first;await flush();const latest=h.sent.at(-1);assert.equal(latest.requestId,'save-flush');assert.equal(latest.expectedRevision,1);assert.equal(latest.config.questionText,'latest editor value');h.send('config-ack',{requestId:'save-flush',accepted:true,configRevision:2});await flush();await h.bridge.dispose();});

test('module inventory reads wait for a matching Core response and reject on disposal',async()=>{
 const h=harness();h.send('initialize',{config:{},configRevision:0,mediaMap:{}});await flush();
 const pending=h.bridge.requestInventory(),request=h.sent.at(-1);assert.equal(request.type,'inventory-request');
 let done=false;void pending.then(()=>{done=true;});h.send('inventory-response',{requestId:'wrong',inventory:[]});await flush();assert.equal(done,false);
 const inventory=[{participantId:'p1',rewards:[{rewardId:'gem',quantity:2}]}];h.send('inventory-response',{requestId:request.requestId,inventory});assert.deepEqual(await pending,inventory);
 const abandoned=h.bridge.requestInventory(),rejected=assert.rejects(abandoned,/closed/i);await h.bridge.dispose();await rejected;
});
