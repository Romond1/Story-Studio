import {parseAdventureDefinition,collectDefinitionAssets} from '../definitions/validation';
import {parseEpisodeActivity} from '../modules/validation';
import {collectModuleAssets} from '../modules/media';
import type { EpisodeProject } from './model';
import { clone } from '../lesson/model';
import { migrateSections } from '../lesson/sections';
import { validateSceneDocumentBody } from '../lesson/validation';
import { validateImageTransform, validateImagePresentation } from '../content/imageTransforms';
const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown,max=500):v is string=>typeof v==='string'&&v.length<=max;
const id=(v:unknown):v is string=>text(v,200)&&!!v&&!['__proto__','prototype','constructor',...Object.getOwnPropertyNames(Object.prototype)].includes(v);
const check=(v:unknown,field:string)=>{if(!v)throw new Error(`Invalid episode ${field}`);};
const list=(v:unknown):v is any[]=>Array.isArray(v)&&v.length<=2000;
const fields=(v:Record<string,any>,keys:string[],name:string)=>check(Object.keys(v).every(key=>keys.includes(key)),`${name} field`);
/** Episode bodies reject extension/runtime payloads; scene-v1 compatibility remains unchanged. */
function validateAuthoredFields(p:Record<string,any>) {
 for(const asset of p.assets)fields(asset,['id','binId','relativePath','filename','originalName','referenceCode','referenceDescription','canonicalLabel','referenceContext','referenceContextId','referenceOrdinal','mediaType','sizeBytes','importedAt'],'asset');
 for(const bin of p.mediaBins)fields(bin,['id','name','parentId'],'bin');
 for(const section of p.sections??[])fields(section,['id','name','sequence'],'section');
 fields(p.sequences,['story','activation'],'sequences');
 for(const sequence of ['story','activation'])for(const entry of p.sequences[sequence])fields(entry,['id','sceneId','section','sectionId','kind'],'entry');
 for(const scene of Object.values(p.scenes) as any[]){
  fields(scene,['id','title','frame','background','objects','drawings','audio','transition','viewport','notes'],'scene');
  fields(scene.frame,['width','height'],'frame');fields(scene.background,['color','assetId'],'background');fields(scene.transition,['kind','durationMs'],'transition');fields(scene.viewport,['zoom','pan'],'viewport');fields(scene.viewport.pan,['x','y'],'pan');
  for(const object of scene.objects){fields(object,['id','box','visible','kind',...(object.kind==='card'?['cardId','initialFaceId','initiallyConcealed','interaction']:object.kind==='image'?['assetId']:['text','fontSize','color','bubbleDefId','align'])],'scene object');fields(object.box,['x','y','width','height'],'geometry');}
  for(const audio of scene.audio)fields(audio,['id','assetId','volume','loop','autoplay'],'audio');
  for(const stroke of scene.drawings){fields(stroke,['id','color','size','opacity','rainbow','points'],'drawing');for(const point of stroke.points)fields(point,['x','y','t','h'],'point');}
 }
 // Card and Set nested fields are already allowlisted by assertCardsV2 in body validation.
}
export function parseEpisodeProject(value:unknown):EpisodeProject {
 check(object(value)&&value.format==='story-studio-episode'&&value.version===1,'format/version');const p=value as Record<string,any>;
 fields(p,['format','version','id','title','createdAt','updatedAt','assets','mediaBins','scenes','sequences','sections','cards','library','cardSets','adventure','requiredCapabilities','derivedImages','catalog','activities','occurrences','adventureDefinition'],'document');
 check(object(p.adventure)&&id(p.adventure.id)&&text(p.adventure.version,200)&&!!p.adventure.version,'adventure');fields(p.adventure,['id','version'],'adventure');
 check(list(p.requiredCapabilities)&&p.requiredCapabilities.every((v:unknown)=>['derived-images-v1','manual-catalog-v1','bundled-modules-v1','adventure-definitions-v1'].includes(v as string))&&new Set(p.requiredCapabilities).size===p.requiredCapabilities.length,'required capabilities');
 check(list(p.assets)&&list(p.derivedImages),'media');const physical=new Map<string,any>();
 for(const asset of p.assets){check(object(asset)&&id(asset.id)&&!physical.has(asset.id),'physical identity');physical.set(asset.id,asset);}
 const derived=new Set<string>();
 for(const image of p.derivedImages){
  check(object(image),'derived image');fields(image,['id','kind','label','sourceAssetId','transform','presentation'],'derived image');
  check(id(image.id)&&!physical.has(image.id)&&!derived.has(image.id)&&image.kind==='derived-image'&&(image.label===undefined||text(image.label)),'derived identity');
  check(physical.get(image.sourceAssetId)?.mediaType==='image','derived physical image source');validateImageTransform(image.transform);validateImagePresentation(image.presentation);derived.add(image.id);
 }
 check(!derived.size||p.requiredCapabilities.includes('derived-images-v1'),'derived capability');
 const hasAsset=(value:unknown,kind?:string)=>typeof value==='string'&&(derived.has(value)?!kind||kind==='image':physical.has(value)&&(!kind||physical.get(value).mediaType===kind));
 if(p.adventureDefinition!==undefined){
  const definition=parseAdventureDefinition(p.adventureDefinition);check(p.requiredCapabilities.includes('adventure-definitions-v1'),'adventure definition capability');check(definition.id===p.adventure.id&&definition.version===p.adventure.version,'adventure definition identity');
  for(const ref of collectDefinitionAssets(definition))check(hasAsset(ref.assetId,'image'),`adventure definition media ${ref.field}`);
 }
 const activityIds=new Set<string>();
 if(p.activities!==undefined||p.occurrences!==undefined){
  check(p.requiredCapabilities.includes('bundled-modules-v1')&&list(p.activities)&&list(p.occurrences),'module capability/collections');
  for(const raw of p.activities){const activity=parseEpisodeActivity(raw);check(!activityIds.has(activity.id),'duplicate activity');activityIds.add(activity.id);
   check(Object.values(activity.rewardBindings??{}).every(rewardId=>p.adventureDefinition?.rewards.some((reward:any)=>reward.id===rewardId)),'activity reward binding definition');
   for(const ref of collectModuleAssets(activity))if(ref.assetId)check(hasAsset(ref.assetId,ref.mediaType),`activity media ${ref.field}`);
   if(activity.moduleType==='activation-cards')check(activity.config.sceneIds.every(sceneId=>!!p.scenes[sceneId]),'activation scene reference');
  }
  const occurrences=new Set<string>();for(const occurrence of p.occurrences){check(object(occurrence),'occurrence');fields(occurrence,['id','activityId','section'],'occurrence');check(id(occurrence.id)&&!occurrences.has(occurrence.id)&&activityIds.has(occurrence.activityId)&&['activation','challenge','mastery'].includes(occurrence.section),'occurrence identity/reference');occurrences.add(occurrence.id);
   const activity=p.activities.find((a:any)=>a.id===occurrence.activityId);check(activity.moduleType==='activation-cards'?occurrence.section==='activation':occurrence.section!=='activation','occurrence module section');
  }
 }
 validateSceneDocumentBody(p,hasAsset);
 validateAuthoredFields(p);
 check(object(p.catalog)&&list(p.catalog.entities)&&(p.catalog.collections===undefined||list(p.catalog.collections)),'catalog');fields(p.catalog,['entities','collections'],'catalog');
 const entities=new Set<string>();
 for(const entity of p.catalog.entities){
  check(object(entity),'entity');fields(entity,['id','adventureId','kind','name','tags','assetIds','tagAnnotations'],'entity');
  check(id(entity.id)&&!entities.has(entity.id)&&entity.adventureId===p.adventure.id,'entity adventure/identity');entities.add(entity.id);
  check(['character','location','item','other'].includes(entity.kind)&&text(entity.name)&&entity.name.trim()&&list(entity.tags)&&entity.tags.every((tag:unknown)=>text(tag,100))&&new Set(entity.tags).size===entity.tags.length,'entity metadata');
  check(list(entity.assetIds)&&entity.assetIds.every((asset:unknown)=>hasAsset(asset))&&new Set(entity.assetIds).size===entity.assetIds.length,'entity media links');
  if(entity.tagAnnotations!==undefined){check(list(entity.tagAnnotations),'tag annotations');for(const annotation of entity.tagAnnotations){check(object(annotation),'tag annotation');fields(annotation,['tag','source','author'],'tag annotation');check(entity.tags.includes(annotation.tag)&&['manual','imported'].includes(annotation.source)&&(annotation.author===undefined||text(annotation.author,200)),'tag provenance');}}
 }
 const collections=new Set<string>();for(const collection of p.catalog.collections??[]){
  check(object(collection),'collection');fields(collection,['id','adventureId','name','entityIds'],'collection');check(id(collection.id)&&!collections.has(collection.id)&&collection.adventureId===p.adventure.id&&text(collection.name)&&collection.name.trim(),'collection identity');collections.add(collection.id);
  check(list(collection.entityIds)&&collection.entityIds.every((entity:unknown)=>typeof entity==='string'&&entities.has(entity))&&new Set(collection.entityIds).size===collection.entityIds.length,'collection entity references');
 }
 check((!entities.size&&!collections.size)||p.requiredCapabilities.includes('manual-catalog-v1'),'catalog capability');
 return migrateSections(clone(value as EpisodeProject));
}
