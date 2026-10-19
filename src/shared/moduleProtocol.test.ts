import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHostToModuleMessage,parseModuleToHostMessage,parseActivityEvent} from './modules/protocol';
import {createModuleTemplate} from './modules/templates';
import {transitionLifecycle,createEventLedger,acceptActivityEvent} from './modules/runtime';
import type {ActivityEvent,RunContext} from './modules/model';
const context:RunContext={sessionId:'session',runId:'run',instanceId:'instance',occurrenceId:'occurrence',episodeId:'episode',adventureId:'adventure',participantIds:['a','b']};
const envelope={channel:'story-studio-module',version:1,moduleType:'language-snake',moduleVersion:1,hostGeneration:2,requestId:'request',context};
test('editor bridge accepts bounded catalogue requests and rejects file path authority',()=>{
 const request={...envelope,type:'editor-request',sequence:1,operation:'media-list'};
 assert.ok(parseModuleToHostMessage(request));
 assert.equal(parseModuleToHostMessage({...request,paths:['C:/private.png']}),null);
 assert.equal(parseModuleToHostMessage({...request,operation:'delete-assets'}),null);
 const response={...envelope,type:'editor-response',ok:true,assets:[{id:'picture',name:'Portrait',mediaType:'image',url:'media://scoped/grant'}]};
 assert.ok(parseHostToModuleMessage(response));
 assert.equal(parseHostToModuleMessage({...response,assets:[{...response.assets[0],mediaType:'executable'}]}),null);
});
test('protocol rejects unknown fields, unsupported versions, transient configs and mismatched events',()=>{
 const init={...envelope,type:'initialize',configVersion:1,config:createModuleTemplate('language-snake'),configRevision:0,mediaMap:{}};
 assert.ok(parseHostToModuleMessage(init));assert.equal(parseHostToModuleMessage({...init,version:2}),null);assert.equal(parseHostToModuleMessage({...init,roster:[]}),null);
 const event:ActivityEvent={version:1,eventId:'e',context,sequence:1,type:'score-reported',payload:{scores:[{participantId:'a',score:2}]}};
 assert.ok(parseModuleToHostMessage({...envelope,type:'event',sequence:1,event}));assert.equal(parseModuleToHostMessage({...envelope,type:'event',sequence:2,event}),null);
 assert.equal(parseActivityEvent({...event,payload:{scores:[{participantId:'stranger',score:3}]}}),null);
});
test('lifecycle rejects invalid transitions and reset requires fresh run identity',()=>{
 assert.equal(transitionLifecycle('initialized','start','run','run'),'running');assert.equal(transitionLifecycle('running','pause','run','run'),'paused');
 assert.throws(()=>transitionLifecycle('initialized','resume','run','run'));
 assert.throws(()=>transitionLifecycle('running','reset','run','run'));
 assert.equal(transitionLifecycle('paused','reset','run','new'),'initialized');
 assert.equal(transitionLifecycle('disposed','dispose','run','run'),'disposed');assert.throws(()=>transitionLifecycle('disposed','start','run','run'));
});
test('event ledger captures run and participants, deduplicates identical payload, rejects collision/stale/order',()=>{
 const event:ActivityEvent={version:1,eventId:'event',context,sequence:1,type:'score-reported',payload:{scores:[{participantId:'a',score:3}]}};
 const original=createEventLedger(context,'language-snake');const accepted=acceptActivityEvent(original,event);assert.equal(accepted.result.accepted,true);assert.equal(Object.keys(original.accepted).length,0);
 const replay=acceptActivityEvent(accepted.ledger,structuredClone(event));assert.equal(replay.result.accepted,true);assert.equal(replay.result.duplicate,true);
 assert.equal(acceptActivityEvent(accepted.ledger,{...event,sequence:5}).result.duplicate,true);
 assert.equal(acceptActivityEvent(accepted.ledger,{...event,payload:{scores:[{participantId:'a',score:4}]}}).result.accepted,false);
 assert.equal(acceptActivityEvent(accepted.ledger,{...event,eventId:'next'}).result.accepted,false);
 assert.equal(acceptActivityEvent(accepted.ledger,{...event,eventId:'next',sequence:2,context:{...context,runId:'stale'}}).result.accepted,false);
 assert.equal(acceptActivityEvent(accepted.ledger,{...event,eventId:'next',sequence:2,payload:{scores:[{participantId:'b',score:6}]}}).result.accepted,true);
});

test('module capability rejects scores from Activation and accepts captured completion only',()=>{
 const ledger=createEventLedger(context,'activation-cards');
 assert.equal(acceptActivityEvent(ledger,{version:1,eventId:'score',context,sequence:1,type:'score-reported',payload:{scores:[{participantId:'a',score:1}]}}).result.accepted,false);
 assert.equal(acceptActivityEvent(ledger,{version:1,eventId:'done',context,sequence:1,type:'activity-completed',payload:{participantIds:['a','b'],outcome:'completed'}}).result.accepted,true);
});
