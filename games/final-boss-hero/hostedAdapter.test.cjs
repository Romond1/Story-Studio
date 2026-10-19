const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const root=path.resolve(__dirname,'../..');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021,esModuleInterop:true},fileName:file}).outputText,file);
const adapter=(()=>{try{return require('./src/hosted/hostedConfig.ts');}catch(error){if(error.code==='MODULE_NOT_FOUND')return {};throw error;}})();
const {useBattleStore}=require('./src/store/battleStore.ts');
const {DEFAULT_ENCOUNTER,SAMPLE_CARD_LIBRARY}=require('./src/data/sampleData.ts');
const initial=useBattleStore.getState();
test('Core catalogue updates refresh previews without proposing runtime state',()=>{
 const {connectHostedBoss}=require('./src/hosted/hostedSession.ts');const proposals=[];
 const session=connectHostedBoss({store:useBattleStore,config:config(),mediaMap:{picture:'media://scoped/old'},port:{context:{participantIds:[]},proposeConfig:async p=>{proposals.push(p);return {accepted:true,configRevision:1};},emit(){}}});
 useBattleStore.setState({scores:{hero:20,villain:10}});
 session.updateMedia([{id:'picture',name:'Picture',mediaType:'image',url:'media://scoped/new'}]);
 assert.equal(useBattleStore.getState().activeEncounter.hero.portrait,'media://scoped/new');assert.deepEqual(useBattleStore.getState().scores,{hero:20,villain:10});assert.equal(proposals.length,0);session.dispose();
});
test('a draft captured before import can reuse revoked preview URLs without losing stable identities',()=>{
 const projection=adapter.initializeHostedBoss(useBattleStore,config(),{'asset:picture':'media://scoped/old'});
 const oldCard={...useBattleStore.getState().cardLibrary[0]};projection.updateMedia({'asset:picture':'media://scoped/new'});
 useBattleStore.getState().updateCard(oldCard.id,{...oldCard,title:'Draft after import'});
 assert.equal(projection.proposal().cardLibrary[0].image,'asset:picture');
});
test('standalone import stages unresolved references and excludes battle runtime',()=>{
 const {stageStandaloneBoss,recoverStandaloneBoss}=require('./src/hosted/standaloneImport.ts');
 const data=config();data.encounter.hero.portrait='C:/teacher/portrait.png';
 const staged=stageStandaloneBoss({metadata:{schema:'final-boss-hero-project',version:1},project:data,session:{scores:{hero:999}}},[{id:'picture',name:'Picture',mediaType:'image',url:'media://scoped/p'}]);
 assert.equal(staged.missing.length,1);assert.equal(staged.missing[0].original,'C:/teacher/portrait.png');
 const recovered=recoverStandaloneBoss(staged.config,{'encounter/hero/portrait':'asset:picture'});
 assert.equal(recovered.encounter.hero.portrait,'asset:picture');assert.equal('session' in recovered,false);
 assert.equal(data.encounter.hero.portrait,'C:/teacher/portrait.png');
});
test('creating hosted cards, heroes and cutscenes never persists remote sample placeholders',async()=>{
 const {connectHostedBoss}=require('./src/hosted/hostedSession.ts');const proposals=[];
 const session=connectHostedBoss({store:useBattleStore,config:config(),mediaMap:{picture:'media://scoped/picture'},port:{context:{participantIds:[]},proposeConfig:async p=>{proposals.push(p);return {accepted:true,configRevision:1};},emit(){}}});
 useBattleStore.getState().setUIMode('edit');
 const hero=useBattleStore.getState().createIntroHeroOption(),card=useBattleStore.getState().createCard(),cutscene=useBattleStore.getState().createCutscene();await session.save();
 const last=proposals.at(-1);assert.equal(last.encounter.introSetup.heroes.find(x=>x.id===hero).portrait,'');assert.equal(last.cardLibrary.find(x=>x.id===card).image,'');assert.equal(last.encounter.cutscenes.find(x=>x.id===cutscene).mediaSource,'');session.dispose();
});
test('rejected drafts survive mode switch attempts and can be retried',async()=>{
 const {connectHostedBoss}=require('./src/hosted/hostedSession.ts');let accepted=false;
 const session=connectHostedBoss({store:useBattleStore,config:config(),mediaMap:{picture:'media://scoped/picture'},port:{context:{participantIds:[]},proposeConfig:async()=>({accepted,configRevision:1,reason:'disk unavailable'}),emit(){}}});
 useBattleStore.getState().setUIMode('edit');useBattleStore.getState().setEncounterName('Retain this draft');await session.save();
 useBattleStore.getState().setUIMode('play');assert.equal(useBattleStore.getState().uiMode,'edit');assert.equal(session.exportConfig().encounter.name,'Retain this draft');
 accepted=true;await session.save();useBattleStore.getState().setUIMode('play');useBattleStore.getState().setUIMode('edit');assert.equal(session.exportConfig().encounter.name,'Retain this draft');session.dispose();
});
test('refreshed catalogue resolves newly assigned stable IDs without persisting preview URLs',()=>{
 const projection=adapter.initializeHostedBoss(useBattleStore,config(),{picture:'media://scoped/old'});
 assert.equal(typeof projection.updateMedia,'function');
 projection.updateMedia({'asset:picture':'media://scoped/new','asset:imported':'media://scoped/imported'});
 useBattleStore.getState().updateHero({portrait:'asset:imported'});
 const candidate=projection.proposal();projection.preview(candidate);
 assert.equal(useBattleStore.getState().activeEncounter.hero.portrait,'media://scoped/imported');
 assert.equal(projection.proposal().encounter.hero.portrait,'asset:imported');
});
test.afterEach(()=>useBattleStore.setState(initial,true));
const config=()=>{
  const data=JSON.parse(JSON.stringify({encounter:DEFAULT_ENCOUNTER,cardLibrary:SAMPLE_CARD_LIBRARY}));
  const replace=value=>{for(const key of Object.keys(value)){if(typeof value[key]==='string'&&value[key].startsWith('https:'))value[key]='asset:picture';else if(value[key]&&typeof value[key]==='object')replace(value[key]);}};replace(data);return data;
};
test('strict hosted boot uses exact authored config and resets runtime without standalone fallback',()=>{
  assert.equal(typeof adapter.initializeHostedBoss,'function');
  const authored=config();authored.encounter.name='Exact native encounter';authored.cardLibrary[0].miniGames=[];
  useBattleStore.setState({scores:{hero:999,villain:333},battleProgress:{phase:'battleComplete',currentRound:9,completedMiniGames:['boardDash']}});
  const session=adapter.initializeHostedBoss(useBattleStore,authored,{'picture':'media://scoped/lease/grant'},'https://local/game/');
  assert.equal(useBattleStore.getState().activeEncounter.name,'Exact native encounter');assert.deepEqual(useBattleStore.getState().scores,{hero:0,villain:0});
  assert.deepEqual(useBattleStore.getState().cardLibrary[0].miniGames,[]);assert.equal(useBattleStore.getState().cardLibrary[0].image,'media://scoped/lease/grant');
  assert.deepEqual(session.authored(),authored);assert.equal(JSON.stringify(session.authored()).includes('session'),false);
});
test('invalid/empty hosted library and private runtime fields reject without replacing active state',()=>{
  assert.equal(typeof adapter.initializeHostedBoss,'function');
  const before=useBattleStore.getState();
  for(const value of [{...config(),cardLibrary:[]},{...config(),session:{scores:{hero:1}}},{...config(),inventory:[] }])assert.throws(()=>adapter.initializeHostedBoss(useBattleStore,value,{picture:'media://scoped/lease/grant'},'https://local/game/'));
  assert.equal(useBattleStore.getState(),before);
});
test('typed projection and reverse proposal preserve asset identities and never save grant URLs',()=>{
  assert.equal(typeof adapter.initializeHostedBoss,'function');
  const authored=config();authored.encounter.hero.portrait='asset:hero';
  const session=adapter.initializeHostedBoss(useBattleStore,authored,{picture:'media://scoped/same/grant',hero:'media://scoped/same/grant'},'https://local/game/');
  useBattleStore.getState().setEncounterName('Changed');
  const candidate=session.proposal();assert.equal(candidate.encounter.name,'Changed');assert.equal(candidate.encounter.hero.portrait,'asset:hero');assert.equal(candidate.cardLibrary[0].image,'asset:picture');
  assert.equal(JSON.stringify(candidate).includes('media://'),false);
  useBattleStore.getState().updateCard(candidate.cardLibrary[0].id,{image:'https://unregistered.example/image.png'});
  assert.throws(()=>session.proposal(),/media|reference|config/i);
});
test('all five game assignments and authored settings remain intact in strict hosted initialization',()=>{
  assert.equal(typeof adapter.initializeHostedBoss,'function');
  const authored=config();const session=adapter.initializeHostedBoss(useBattleStore,authored,{picture:'media://scoped/lease/grant'},'https://local/game/');
  assert.deepEqual(useBattleStore.getState().activeEncounter.enabledMiniGames,['memoryReveal','matchPairs','laneBattle','openBox','boardDash']);
  assert.deepEqual(session.proposal(),authored);
});
test('hosted edits wait for Core ack, serialize only authored content and block local device persistence',async()=>{
  let connect;try{connect=require('./src/hosted/hostedSession.ts').connectHostedBoss;}catch{}
  assert.equal(typeof connect,'function');
  const proposals=[];let acknowledge;
  const session=connect({store:useBattleStore,config:config(),mediaMap:{picture:'media://scoped/lease/grant'},port:{context:{participantIds:['captured-student']},proposeConfig:proposal=>{proposals.push(proposal);return new Promise(resolve=>{acknowledge=resolve;});},emit(){}}});
  useBattleStore.getState().setUIMode('edit');useBattleStore.getState().setEncounterName('Core pending');
  await Promise.resolve();assert.equal(session.status(),'Saving changes to episode…');assert.equal(proposals.length,1);assert.deepEqual(Object.keys(proposals[0]).sort(),['cardLibrary','encounter']);
  assert.equal(JSON.stringify(proposals[0]).includes('media://'),false);assert.throws(()=>useBattleStore.getState().exportProjectFile(),/episode/i);
  acknowledge({accepted:true,configRevision:2});await session.save();assert.equal(session.status(),'Changes accepted by episode');
  session.dispose();
});
test('hosted gameplay reports captured participant results without turning scores or power-up use into config edits',()=>{
  let connect;try{connect=require('./src/hosted/hostedSession.ts').connectHostedBoss;}catch{}
  assert.equal(typeof connect,'function');
  const proposals=[],events=[];const authored=config();authored.encounter.battleSettings.villainStartHp=1;
  const session=connect({store:useBattleStore,config:authored,mediaMap:{picture:'media://scoped/lease/grant'},port:{context:{participantIds:['captured-student']},proposeConfig:p=>{proposals.push(p);return Promise.resolve({accepted:true,configRevision:1});},emit:(type,payload)=>events.push({type,payload})}});
  useBattleStore.getState().completeMiniGame({miniGameId:'memoryReveal',winner:'hero',heroScore:20,villainScore:0,scoreDifference:20});
  assert.equal(proposals.length,0);assert.equal(events[0].type,'score-reported');assert.deepEqual(events[0].payload.scores,[{participantId:'captured-student',score:20}]);
  assert.ok(events.some(e=>e.type==='activity-completed'));session.dispose();
});
test('Save waits for the latest queued edit, and new registry selections roundtrip after preview',async()=>{
  const {connectHostedBoss}=require('./src/hosted/hostedSession.ts');const acks=[],proposals=[];
  const session=connectHostedBoss({store:useBattleStore,config:config(),mediaMap:{picture:'media://scoped/one/grant',new:'media://scoped/two/grant'},port:{context:{participantIds:[]},proposeConfig:p=>{proposals.push(p);return new Promise(resolve=>acks.push(resolve));},emit(){}}});
  useBattleStore.getState().setUIMode('edit');useBattleStore.getState().setEncounterName('First');useBattleStore.getState().updateHero({portrait:'asset:new'});
  assert.equal(useBattleStore.getState().activeEncounter.hero.portrait,'media://scoped/two/grant');
  let saved=false;const saving=session.save().then(()=>{saved=true;});acks[0]({accepted:true,configRevision:1});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(saved,false,'Latest edit must be accepted before Save settles');assert.equal(proposals.length,2);assert.equal(proposals[1].encounter.hero.portrait,'asset:new');
  acks[1]({accepted:true,configRevision:2});await saving;assert.equal(saved,true);session.dispose();
});
test('an older accepted proposal cannot mask a newer invalid media edit',async()=>{
  const {connectHostedBoss}=require('./src/hosted/hostedSession.ts');let ack;
  const session=connectHostedBoss({store:useBattleStore,config:config(),mediaMap:{picture:'media://scoped/lease/grant'},port:{context:{participantIds:[]},proposeConfig:()=>new Promise(resolve=>{ack=resolve;}),emit(){}}});
  useBattleStore.getState().setUIMode('edit');useBattleStore.getState().setEncounterName('Awaiting ack');useBattleStore.getState().updateHero({portrait:'https://not-an-episode-asset.example/image.png'});
  assert.match(session.status(),/^Episode save failed:/);ack({accepted:true,configRevision:1});await new Promise(resolve=>setImmediate(resolve));
  assert.match(session.status(),/^Episode save failed:/);assert.throws(()=>session.exportConfig());session.dispose();
});

test('deleting a Board Dash card removes its encounter references and remains saveable',()=>{
 const projection=adapter.initializeHostedBoss(useBattleStore,config(),{picture:'media://scoped/picture'});
 const id=useBattleStore.getState().cardLibrary[0].id;
 useBattleStore.setState({activeEncounter:{...useBattleStore.getState().activeEncounter,boardDashCardIds:[id]}});
 useBattleStore.getState().deleteCard(id);
 assert.equal(useBattleStore.getState().activeEncounter.boardDashCardIds.includes(id),false);
 assert.doesNotThrow(()=>projection.proposal());
});

test('saving an existing draft repairs only dangling Board Dash references without losing edits',()=>{
 const projection=adapter.initializeHostedBoss(useBattleStore,config(),{picture:'media://scoped/picture'});
 const state=useBattleStore.getState(),kept=state.cardLibrary[1].id,removed=state.cardLibrary[0].id;
 useBattleStore.setState({cardLibrary:state.cardLibrary.slice(1),activeEncounter:{...state.activeEncounter,name:'Keep my edited encounter',selectedCardIds:state.activeEncounter.selectedCardIds.filter(id=>id!==removed),boardDashCardIds:[removed,kept]}});
 const saved=projection.proposal();assert.deepEqual(saved.encounter.boardDashCardIds,[kept]);assert.equal(saved.encounter.name,'Keep my edited encounter');assert.equal(saved.cardLibrary.length,state.cardLibrary.length-1);assert.equal(saved.encounter.hero.portrait,'asset:picture');
});
