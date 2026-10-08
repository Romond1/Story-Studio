import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as cards from './cardsV2';
test('Card V2 exposes a validated empty authored module', () => {
  assert.equal(typeof (cards as any).createCardsV2, 'function');
  assert.deepEqual((cards as any).validateCardsV2((cards as any).createCardsV2()), []);
});
let next = 0;
const id = () => `test-${++next}`;
function fixture() {
  const m = (cards as any).createCardsV2();
  const c = (cards as any).createCard('question-answer-explanation', id);
  m.cards[c.id] = c;
  const s = { id: id(), label: 'Set', tags: ['日本語'], entries: [{ id: id(), cardId: c.id }, { id: id(), cardId: c.id }] };
  m.sets[s.id] = s;
  const a = (cards as any).createActivity(m, s.id, id); m.activities[a.id] = a;
  const p = { id: id(), activityId: a.id, label: 'Placement' }; m.placements[p.id] = p;
  return { m, c, s, a, p };
}
test('faces retain identity through reorder, referenced deletion blocks, tags round-trip', () => {
  assert.equal(typeof (cards as any).createCard, 'function');
  const { m, c, a } = fixture(); const face = c.faces[0].id;
  c.faces.reverse(); assert.equal(a.instances[0].initialFaceId, face);
  assert.equal((cards as any).removeCardFace(m, c.id, face), false);
  assert.deepEqual((cards as any).validateCardsV2(JSON.parse(JSON.stringify(m))), []);
  c.faces = []; assert.ok((cards as any).validateCardsV2(m).length);
});
test('validation rejects unknown versions, unsafe style, references and nonfinite geometry', () => {
  assert.equal(typeof (cards as any).createCard, 'function');
  for (const change of [(m:any)=>m.version=99, (m:any)=>Object.values(m.cards).forEach((c:any)=>c.style.css='position:fixed'), (m:any)=>Object.values(m.activities).forEach((a:any)=>a.instances[0].geometry.x=NaN), (m:any)=>Object.values(m.activities).forEach((a:any)=>a.instances[0].initialFaceId='missing')]) {
    const {m}=fixture(); change(m); assert.ok((cards as any).validateCardsV2(m).length);
  }
});
test('duplication remaps definitions/faces/instances while set duplication retains references', () => {
  assert.equal(typeof (cards as any).duplicateCard, 'function');
  const {m,c,s,p}=fixture(); const copy=(cards as any).duplicateCard(m,c.id,id);
  assert.notEqual(copy.id,c.id); assert.notEqual(copy.faces[0].id,c.faces[0].id);
  assert.equal((cards as any).duplicateSet(m,s.id,id).entries[0].cardId,c.id);
  const dup=(cards as any).duplicatePlacement(m,p.id,id);
  assert.notEqual(dup.activity.instances[0].id,m.activities[p.activityId].instances[0].id);
});
test('authority guards stale tokens, separates faces/concealment, resets authored state and reuse', () => {
  assert.equal(typeof (cards as any).CardSessionAuthority, 'function');
  const {m,c,a,p}=fixture(); const token={sessionId:'s',projectId:'p',occurrenceId:'o',targetRevision:1,revision:0};
  const authority=new (cards as any).CardSessionAuthority(m,token);
  const run=(command:any)=>authority.dispatch(authority.snapshot()?.token ?? token,command);
  assert.equal(run({type:'StartActivity',placementId:p.id}),true);
  const instance=a.instances[0].id, other=a.instances[1].id;
  assert.equal(authority.dispatch(token,{type:'RevealAll'}),false);
  run({type:'SetFace',instanceId:instance,faceId:c.faces[2].id});
  assert.equal(authority.snapshot().instances[other].faceId,c.faces[0].id);
  run({type:'NextFace',instanceId:instance}); assert.equal(authority.snapshot().instances[instance].faceId,c.faces[2].id);
  run({type:'SetConcealment',instanceId:instance,concealed:true}); assert.equal(authority.snapshot().instances[instance].faceId,c.faces[2].id);
  run({type:'SelectCard',instanceId:instance}); run({type:'RevealSelected'});
  assert.equal(authority.snapshot().instances[instance].faceId,a.instances[0].revealFaceId);
  run({type:'ResetActivity'}); assert.equal(authority.snapshot().instances[instance].selected,false);
  assert.deepEqual(authority.snapshot().instances[instance].geometry,a.instances[0].geometry);
  const second=new (cards as any).CardSessionAuthority(m,{...token,occurrenceId:'second'});
  second.dispatch({...token,occurrenceId:'second'},{type:'StartActivity',placementId:p.id});
  run({type:'RevealAll'}); assert.equal(second.snapshot().instances[instance].faceId,c.faces[0].id);
});
test('malformed inherited references fail safely without throwing', () => {
  const {m,a}=fixture(); a.instances[0].cardId='toString';
  assert.doesNotThrow(() => (cards as any).validateCardsV2(m));
  assert.ok((cards as any).validateCardsV2(m).length);
});
test('activation rejects stale target and foreign tokens, and preserves occurrence state', () => {
  const {m,p,a,c}=fixture(); const token={sessionId:'s',projectId:'p',occurrenceId:'o',targetRevision:1,revision:0};
  const authority=new cards.CardSessionAuthority(m,token);
  authority.dispatch(token,{type:'StartActivity',placementId:p.id});
  authority.dispatch(authority.snapshot()!.token,{type:'SetFace',instanceId:a.instances[0].id,faceId:c.faces[2].id});
  const old=authority.snapshot()!.token;
  assert.equal(authority.activate({...old,targetRevision:2}),true);
  assert.equal(authority.dispatch(old,{type:'ResetActivity'}),false);
  assert.equal(authority.activate({...old,projectId:'foreign'}),false);
  assert.equal(authority.activate(old),false);
  assert.equal(authority.snapshot()!.instances[a.instances[0].id].faceId,c.faces[2].id);
});
test('one-face cards, unreferenced deletion, direct-face-all, cycling permissions and snapshots', () => {
  const single=cards.createCard('text',id), m=cards.createCardsV2(); m.cards[single.id]=single;
  assert.deepEqual(cards.validateCardsV2(m),[]); assert.equal(cards.removeCardFace(m,single.id,single.faces[0].id),false);
  const f=fixture(); const extra={...f.c.faces[0],id:id()}; f.c.faces.push(extra);
  assert.equal(cards.removeCardFace(f.m,f.c.id,extra.id),true);
  const token={sessionId:'s',projectId:'p',occurrenceId:'o',targetRevision:1,revision:0}, authority=new cards.CardSessionAuthority(f.m,token);
  authority.dispatch(token,{type:'StartActivity',placementId:f.p.id});
  authority.dispatch(authority.snapshot()!.token,{type:'SetFaceAll',faceId:f.c.faces[2].id});
  assert.ok(Object.values(authority.snapshot()!.instances).every(s=>s.faceId===f.c.faces[2].id));
  authority.snapshot()!.instances[f.a.instances[0].id].geometry.x=999;
  assert.equal(authority.snapshot()!.instances[f.a.instances[0].id].geometry.x,40);
  f.a.allowCycling=false; f.a.allowDirectFace=false;
  const disabled=new cards.CardSessionAuthority(f.m,token); disabled.dispatch(token,{type:'StartActivity',placementId:f.p.id});
  assert.equal(disabled.dispatch(disabled.snapshot()!.token,{type:'NextFace',instanceId:f.a.instances[0].id}),false);
  assert.equal(disabled.dispatch(disabled.snapshot()!.token,{type:'SetFaceAll',faceId:f.c.faces[2].id}),false);
});
test('reset face restores authored face without changing concealment', () => {
  const {m,p,a,c}=fixture(), token={sessionId:'s',projectId:'p',occurrenceId:'o',targetRevision:1,revision:0};
  const authority=new cards.CardSessionAuthority(m,token);
  assert.equal(typeof (authority as any).currentToken,'function');
  authority.dispatch((authority as any).currentToken(),{type:'StartActivity',placementId:p.id});
  authority.dispatch((authority as any).currentToken(),{type:'SetFace',instanceId:a.instances[0].id,faceId:c.faces[2].id});
  authority.dispatch((authority as any).currentToken(),{type:'SetConcealment',instanceId:a.instances[0].id,concealed:true});
  authority.dispatch((authority as any).currentToken(),{type:'ResetFace',instanceId:a.instances[0].id} as any);
  assert.equal(authority.snapshot()!.instances[a.instances[0].id].faceId,c.faces[0].id);
  assert.equal(authority.snapshot()!.instances[a.instances[0].id].concealed,true);
});
test('another instance shares definition but receives its own identity and geometry', () => {
  assert.equal(typeof (cards as any).duplicateInstance,'function');
  const {a}=fixture(), source=a.instances[0], copy=(cards as any).duplicateInstance(source,id);
  assert.notEqual(copy.id,source.id); assert.equal(copy.cardId,source.cardId);
  copy.geometry.x=500; assert.equal(source.geometry.x,40);
});
test('activity layout respects shape defaults and packs without overlap', () => {
  const m=cards.createCardsV2(), shapes=['portrait','square','strip','pill','landscape'] as const;
  const entries=shapes.map(shape=>{const c=cards.createCard('text',id); c.style.shape=shape; m.cards[c.id]=c; return {id:id(),cardId:c.id};});
  const set={id:id(),label:'Mixed shapes',tags:[],entries}; m.sets[set.id]=set;
  const a=cards.createActivity(m,set.id,id); m.activities[a.id]=a;
  assert.ok(a.instances[0].geometry.height>a.instances[0].geometry.width);
  assert.equal(a.instances[1].geometry.height,a.instances[1].geometry.width);
  assert.ok(a.instances[2].geometry.width/a.instances[2].geometry.height>=3);
  assert.ok(a.instances[3].geometry.width/a.instances[3].geometry.height>=2);
  assert.deepEqual(cards.validateCardsV2(m),[]);
  for(let i=0;i<a.instances.length;i++) for(let j=i+1;j<a.instances.length;j++) {
    const x=a.instances[i].geometry,y=a.instances[j].geometry;
    assert.ok(x.x+x.width<=y.x || y.x+y.width<=x.x || x.y+x.height<=y.y || y.y+y.height<=x.y);
  }
  const usual=fixture(); usual.s.entries=Array.from({length:8},()=>({id:id(),cardId:usual.c.id}));
  assert.deepEqual(cards.createActivity(usual.m,usual.s.id,id).frame,{width:1280,height:720});
});
test('duplicating maximum-length labels remains valid', () => {
  const {m,c,s,p,a}=fixture(); c.label=s.label=p.label=a.label='x'.repeat(200);
  const cc=cards.duplicateCard(m,c.id,id),ss=cards.duplicateSet(m,s.id,id),pp=cards.duplicatePlacement(m,p.id,id);
  m.cards[cc.id]=cc;m.sets[ss.id]=ss;m.activities[pp.activity.id]=pp.activity;m.placements[pp.placement.id]=pp.placement;
  assert.deepEqual(cards.validateCardsV2(m),[]);
  for(const label of [cc.label,ss.label,pp.activity.label,pp.placement.label]) {assert.ok(label.length<=200);assert.ok(label.endsWith(' copy'));}
});
test('reconcile retains live faces and flags while applying authored geometry and membership',()=>{
 const {m,c,a,p}=fixture(),authority=new cards.CardSessionAuthority(m,{sessionId:'s',projectId:'p',occurrenceId:'o',targetRevision:1,revision:0});authority.dispatch(authority.currentToken(),{type:'StartActivity',placementId:p.id});const retained=a.instances[0],removed=a.instances[1];
 authority.dispatch(authority.currentToken(),{type:'SetFace',instanceId:retained.id,faceId:c.faces[2].id});authority.dispatch(authority.currentToken(),{type:'SelectCard',instanceId:retained.id});authority.dispatch(authority.currentToken(),{type:'SetConcealment',instanceId:retained.id,concealed:true});const stale=authority.currentToken();
 const updated:cards.CardsV2Module=JSON.parse(JSON.stringify(m)),activity=updated.activities[a.id],fresh=cards.duplicateInstance(retained,id);fresh.initiallyConcealed=true;activity.instances=[fresh,{...retained,geometry:{x:30,y:30,width:200,height:200},initiallyConcealed:false}];
 authority.reconcile(updated);const snapshot=authority.snapshot()!;assert.deepEqual(snapshot.order,[fresh.id,retained.id]);assert.equal(snapshot.instances[removed.id],undefined);assert.equal(snapshot.instances[retained.id].faceId,c.faces[2].id);assert.equal(snapshot.instances[retained.id].selected,true);assert.equal(snapshot.instances[retained.id].concealed,true);assert.equal(snapshot.instances[retained.id].locked,false);assert.equal(snapshot.instances[retained.id].highlighted,false);assert.deepEqual(snapshot.instances[retained.id].geometry,{x:30,y:30,width:200,height:200});assert.equal(snapshot.instances[fresh.id].faceId,fresh.initialFaceId);assert.equal(snapshot.instances[fresh.id].concealed,true);assert.equal(snapshot.instances[fresh.id].selected,false);assert.equal(snapshot.token.revision,stale.revision+1);assert.equal(authority.dispatch(stale,{type:'ResetActivity'}),false);
 updated.cards[c.id].faces[2].text='external mutation';activity.instances[1].geometry.x=99;assert.equal(authority.snapshot()!.instances[retained.id].geometry.x,30);
});
test('reconcile applies authored layer reordering while preserving live face and flags',()=>{
 const {m,c,a,p}=fixture(),authority=new cards.CardSessionAuthority(m,{sessionId:'s',projectId:'p',occurrenceId:'o',targetRevision:1,revision:0});authority.dispatch(authority.currentToken(),{type:'StartActivity',placementId:p.id});const instance=a.instances[0];authority.dispatch(authority.currentToken(),{type:'SetFace',instanceId:instance.id,faceId:c.faces[2].id});authority.dispatch(authority.currentToken(),{type:'SelectCard',instanceId:instance.id});authority.dispatch(authority.currentToken(),{type:'SetConcealment',instanceId:instance.id,concealed:true});const before=authority.snapshot()!.instances[instance.id],updated:cards.CardsV2Module=JSON.parse(JSON.stringify(m));updated.activities[a.id].instances.reverse();authority.reconcile(updated);assert.deepEqual(authority.snapshot()!.order,[a.instances[1].id,instance.id]);assert.deepEqual(authority.snapshot()!.instances[instance.id],before);
});
test('reconcile falls back for removed faces, drops missing placements, and rejects invalid modules atomically',()=>{
 const {m,c,a,p}=fixture(),authority=new cards.CardSessionAuthority(m,{sessionId:'s',projectId:'p',occurrenceId:'o',targetRevision:1,revision:0});authority.dispatch(authority.currentToken(),{type:'StartActivity',placementId:p.id});const instance=a.instances[0];authority.dispatch(authority.currentToken(),{type:'SetFace',instanceId:instance.id,faceId:c.faces[2].id});
 const updated:cards.CardsV2Module=JSON.parse(JSON.stringify(m));updated.cards[c.id].faces.pop();authority.reconcile(updated);assert.equal(authority.snapshot()!.instances[instance.id].faceId,instance.initialFaceId);
 const snapshot=authority.snapshot(),token=authority.currentToken(),invalid:cards.CardsV2Module=JSON.parse(JSON.stringify(updated));invalid.activities[a.id].instances[0].initialFaceId='missing';assert.throws(()=>authority.reconcile(invalid));assert.deepEqual(authority.snapshot(),snapshot);assert.deepEqual(authority.currentToken(),token);assert.equal(authority.dispatch(token,{type:'SetFace',instanceId:instance.id,faceId:c.faces[2].id}),false);
 delete updated.placements[p.id];authority.reconcile(updated);assert.equal(authority.snapshot(),null);assert.equal(authority.currentToken().revision,token.revision+1);assert.equal(authority.dispatch(token,{type:'RevealAll'}),false);
});
test('reconcile reinitializes a changed placement activity and updates inactive authority modules',()=>{
 const {m,c,a,p}=fixture(),authority=new cards.CardSessionAuthority(m,{sessionId:'s',projectId:'p',occurrenceId:'o',targetRevision:1,revision:0});authority.dispatch(authority.currentToken(),{type:'StartActivity',placementId:p.id});authority.dispatch(authority.currentToken(),{type:'SetFace',instanceId:a.instances[0].id,faceId:c.faces[2].id});const updated:cards.CardsV2Module=JSON.parse(JSON.stringify(m)),copy=cards.duplicatePlacement(updated,p.id,id);updated.activities[copy.activity.id]=copy.activity;updated.placements[p.id].activityId=copy.activity.id;authority.reconcile(updated);assert.equal(authority.snapshot()!.activityId,copy.activity.id);assert.equal(authority.snapshot()!.instances[copy.activity.instances[0].id].faceId,copy.activity.instances[0].initialFaceId);
 const idle=new cards.CardSessionAuthority(cards.createCardsV2(),{sessionId:'s',projectId:'p',occurrenceId:'o',targetRevision:1,revision:0}),old=idle.currentToken();idle.reconcile(updated);assert.equal(idle.snapshot(),null);assert.equal(idle.dispatch(old,{type:'StartActivity',placementId:p.id}),false);assert.equal(idle.dispatch(idle.currentToken(),{type:'StartActivity',placementId:p.id}),true);
});
