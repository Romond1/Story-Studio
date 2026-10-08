import test from 'node:test';
import assert from 'node:assert/strict';
import { addCardToHost, duplicateHostCard, makeHostCardIndependent, updateHostGeometry, removeHostCard, independentBoosterSlide, hostPlacementId, resolveCardHost, duplicateBoosterItem, moveBoosterItem, removeBoosterItem, pasteHostCard } from './cardAuthoring';
import { validateCardsV2, CardSessionAuthority } from './cardsV2';
import { ProjectHistory } from './projectHistory';
import { createPresentationSession, reducePresentationSession, resolvePresentationTarget } from './presentationSession';
import type { ProjectData, AudioClip } from './types';
const ids = () => { let n=0; return () => `author-${++n}`; };
const fixture = (): ProjectData => ({version:4,createdAt:'',updatedAt:'',slides:[{id:'slide',sectionId:'section',assetId:'image',transition:'none',overlays:[{id:'overlay',type:'textBox',text:'Hello',x:0,y:0,width:50,height:50}]}],sections:[{id:'section',name:'Story'}],assets:[],boostPack:{activationSequence:[{id:'ref',type:'slideRef',slideId:'slide'},{id:'prompt',type:'promptCard',body:'Prompt'}],languageSequence:[],gamesSequence:[]}});
const host = {kind:'slide' as const,id:'slide'};
test('adding to an empty card activity booster attaches the resolved placement',()=>{
 const data=fixture();data.boostPack!.activationSequence.push({id:'canvas',type:'cardActivityRef',engine:'card-v2',placementId:''});const added=addCardToHost(data,{kind:'booster',tab:'activation',id:'canvas'},ids());
 assert.equal(hostPlacementId(added.data,{kind:'booster',tab:'activation',id:'canvas'}),added.placementId);let s=reducePresentationSession(createPresentationSession('s'),{type:'project',projectId:'p',slideId:'slide',sectionId:'section'});s=reducePresentationSession(s,{type:'select',changes:{mode:'boost',boostItemId:'canvas'}});assert.equal(resolvePresentationTarget(added.data,s).kind,'cards-v2');
});
test('clipboard paste preserves authored settings after source deletion with independent faces',()=>{
 const id=ids(),a=addCardToHost(fixture(),host,id),module=a.data.cardsV2!,activity=module.activities[module.placements[a.placementId].activityId],instance=activity.instances[0],card=module.cards[instance.cardId];card.faces.push({id:id(),label:'Answer',layout:'text',text:'Original answer'});instance.initialFaceId=card.faces[1].id;instance.revealFaceId=card.faces[0].id;instance.initiallyConcealed=true;instance.role='question';instance.style={preset:'dark',padding:12};instance.geometry={x:1200,y:650,width:80,height:70};
 const clipboard=JSON.parse(JSON.stringify({card,instance})),clipboardBefore=JSON.stringify(clipboard),data=fixture(),before=JSON.stringify(data);const pasted=pasteHostCard(data,host,clipboard,id),m=pasted.data.cardsV2!,own=m.activities[m.placements[pasted.placementId].activityId].instances[0],ownCard=m.cards[own.cardId];
 assert.equal(JSON.stringify(data),before);assert.equal(JSON.stringify(clipboard),clipboardBefore);assert.notEqual(own.cardId,card.id);assert.notEqual(own.id,instance.id);assert.equal(own.initialFaceId,ownCard.faces[1].id);assert.equal(own.revealFaceId,ownCard.faces[0].id);assert.equal(ownCard.faces[1].text,'Original answer');assert.equal(own.initiallyConcealed,true);assert.equal(own.role,'question');assert.deepEqual(own.style,instance.style);assert.deepEqual(own.geometry,{x:1200,y:650,width:80,height:70});assert.deepEqual(validateCardsV2(m),[]);
 assert.throws(()=>pasteHostCard(data,host,{...clipboard,instance:{...clipboard.instance,initialFaceId:'missing'}},id));assert.equal(JSON.stringify(data),before);
 const second=pasteHostCard(pasted.data,host,clipboard,id);assert.equal(second.placementId,pasted.placementId);assert.equal(second.data.cardsV2!.activities[m.placements[pasted.placementId].activityId].instances.length,2);
});
test('adding cards is immutable, atomic, and needs no set',()=>{
 const data=fixture(),before=JSON.stringify(data),id=ids();const added=addCardToHost(data,host,id);
 assert.equal(JSON.stringify(data),before);assert.equal(hostPlacementId(added.data,host),added.placementId);
 const module=added.data.cardsV2!,activity=module.activities[module.placements[added.placementId].activityId],card=module.cards[activity.instances[0].cardId];
 assert.deepEqual(activity.frame,{width:1280,height:720});assert.equal(activity.setId,undefined);assert.equal(activity.label,'Cards');assert.equal(activity.circularCycling,true);assert.equal(card.faces[0].label,'Question');assert.equal(card.faces[0].text,'Type your question');assert.deepEqual(validateCardsV2(module),[]);
 const second=addCardToHost(added.data,host,id);assert.equal(second.placementId,added.placementId);assert.equal(Object.keys(second.data.cardsV2!.activities).length,1);
 assert.throws(()=>addCardToHost(data,{kind:'slide',id:'missing'},id));assert.equal(JSON.stringify(data),before);
 assert.throws(()=>addCardToHost(data,host,()=> 'bad id'));assert.equal(JSON.stringify(data),before);
});
test('booster sequence copies get fresh activities, preserve links, and reorder or remove immutably',()=>{
 const id=ids(),data=fixture(),prompt={kind:'booster' as const,tab:'activation' as const,id:'prompt'},a=addCardToHost(data,prompt,id),before=JSON.stringify(a.data),copy=duplicateBoosterItem(a.data,'activation','prompt',id);
 assert.equal(JSON.stringify(a.data),before);const placement=hostPlacementId(copy.data,{...prompt,id:copy.itemId})!;assert.notEqual(placement,a.placementId);const m=copy.data.cardsV2!,source=m.activities[m.placements[a.placementId].activityId].instances[0],own=m.activities[m.placements[placement].activityId].instances[0];assert.notEqual(own.id,source.id);assert.equal(own.cardId,source.cardId);
 const moved=moveBoosterItem(copy.data,'activation',copy.itemId,-1);assert.deepEqual(moved.boostPack!.activationSequence.map(i=>i.id),['ref',copy.itemId,'prompt']);const removed=removeBoosterItem(moved,'activation',copy.itemId);assert.deepEqual(removed.boostPack!.activationSequence.map(i=>i.id),['ref','prompt']);assert.throws(()=>removeBoosterItem(removed,'activation','missing'));assert.deepEqual(validateCardsV2(removed.cardsV2),[]);
 let s=reducePresentationSession(createPresentationSession('s'),{type:'project',projectId:'p',slideId:'slide',sectionId:'section'});removed.boostPack!.activationSequence.push({id:'game',type:'miniGame',gameType:'placeholder'});s=reducePresentationSession(s,{type:'select',changes:{mode:'boost',boostItemId:'game'}});assert.equal(resolveCardHost(resolvePresentationTarget(removed,s)),null);
});
test('duplicates distinguish shared definitions and independent face references',()=>{
 const id=ids(),a=addCardToHost(fixture(),host,id);const activity=a.data.cardsV2!.activities[a.data.cardsV2!.placements[a.placementId].activityId];
 const original=activity.instances[0],card=a.data.cardsV2!.cards[original.cardId];card.faces.push({id:id(),label:'Answer',layout:'text',text:'Answer'});original.revealFaceId=card.faces[1].id;
 const linked=duplicateHostCard(a.data,host,a.instanceId,id,false);const independent=duplicateHostCard(linked.data,host,a.instanceId,id,true);const module=independent.data.cardsV2!,instances=module.activities[module.placements[a.placementId].activityId].instances;
 assert.equal(instances[1].cardId,original.cardId);assert.notEqual(instances[2].cardId,original.cardId);assert.equal(instances[2].revealFaceId,module.cards[instances[2].cardId].faces[1].id);assert.notEqual(instances[2].initialFaceId,original.initialFaceId);
 const own=makeHostCardIndependent(independent.data,host,linked.instanceId,id);assert.notEqual(own.cardsV2!.activities[activity.id].instances[1].cardId,original.cardId);
 const core=new CardSessionAuthority(module,{sessionId:'s',projectId:'p',occurrenceId:'o',targetRevision:1,revision:0});core.dispatch(core.currentToken(),{type:'StartActivity',placementId:a.placementId});core.dispatch(core.currentToken(),{type:'NextFace',instanceId:original.id});assert.equal(core.snapshot()!.instances[instances[1].id].faceId,original.initialFaceId);
});
test('geometry clamps and removals persist as one undoable document revision',()=>{
 const id=ids(),data=fixture(),h=new ProjectHistory<ProjectData>();h.reset(data);const a=addCardToHost(data,host,id);h.record(a.data);h.markSaved(a.data);
 const changed=updateHostGeometry(a.data,host,a.instanceId,{x:99999,y:-1,width:2000,height:1});const instance=changed.cardsV2!.activities[changed.cardsV2!.placements[a.placementId].activityId].instances[0];assert.deepEqual(instance.geometry,{x:0,y:0,width:1280,height:40});assert.deepEqual(validateCardsV2(JSON.parse(JSON.stringify(changed.cardsV2))),[]);
 h.record(changed);assert.equal(h.undo(),a.data);assert.equal(h.isDirty,false);const removed=removeHostCard(changed,host,a.instanceId);assert.equal(removed.cardsV2!.activities[removed.cardsV2!.placements[a.placementId].activityId].instances.length,0);assert.throws(()=>updateHostGeometry(a.data,host,a.instanceId,{x:NaN,y:0,width:100,height:100}));
});
test('booster hosts resolve source slides and prompts and independent slides own all card content',()=>{
 const id=ids(),data=fixture(),a=addCardToHost(data,host,id);let s=reducePresentationSession(createPresentationSession('s'),{type:'project',projectId:'p',slideId:'slide',sectionId:'section'});s=reducePresentationSession(s,{type:'select',changes:{mode:'boost',boostItemId:'ref'}});assert.deepEqual(resolveCardHost(resolvePresentationTarget(a.data,s)),host);
 s=reducePresentationSession(s,{type:'select',changes:{boostItemId:'prompt'}});const promptHost=resolveCardHost(resolvePresentationTarget(a.data,s));assert.deepEqual(promptHost,{kind:'booster',tab:'activation',id:'prompt'});const p=addCardToHost(a.data,promptHost!,id);assert.ok(hostPlacementId(p.data,promptHost!));
 const before=JSON.stringify(p.data),copy=independentBoosterSlide(p.data,'activation','ref',id);assert.equal(JSON.stringify(p.data),before);const slide=copy.data.slides.find(slide=>slide.id===copy.slideId)!;assert.notEqual(slide.overlays![0].id,data.slides[0].overlays![0].id);const ownPlacement=hostPlacementId(copy.data,{kind:'slide',id:slide.id})!;assert.notEqual(ownPlacement,a.placementId);const m=copy.data.cardsV2!,original=m.activities[m.placements[a.placementId].activityId].instances[0],own=m.activities[m.placements[ownPlacement].activityId].instances[0];assert.notEqual(own.cardId,original.cardId);assert.notEqual(own.initialFaceId,original.initialFaceId);assert.deepEqual(validateCardsV2(m),[]);assert.equal((copy.data.boostPack!.activationSequence[0] as {slideId:string}).slideId,slide.id);
});
test('existing explicit activities retain canonical frames and invalid references fail atomically',()=>{
 const id=ids(),first=addCardToHost(fixture(),host,id),module=first.data.cardsV2!,activity=module.activities[module.placements[first.placementId].activityId];activity.frame={width:640,height:480};
 first.data.boostPack!.gamesSequence.push({id:'activity-ref',type:'cardActivityRef',engine:'card-v2',placementId:first.placementId});const booster={kind:'booster' as const,tab:'games' as const,id:'activity-ref'},before=JSON.stringify(first.data);
 const added=addCardToHost(first.data,booster,id,activity.instances[0].cardId);assert.equal(added.placementId,first.placementId);assert.deepEqual(added.data.cardsV2!.activities[activity.id].frame,{width:640,height:480});assert.equal(Object.keys(added.data.cardsV2!.cards).length,1);assert.equal(JSON.stringify(first.data),before);
 assert.throws(()=>duplicateHostCard(first.data,host,'missing',id));assert.throws(()=>addCardToHost(first.data,host,()=>activity.id));assert.equal(JSON.stringify(first.data),before);
 const invalid=JSON.parse(before) as ProjectData;delete invalid.cardsV2!.placements[first.placementId];const invalidBefore=JSON.stringify(invalid);assert.throws(()=>addCardToHost(invalid,booster,id));assert.equal(JSON.stringify(invalid),invalidBefore);
 const section={kind:'section' as const,id:'section'},attached=addCardToHost(first.data,section,id);assert.ok(hostPlacementId(attached.data,section));assert.deepEqual(validateCardsV2(attached.data.cardsV2),[]);
});
test('independent booster slides clone audio clip identities while retaining asset references',()=>{
 const data=fixture(),clip=(id:string,url:string):AudioClip&{id:string}=>({id,url,volume:0.5});data.slides[0].dialogue=[clip('dialogue','voice')];data.slides[0].sfx=[clip('sound','effect')];data.slides[0].bgm=clip('music','music-asset');const before=JSON.stringify(data),copied=independentBoosterSlide(data,'activation','ref',ids()),slide=copied.data.slides.find(s=>s.id===copied.slideId)!;const dialogue=slide.dialogue![0] as AudioClip&{id:string},sfx=slide.sfx![0] as AudioClip&{id:string},bgm=slide.bgm! as AudioClip&{id:string};
 assert.equal(JSON.stringify(data),before);assert.notEqual(dialogue.id,'dialogue');assert.notEqual(sfx.id,'sound');assert.notEqual(bgm.id,'music');assert.equal(dialogue.url,'voice');assert.equal(sfx.url,'effect');assert.equal(bgm.url,'music-asset');assert.equal(new Set([dialogue.id,sfx.id,bgm.id]).size,3);
});
