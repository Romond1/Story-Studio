import test from 'node:test';
import assert from 'node:assert/strict';
import { createDash, dashAction, dashProjection, parseDashConfig, defaultDashConfig,mergeSavedDashConfig,removeDashCard } from './heroDash';
import {parsePresentSnapshot} from './presentationSnapshot';
import {parseEpisodeActivity} from './modules/validation';
import {collectModuleAssets,remapModuleAssets} from './modules/media';
import {fitDashQuestion} from './heroDashQuestionLayout';
import {selectDashImages,prepareDashImages} from './heroDashPreparation';

test('only teacher awards advance racers; pause blocks awards, finish clamps, undo restores', () => {
 let s = createDash({...defaultDashConfig(),checkpoints:6}); s = dashAction(s, {type:'move',amount:2}); assert.equal(s.positions[0],0);
 s = dashAction(s,{type:'start'}); s = dashAction(s,{type:'move',amount:2}); assert.deepEqual(s.positions,[2,0]);
 s = dashAction(s,{type:'pause'}); assert.equal(dashAction(s,{type:'move',amount:2}).positions[0],2);
 s = dashAction(s,{type:'resume'}); s = dashAction(s,{type:'move',amount:3}); s = dashAction(s,{type:'move',amount:3});
 assert.equal(s.positions[0],7); assert.equal(s.status,'finished');
 s = dashAction(s,{type:'undo'}); assert.equal(s.positions[0],5); assert.equal(s.status,'playing');
 s = dashAction(s,{type:'reset'}); assert.deepEqual(s.positions,[0,0]); assert.equal(s.status,'ready');
});
test('question projection omits private notes and unselected cards; resolving hides question', () => {
 const config={...defaultDashConfig(),cards:[{id:'q',image:'asset:photo',text:'Describe it',note:'PRIVATE ANSWER',reward:2}]};
 let s=createDash(config); s=dashAction(s,{type:'start'}); s=dashAction(s,{type:'show'});
 const view=dashProjection(s, id=>'media://'+id); assert.equal(view.question?.image,'media://photo'); assert.ok(!JSON.stringify(view).includes('PRIVATE'));
 s=dashAction(s,{type:'move',amount:2}); assert.equal(s.questionVisible,false); assert.equal(s.positions[0],2);
 s=dashAction(s,{type:'incorrect'}); assert.equal(s.positions[0],2); assert.equal(s.feedback,'Try again — take your time');
});
test('saved configuration accepts asset references and rejects unsafe media and invalid rewards',()=>{
 assert.equal(parseDashConfig(defaultDashConfig()).checkpoints,20);
 for(const image of ['blob:temporary','file:///secret','https://tracking.test/image']) assert.throws(()=>parseDashConfig({...defaultDashConfig(),cards:[{id:'q',image,text:'',note:'',reward:1}]}));
 assert.throws(()=>parseDashConfig({...defaultDashConfig(),checkpoints:9}));
});
test('episode activity save/reopen keeps image associations; package remap visits the question media',()=>{
 const config={...defaultDashConfig(),cards:[{id:'q',image:'asset:photo',text:'',note:'Teacher answer',reward:2}]};
 const activity=parseEpisodeActivity(JSON.parse(JSON.stringify({id:'race',moduleType:'hero-dash',moduleVersion:1,configVersion:1,config})));
 assert.equal(activity.moduleType,'hero-dash');assert.equal(collectModuleAssets(activity)[0].assetId,'photo');
 const remapped=remapModuleAssets(activity,()=> 'asset:copied-photo');assert.equal(collectModuleAssets(remapped)[0].assetId,'copied-photo');
});
test('snapshot relay strips teacher notes and rejects temporary image URLs',()=>{
 const view=dashProjection(createDash(),()=>undefined);
 const snapshot={sessionId:'session',revision:1,target:{kind:'game',occurrenceId:'race',instanceId:'run',gameId:'hero-dash',dash:{...view,note:'SECRET',history:[{answer:'SECRET'}]}}};
 const parsed=parsePresentSnapshot(snapshot);assert.ok(parsed);assert.ok(!JSON.stringify(parsed).includes('SECRET'));
 assert.equal(parsePresentSnapshot({...snapshot,target:{...snapshot.target,dash:{...view,question:{image:'blob:temporary',text:''}}}}),null);
});
test('medium and long formats use the same finish rules and explicit teacher bonus',()=>{
 for(const checkpoints of [8,10,20,30] as const){let s=createDash({...defaultDashConfig(),checkpoints});s=dashAction(s,{type:'start'});s=dashAction(s,{type:'move',amount:3});assert.equal(s.positions[0],3);assert.equal(s.positions[1],0);while(s.status==='playing')s=dashAction(s,{type:'move',amount:3});assert.equal(s.positions[0],checkpoints+1);}
});
test('manual position override is explicit, bounded, works while paused and supports undo',()=>{
 let s=dashAction(createDash(),{type:'start'});s=dashAction(s,{type:'pause'});s=dashAction(s,{type:'set-position',position:4});assert.equal(s.positions[0],4);assert.equal(s.scores[0],0);assert.equal(s.status,'paused');s=dashAction(s,{type:'undo'});assert.equal(s.positions[0],0);assert.equal(dashAction(s,{type:'set-position',position:100}),s);
});
test('spontaneous imported image and pinned questions need no prepared card',()=>{
 let s=createDash();s=dashAction(s,{type:'start'});s=dashAction(s,{type:'image',image:'dash:review-image'});s=dashAction(s,{type:'show'});
 assert.equal(s.config.cards.length,0);assert.equal(dashProjection(s,()=>undefined).question?.image,'media://hero-dash/review-image');
 s=dashAction(s,{type:'pin'});s=dashAction(s,{type:'move',amount:1});assert.equal(s.questionVisible,true);assert.equal(s.positions[0],1);
 s=dashAction(s,{type:'hide'});assert.equal(s.questionVisible,false);
});
test('review defaults to twenty spaces, supports ten to thirty and preserves legacy tracks',()=>{
 assert.equal(defaultDashConfig().checkpoints,20);for(const checkpoints of [6,8,10,20,30])assert.equal(parseDashConfig({...defaultDashConfig(),checkpoints}).checkpoints,checkpoints);
 for(const checkpoints of [9,31,20.5])assert.throws(()=>parseDashConfig({...defaultDashConfig(),checkpoints}));
 let s=createDash();s=dashAction(s,{type:'camera',camera:'side'});assert.equal(s.camera,'side');s=dashAction(s,{type:'orbit',yaw:1.2,pitch:.6});assert.equal(s.camera,'orbit');
 assert.equal(dashProjection(s,()=>undefined).orbitYaw,1.2);
});
test('completing an asynchronous save preserves newer moves and never replaces another race',()=>{
 const initial=createDash(),expected=initial.config,saved={...expected,title:'Saved'};const advanced=dashAction(dashAction(initial,{type:'start'}),{type:'move',amount:2});
 assert.equal(mergeSavedDashConfig(advanced,expected,saved).positions[0],2);const other=createDash();assert.equal(mergeSavedDashConfig(other,expected,saved),other);
});
test('removing the last selected prepared card clamps the cursor and hides its image',()=>{
 let s=createDash({...defaultDashConfig(),cards:[{id:'a',image:'asset:one',text:'',note:'',reward:1},{id:'b',image:'asset:two',text:'',note:'',reward:1}]});s={...s,questionIndex:1,questionVisible:true};s=removeDashCard(s,'b');assert.equal(s.questionIndex,0);assert.equal(s.questionVisible,false);s=removeDashCard(s,'a');assert.equal(s.questionIndex,0);
});
test('centered questions retain their large contained size regardless of camera or captions',()=>{
 const view={left:0,top:0,width:1000,height:600},camera={left:650,top:400,width:330,height:180};
 for(const image of [{width:1200,height:400},{width:300,height:700},{width:500,height:500}]){const fit=fitDashQuestion(view,image,[camera]);assert.ok(Math.abs(fit.width/fit.height-image.width/image.height)<.02);assert.deepEqual(fit,fitDashQuestion(view,image,[]));assert.deepEqual(fit,fitDashQuestion(view,image,[{left:0,top:100,width:1000,height:300}]));}
 assert.equal(fitDashQuestion(view,{width:1200,height:400},[]).width,860);
});
test('Ctrl toggles, Shift ranges and batch preparation keep source ordering and existing cards',()=>{
 const refs=['dash:a','dash:b','dash:c','dash:d'];let selection=selectDashImages(refs,[],undefined,'dash:b',false,false);selection=selectDashImages(refs,selection.refs,selection.anchor,'dash:d',false,true);assert.deepEqual(selection.refs,['dash:b','dash:c','dash:d']);selection=selectDashImages(refs,selection.refs,selection.anchor,'dash:c',true,false);assert.deepEqual(selection.refs,['dash:b','dash:d']);let id=0;const config=prepareDashImages(defaultDashConfig(),selection.refs,()=>String(++id));assert.deepEqual(config.cards.map(c=>c.image),['dash:b','dash:d']);assert.equal(prepareDashImages(config,['dash:a'],()=>String(++id)).cards.length,3);
});
test('zoom is bounded; teacher advances levels without losing points and undo restores finish',()=>{
 let s=createDash({...defaultDashConfig(),checkpoints:10,courses:['forest','mountains','coast']});s=dashAction(s,{type:'zoom',zoom:99});assert.equal(s.zoom,1.8);assert.equal(dashAction(s,{type:'next-level'}),s);s=dashAction(s,{type:'start'});s=dashAction(s,{type:'move',amount:10});s=dashAction(s,{type:'move',amount:1});const score=s.scores[0];s=dashAction(s,{type:'next-level'});assert.equal(s.level,1);assert.equal(s.status,'ready');assert.equal(s.positions[0],0);assert.equal(s.scores[0],score);assert.equal(dashProjection(s,()=>undefined).course,'mountains');s=dashAction(s,{type:'undo'});assert.equal(s.level,0);assert.equal(s.status,'finished');assert.equal(parseDashConfig({...defaultDashConfig(),courses:undefined}).courses,undefined);
});

test('orbit retains the selected follow target independently of the rewarded racer',()=>{
 let s=createDash();s=dashAction(s,{type:'camera',camera:1});s=dashAction(s,{type:'orbit',yaw:1,pitch:.6});assert.equal(s.orbitTarget,1);
 s=dashAction(s,{type:'select',racer:0});assert.equal(s.orbitTarget,1);
 s=dashAction(s,{type:'camera',camera:0});s=dashAction(s,{type:'camera',camera:'orbit'});assert.equal(s.orbitTarget,0);
 for(const camera of ['side','both'] as const){s=dashAction(s,{type:'camera',camera});s=dashAction(s,{type:'orbit',yaw:2,pitch:.6});assert.equal(s.orbitTarget,'both');assert.equal(dashProjection(s,()=>undefined).orbitTarget,'both');}
});


