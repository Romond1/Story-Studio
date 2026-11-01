import test from 'node:test';import assert from 'node:assert/strict';
import {parseRosterPresentation,projectRosterPresentation} from './students/rosterPresentation';
import {createProgressionState} from './progression/reducer';
import {parsePresentSnapshot} from './presentationSnapshot';
test('roster projection never forwards identity or full names and scopes balances',()=>{const state=createProgressionState();state.students=[{studentId:'private-id',adventureId:'world',inventory:{gem:3},relics:{r:2},completedEpisodes:[]}];const result=projectRosterPresentation({roster:[{id:'private-id',name:'Private Full Name',nickname:'Star',archived:false,createdAt:'',updatedAt:''}],participantIds:['private-id','guest:private'],progression:state,adventureId:'world',sessionId:'session',position:'bottom',showScores:true,showRewards:true,showRelics:true});assert.deepEqual(result.entries,[{nickname:'Star',rewards:3,relicProgress:2},{nickname:'Guest 1'}]);assert.doesNotMatch(JSON.stringify(result),/private|Full Name/);});
test('strict projection parser strips extra private fields and rejects unsafe content',()=>{const raw={position:'top',entries:[{nickname:'Star',avatar:'star',studentId:'private',history:['secret']}],remaining:0};assert.deepEqual(parseRosterPresentation(raw),{position:'top',entries:[{nickname:'Star',avatar:'star'}],remaining:0});for(const avatar of ['https://tracker','data:image/png','<img>'])assert.equal(parseRosterPresentation({...raw,entries:[{nickname:'X',avatar}]}),null);assert.equal(parseRosterPresentation({...raw,entries:Array(201).fill({nickname:'X'})}),null);assert.equal(parseRosterPresentation({...raw,remaining:-1}),null);});
test('optional roster survives snapshot target branches without private fields',()=>{for(const target of [{kind:'empty',occurrenceId:'o'},{kind:'badge',occurrenceId:'o'},{kind:'unsupported',occurrenceId:'o'},{kind:'game',occurrenceId:'o',gameId:'language-snake',instanceId:'i'},{kind:'image',occurrenceId:'o',src:'media://image'}]){const parsed=parsePresentSnapshot({sessionId:'s',revision:1,target,roster:{position:'top',entries:[{nickname:'Star',id:'secret'}],remaining:0}});assert.deepEqual(parsed?.roster,{position:'top',entries:[{nickname:'Star'}],remaining:0});}});

test('scores require matching captured session and adventure; selected roster includes more than eight students',()=>{
 const state=createProgressionState();const context={sessionId:'current',runId:'run',instanceId:'i',occurrenceId:'o',episodeId:'e',adventureId:'world',participantIds:['p']};state.runs=[{context,moduleType:'language-snake',lastSequence:1}];state.history=[{id:'score',recordedAt:'',kind:'score-reported',adventureId:'world',runId:'run',studentIds:['p'],scores:[{studentId:'p',score:7}]},{id:'wrong',recordedAt:'',kind:'score-reported',adventureId:'other',runId:'run',studentIds:['p'],scores:[{studentId:'p',score:999}]}];
 const input={roster:[{id:'p',name:'Private',nickname:'Hero',archived:false,createdAt:'',updatedAt:''},{id:'archived',name:'Private',archived:true,createdAt:'',updatedAt:''}],participantIds:['p','archived',...Array.from({length:10},(_,i)=>'guest:'+i)],progression:state,adventureId:'world',sessionId:'current',position:'top' as const,showScores:true,showRewards:true,showRelics:true};
 const result=projectRosterPresentation(input);assert.equal(result.entries[0].score,7);assert.equal(result.entries.length,11);assert.equal(result.remaining,0);assert.equal(projectRosterPresentation({...input,sessionId:'old'}).entries[0].score,undefined);assert.equal(projectRosterPresentation({...input,showScores:false}).entries[0].score,undefined);
});

test('Present reward totals use session balances without counting aggregate stars twice',()=>{
 const roster=[{id:'p',name:'Private',nickname:'Hero',archived:false,createdAt:'',updatedAt:''}];
 const result=projectRosterPresentation({roster,participantIds:['p'],progression:null,sessionRewards:{students:[{id:'p',name:'Private',yellowSparks:2,blueSparks:3,pinkSparks:1,crowns:1,stars:7,badgeVisible:true}],activeStudentId:'p',sparks:[],appliedEventIds:[]},sessionId:'s',position:'bottom',showScores:false,showRewards:true,showRelics:false});
 assert.deepEqual(result.entries,[{nickname:'Hero',rewards:7}]);assert.ok(parseRosterPresentation({...result,entries:Array(20).fill(result.entries[0])}));
});

test('Present selection projects a whole class in selection order without expanding recipients',()=>{
 const roster=Array.from({length:24},(_,i)=>({id:`private-${i}`,name:`Private full name ${i}`,nickname:`Hero ${i}`,archived:false,createdAt:'',updatedAt:''}));
 const selected=roster.map(student=>student.id).reverse();
 const input={roster,participantIds:[...selected,selected[0]],progression:null,sessionId:'s',position:'top' as const,showScores:false,showRewards:false,showRelics:false};
 const result=projectRosterPresentation(input);assert.equal(result.entries.length,24);assert.equal(result.remaining,0);assert.equal(result.entries[0].nickname,'Hero 23');assert.equal(result.entries[23].nickname,'Hero 0');assert.equal(selected.length,24);assert.deepEqual(parseRosterPresentation(result),result);assert.doesNotMatch(JSON.stringify(result),/private|full name/i);
 assert.deepEqual(projectRosterPresentation({...input,participantIds:[]}).entries,[]);
});

test('selected participants without nicknames display their names',()=>{
 const result=projectRosterPresentation({roster:[{id:'a',name:'Alice',archived:false,createdAt:'',updatedAt:''},{id:'b',name:'Ben',archived:false,createdAt:'',updatedAt:''}],participantIds:['a','b'],progression:null,sessionId:'s',position:'bottom',showScores:false,showRewards:false,showRelics:false});assert.deepEqual(result.entries.map(e=>e.nickname),['Alice','Ben']);
});
