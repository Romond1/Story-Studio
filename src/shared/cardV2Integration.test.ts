import test from 'node:test';
import assert from 'node:assert/strict';
import { createCardsV2, createCard, createActivity, CardSessionAuthority } from './cardsV2';
import { buildCardV2RenderPlan } from './cardV2Render';
import { createPresentationSession, reducePresentationSession, resolvePresentationTarget, navigatePresentation } from './presentationSession';
import { parsePresentSnapshot } from './presentationSnapshot';
import { fitLogicalFrame } from './staticScene';
import type { ProjectData } from './types';
function fixture() {
  let n=0; const id=()=>`v2-${++n}`; const module=createCardsV2();
  const card=createCard('question-answer-explanation',id); card.faces[0].text='Question';card.faces[1].text='Private answer';module.cards[card.id]=card;
  const set={id:id(),label:'Set',tags:['episode-7'],entries:[{id:id(),cardId:card.id}]};module.sets[set.id]=set;
  const activity=createActivity(module,set.id,id);module.activities[activity.id]=activity;
  const placement={id:id(),label:'Activity',activityId:activity.id};module.placements[placement.id]=placement;
  const data:ProjectData={version:4,createdAt:'',updatedAt:'',slides:[{id:'slide',assetId:'image',sectionId:'section',transition:'none'}],assets:[],sections:[{id:'section',name:'Story'}],cardsV2:module,boostPack:{activationSequence:[{id:'first',type:'cardActivityRef',engine:'card-v2',placementId:placement.id},{id:'second',type:'cardActivityRef',engine:'card-v2',placementId:placement.id}],languageSequence:[],gamesSequence:[]}};
  return {module,card,activity,placement,data};
}
test('explicit V2 booster targets preserve checkpoint, occurrence identity and authored frame',()=>{
 const {data,placement}=fixture();let session=reducePresentationSession(createPresentationSession('session'),{type:'project',projectId:'project',slideId:'slide',sectionId:'section'});
 session=reducePresentationSession(session,{type:'select',changes:{mode:'boost',boostTab:'activation',boostItemId:'first'}});
 const first=resolvePresentationTarget(data,session);assert.equal(first.kind,'cards-v2');assert.equal(first.contentId,placement.id);assert.equal(first.capabilities.canDraw,false);
 session=navigatePresentation(data,session,1);const second=resolvePresentationTarget(data,session);assert.equal(second.kind,'cards-v2');assert.notEqual(first.occurrenceId,second.occurrenceId);
 session=reducePresentationSession(session,{type:'select',changes:{mode:'story'}});assert.equal(session.storySlideId,'slide');assert.equal(session.sectionId,'section');
 delete data.cardsV2!.placements[placement.id];session=reducePresentationSession(session,{type:'select',changes:{mode:'boost'}});assert.equal(resolvePresentationTarget(data,session).kind,'invalid');
});
test('V2 Present relay preserves resolved geometry/face and omits inactive face content on recovery',()=>{
 const {module,card,activity,placement}=fixture();const token={sessionId:'session',projectId:'project',occurrenceId:'first',targetRevision:1,revision:0};const core=new CardSessionAuthority(module,token);
 core.dispatch(token,{type:'StartActivity',placementId:placement.id});
 const plan=buildCardV2RenderPlan(module,activity,core.snapshot()!);const raw={sessionId:'session',revision:1,target:{kind:'cards-v2',occurrenceId:'first',plan,teacherNote:'secret'}};
 const projected=parsePresentSnapshot(raw);assert.ok(projected);assert.equal(JSON.stringify(projected).includes('Private answer'),false);assert.equal(JSON.stringify(projected).includes('teacherNote'),false);
 assert.equal(projected.target.kind,'cards-v2');if(projected.target.kind!=='cards-v2')throw Error();assert.deepEqual(projected.target.plan,plan);
 const fit=fitLogicalFrame(plan.frame,{width:700,height:500});assert.equal(fit.scale,Math.min(700/plan.frame.width,500/plan.frame.height));
 core.dispatch(core.currentToken(),{type:'SetFace',instanceId:activity.instances[0].id,faceId:card.faces[1].id});
 const updated=parsePresentSnapshot({...raw,revision:2,target:{...raw.target,plan:buildCardV2RenderPlan(module,activity,core.snapshot()!)}});assert.ok(updated);assert.equal(updated.target.kind === 'cards-v2' && updated.target.plan.cards[0].texts.flatMap(t=>t.lines.map(l=>l.text)).join('').includes('Private answer'),true);assert.equal(updated.transition,undefined);
 assert.deepEqual(parsePresentSnapshot(JSON.parse(JSON.stringify(updated))),updated);
});



