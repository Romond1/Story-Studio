import { assertCardsV2, createCardsV2, createCard, duplicateCard, duplicateInstance, duplicatePlacement } from './cardsV2';
import type { CardActivity, CardDefinition, CardGeometry, CardInstance, CardsV2Module } from './cardsV2';
import type { PresentationTarget } from './presentationSession';
import type { ProjectData, SequenceItem, Slide, Section } from './types';

export type CardHost = { kind: 'slide' | 'section' | 'booster'; id: string; tab?: 'activation' | 'language' | 'games' };
export type CardHostResult = { data: ProjectData; placementId: string; instanceId: string };
type HostContent = (Slide | Section | SequenceItem) & { cardPlacementId?: string };
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function content(data: ProjectData, host: CardHost): HostContent {
  const found = host.kind === 'slide' ? data.slides.find(s => s.id === host.id) : host.kind === 'section' ? data.sections.find(s => s.id === host.id) : host.tab ? data.boostPack?.[`${host.tab}Sequence`].find(s => s.id === host.id) : undefined;
  if (!found) throw new Error('Unknown card host');
  if (host.kind === 'booster' && 'type' in found && found.type !== 'promptCard' && found.type !== 'cardActivityRef') throw new Error('Unsupported booster card host');
  return found;
}
export function hostPlacementId(data: ProjectData, host: CardHost): string | undefined {
  const target = content(data, host);
  return 'type' in target && target.type === 'cardActivityRef' ? target.placementId : target.cardPlacementId;
}
export function resolveCardHost(target: PresentationTarget, tab?: CardHost['tab']): CardHost | null {
  if (target.kind === 'invalid') return null;
  if (target.item?.type === 'slideRef') return target.slide ? { kind: 'slide', id: target.slide.id } : null;
  if (target.item?.type === 'breakRef') return target.section ? { kind: 'section', id: target.section.id } : null;
  if (target.item) {
    if (target.item.type !== 'promptCard' && target.item.type !== 'cardActivityRef') return null;
    if (!tab) { try { let occurrence = JSON.parse(target.occurrenceId); if (typeof occurrence[0] === 'string' && occurrence[0].startsWith('[')) occurrence = JSON.parse(occurrence[0]); if (occurrence[0] === 'boost' && ['activation', 'language', 'games'].includes(occurrence[1])) tab = occurrence[1]; } catch { /* A missing tab cannot identify an occurrence. */ } }
    return tab ? { kind: 'booster', id: target.item.id, tab } : null;
  }
  if (target.kind === 'slide' && target.slide) return { kind: 'slide', id: target.slide.id };
  if (target.kind === 'break' && target.section) return { kind: 'section', id: target.section.id };
  return null;
}
function allocator(data: ProjectData, id: () => string, additional?: unknown): () => string {
  const used = new Set<string>();
  const collect = (v: unknown): void => { if (!v || typeof v !== 'object') return; if ('id' in v && typeof v.id === 'string') used.add(v.id); Object.values(v).forEach(collect); };
  collect(data);
  collect(additional);
  return () => { const next = id(); if (!/^[\w.-]+$/.test(next) || next.length > 160 || Object.getOwnPropertyNames(Object.prototype).includes(next) || next === 'prototype' || used.has(next)) throw new Error('Invalid or duplicate authored ID'); used.add(next); return next; };
}
function activityFor(data: ProjectData, host: CardHost): { module: CardsV2Module; activity: CardActivity; placementId: string } {
  const placementId = hostPlacementId(data, host), module = data.cardsV2;
  if (!module || !placementId || !module.placements[placementId] || !module.activities[module.placements[placementId].activityId]) throw new Error('Unknown host card activity');
  return { module, activity: module.activities[module.placements[placementId].activityId], placementId };
}
function instanceFor(activity: CardActivity, instanceId: string): CardInstance { const instance = activity.instances.find(i => i.id === instanceId); if (!instance) throw new Error('Unknown host card instance'); return instance; }
function clampGeometry(geometry: CardGeometry, frame: CardActivity['frame']): CardGeometry {
  if (!Object.values(geometry).every(Number.isFinite)) throw new Error('Invalid card geometry');
  const width = Math.max(40, Math.min(frame.width, geometry.width)), height = Math.max(40, Math.min(frame.height, geometry.height));
  return { x: Math.max(0, Math.min(frame.width - width, geometry.x)), y: Math.max(0, Math.min(frame.height - height, geometry.y)), width, height };
}
function independentInstance(module: CardsV2Module, instance: CardInstance, id: () => string): void {
  const source = module.cards[instance.cardId]; if (!source) throw new Error('Unknown source card');
  const card = duplicateCard(module, source.id, id); module.cards[card.id] = card;
  const faceId = (old: string): string => { const index = source.faces.findIndex(f => f.id === old); if (index < 0) throw new Error('Unknown source face'); return card.faces[index].id; };
  instance.cardId = card.id; instance.initialFaceId = faceId(instance.initialFaceId); if (instance.revealFaceId) instance.revealFaceId = faceId(instance.revealFaceId);
}
function finish(data: ProjectData): ProjectData { if (data.cardsV2) assertCardsV2(data.cardsV2); return data; }
function ensureHostActivity(next:ProjectData,host:CardHost,fresh:()=>string): {module:CardsV2Module;activity:CardActivity;placementId:string} {
  const target=content(next,host),module=next.cardsV2??(next.cardsV2=createCardsV2());
  if(hostPlacementId(next,host))return activityFor(next,host);
  const activity:CardActivity={id:fresh(),type:'recall-reveal',label:'Cards',frame:{width:1280,height:720},instances:[],allowCycling:true,allowDirectFace:true,circularCycling:true};
  module.activities[activity.id]=activity;const placementId=fresh();module.placements[placementId]={id:placementId,activityId:activity.id,label:'Cards'};
  if('type' in target && target.type==='cardActivityRef')target.placementId=placementId;else target.cardPlacementId=placementId;
  return{module,activity,placementId};
}

export function addCardToHost(data: ProjectData, host: CardHost, id: () => string, sourceCardId?: string, independent = false): CardHostResult {
  content(data, host); const next = clone(data), fresh = allocator(data, id), {module,activity,placementId}=ensureHostActivity(next,host,fresh);
  let card = sourceCardId ? module.cards[sourceCardId] : createCard('text', fresh);
  if (!card) throw new Error('Unknown source card');
  if (!sourceCardId) { card.label = 'Question'; card.faces[0].label = 'Question'; card.faces[0].text = 'Type your question'; card.style = {...card.style, padding:20, borderWidth:1}; }
  else if (independent) card = duplicateCard(module, sourceCardId, fresh);
  module.cards[card.id] = card;
  const instance: CardInstance = { id: fresh(), cardId: card.id, initialFaceId: card.faces[0].id, revealFaceId: card.faces[1]?.id ?? card.faces[0].id, initiallyConcealed: false, geometry: clampGeometry({ x:80 + activity.instances.length * 24, y:80, width:300, height:210 }, activity.frame) };
  activity.instances.push(instance); return { data: finish(next), placementId, instanceId: instance.id };
}
export function pasteHostCard(data:ProjectData,host:CardHost,clipboard:{card:CardDefinition;instance:CardInstance},id:()=>string):CardHostResult {
  if(clipboard.instance.cardId!==clipboard.card.id)throw new Error('Clipboard card reference does not match');
  content(data,host);const next=clone(data),fresh=allocator(data,id,clipboard),{module,activity,placementId}=ensureHostActivity(next,host,fresh),sourceModule=createCardsV2();sourceModule.cards[clipboard.card.id]=clone(clipboard.card);
  const instance=duplicateInstance(clipboard.instance,fresh);independentInstance(sourceModule,instance,fresh);module.cards[instance.cardId]=sourceModule.cards[instance.cardId];
  instance.geometry=clampGeometry({...instance.geometry,x:instance.geometry.x+24,y:instance.geometry.y+24},activity.frame);activity.instances.push(instance);return{data:finish(next),placementId,instanceId:instance.id};
}
export function duplicateHostCard(data: ProjectData, host: CardHost, instanceId: string, id: () => string, independent = true): CardHostResult {
  const next = clone(data), fresh = allocator(data, id), {module,activity,placementId} = activityFor(next, host), source = instanceFor(activity, instanceId), instance = duplicateInstance(source, fresh);
  if (independent) independentInstance(module, instance, fresh);
  instance.geometry = clampGeometry({...instance.geometry, x:instance.geometry.x + 24, y:instance.geometry.y + 24}, activity.frame); activity.instances.push(instance);
  return {data:finish(next),placementId,instanceId:instance.id};
}
export function makeHostCardIndependent(data: ProjectData, host: CardHost, instanceId: string, id: () => string): ProjectData {
  const next=clone(data),{module,activity}=activityFor(next,host);independentInstance(module,instanceFor(activity,instanceId),allocator(data,id));return finish(next);
}
export function updateHostGeometry(data: ProjectData, host: CardHost, instanceId: string, geometry: CardGeometry): ProjectData {
  const next=clone(data),{activity}=activityFor(next,host);instanceFor(activity,instanceId).geometry=clampGeometry(geometry,activity.frame);return finish(next);
}
export function removeHostCard(data: ProjectData, host: CardHost, instanceId: string): ProjectData {
  const next=clone(data),{activity}=activityFor(next,host);instanceFor(activity,instanceId);activity.instances=activity.instances.filter(i=>i.id!==instanceId);return finish(next);
}
export function independentBoosterSlide(data: ProjectData, tab: NonNullable<CardHost['tab']>, itemId: string, id: () => string): {data:ProjectData;slideId:string} {
  const next=clone(data),fresh=allocator(data,id),item=next.boostPack?.[`${tab}Sequence`].find(i=>i.id===itemId);if(item?.type!=='slideRef')throw new Error('Booster does not reference a slide');
  const source=next.slides.find(s=>s.id===item.slideId);if(!source)throw new Error('Unknown booster slide');const slide=clone(source) as Slide & {cardPlacementId?:string};slide.id=fresh();slide.name=`${(slide.name??'Slide').slice(0,190)} copy`;
  for(const key of ['overlays','audioCues','markerStrokes','bCardInstances','storyReferences'] as const) { const entries=slide[key];if(entries) for(const entry of entries) entry.id=fresh(); }
  for(const clip of [...(slide.dialogue??[]),...(slide.sfx??[]),...(slide.bgm?[slide.bgm]:[])])if('id' in clip && typeof clip.id==='string')clip.id=fresh();
  if(slide.cardPlacementId){const module=next.cardsV2;if(!module)throw new Error('Unknown host card activity');const copied=duplicatePlacement(module,slide.cardPlacementId,fresh);for(const instance of copied.activity.instances)independentInstance(module,instance,fresh);delete copied.activity.setId;module.activities[copied.activity.id]=copied.activity;module.placements[copied.placement.id]=copied.placement;slide.cardPlacementId=copied.placement.id;}
  let insert=next.slides.findIndex(s=>s.id===source.id)+1;while(insert<next.slides.length && next.slides[insert].sectionId===source.sectionId)insert++;next.slides.splice(insert,0,slide);item.independentCopyOf=source.id;item.slideId=slide.id;return{data:finish(next),slideId:slide.id};
}
function boosterSequence(data:ProjectData,tab:NonNullable<CardHost['tab']>,itemId:string): {sequence:SequenceItem[];index:number} {
  const sequence=data.boostPack?.[`${tab}Sequence`],index=sequence?.findIndex(i=>i.id===itemId)??-1;if(!sequence||index<0)throw new Error('Unknown booster sequence item');return{sequence,index};
}
export function duplicateBoosterItem(data:ProjectData,tab:NonNullable<CardHost['tab']>,itemId:string,id:()=>string):{data:ProjectData;itemId:string} {
  const next=clone(data),fresh=allocator(data,id),{sequence,index}=boosterSequence(next,tab,itemId),item=clone(sequence[index]) as SequenceItem & {cardPlacementId?:string};item.id=fresh();
  if(item.bCardInstances)for(const instance of item.bCardInstances)instance.id=fresh();
  const placementId=item.type==='cardActivityRef'?item.placementId:item.cardPlacementId;
  if(placementId){const module=next.cardsV2;if(!module?.placements[placementId]||!module.activities[module.placements[placementId].activityId])throw new Error('Unknown host card activity');const copied=duplicatePlacement(module,placementId,fresh);module.activities[copied.activity.id]=copied.activity;module.placements[copied.placement.id]=copied.placement;if(item.type==='cardActivityRef')item.placementId=copied.placement.id;else item.cardPlacementId=copied.placement.id;}
  sequence.splice(index+1,0,item);return{data:finish(next),itemId:item.id};
}
export function moveBoosterItem(data:ProjectData,tab:NonNullable<CardHost['tab']>,itemId:string,direction:-1|1):ProjectData {
  const {sequence,index}=boosterSequence(data,tab,itemId),destination=index+direction;if(destination<0||destination>=sequence.length)return data;
  const next=clone(data),items=next.boostPack![`${tab}Sequence`];[items[index],items[destination]]=[items[destination],items[index]];return finish(next);
}
export function removeBoosterItem(data:ProjectData,tab:NonNullable<CardHost['tab']>,itemId:string):ProjectData {
  const next=clone(data),{sequence,index}=boosterSequence(next,tab,itemId);sequence.splice(index,1);return finish(next);
}
