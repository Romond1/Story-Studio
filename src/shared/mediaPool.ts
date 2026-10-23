import type { AssetItem, ImportResult, MediaBin, ProjectData, Slide } from './types';
import { decorateImportedAssetsForContext } from './mediaReferences';
import { validateMediaImport } from './mediaImportValidation';
import { createMediaRegistry } from './content/mediaRegistry';
import { replaceLegacyMedia } from './mediaImportReplacement';

/** Stable presentation order; never mutates authored asset/bin order. */
export function groupMediaByType<T extends { mediaType: string }>(assets: readonly T[]): T[] {
  const rank = (type: string) => type === 'image' ? 0 : type === 'video' ? 1 : 2;
  return [...assets].sort((a,b) => rank(a.mediaType)-rank(b.mediaType));
}

export function renameMediaBin<T extends { mediaBins?: MediaBin[] }>(project: T, id: string, name: string): T {
  const title=name.trim().slice(0,200),bin=project.mediaBins?.find(item=>item.id===id);
  if(!id||!bin||!title||bin.name===title)return project;
  return {...project,mediaBins:project.mediaBins!.map(item=>item.id===id?{...item,name:title}:item)};
}

/** Remove only the container; its contents remain available in its parent. */
export function removeMediaBin<T extends { assets: AssetItem[]; mediaBins?: MediaBin[] }>(project: T, id: string): T {
  const bin=project.mediaBins?.find(item=>item.id===id);
  if(!id||!bin)return project;
  return {...project,assets:project.assets.map(asset=>asset.binId===id?{...asset,binId:bin.parentId}:asset),
    mediaBins:project.mediaBins!.filter(item=>item.id!==id).map(item=>item.parentId===id?{...item,parentId:bin.parentId}:item)};
}

/** Pool membership is independent of registered media used by authored content. */
export function removeFromMediaPool<T extends { assets: AssetItem[] }>(project: T, assetId: string): T {
  const asset = project.assets.find(item => item.id === assetId);
  if (!asset || asset.hiddenFromMediaPool) return project;
  return { ...project, assets: project.assets.map(item => item.id === assetId ? { ...item, hiddenFromMediaPool: true } : item) };
}

export function createMediaSlide(asset:AssetItem,sectionId:string,id:()=>string):Slide {
  return {id:id(),assetId:asset.id,sectionId,transition:'fade',...(asset.mediaType==='video'?{videoAudio:{enabled:true,volume:1}}:{})};
}
export function registerPoolImport(data:ProjectData,result:ImportResult,binId?:string):ProjectData {
  validateMediaImport(data, result);
  if (!result.importedAssets.length && !result.replacedAssets?.length && !result.importedBins?.length) return data;
  if (binId && !data.mediaBins?.some(bin => bin.id === binId)) throw new Error('The destination bin no longer exists. Copied files have been preserved.');
  const assets=decorateImportedAssetsForContext(data,result.importedAssets,null).map(a=>({...a,...(!a.binId&&binId?{binId}:{})}));
  const bins=(result.importedBins??[]).map(bin=>({...bin,...(!bin.parentId&&binId?{parentId:binId}:{})}));
  const replaced=replaceLegacyMedia(data,result.replacedAssets);
  return {...replaced,assets:[...replaced.assets,...assets],...(bins.length?{mediaBins:[...(data.mediaBins??[]),...bins]}:{})};
}
/** A slot is before a stable slide ID, or the end of a section. */
export function insertPoolAssets(data:ProjectData,assetIds:string[],sectionId:string,beforeId:string|null,id:()=>string):ProjectData {
  const section=data.sections.find(s=>s.id===sectionId);if(!section)throw Error('The destination section no longer exists.');
  const assets=assetIds.map(assetId=>data.assets.find(a=>a.id===assetId));
  if(assets.some(a=>!a||a.mediaType==='audio'))throw Error('Use the Audio inspector to attach audio. Only images and videos create lesson slides.');
  const added=assets.map(a=>createMediaSlide(a!,sectionId,id));
  let at=data.slides.length;
  if(beforeId){at=data.slides.findIndex(s=>s.id===beforeId&&s.sectionId===sectionId);if(at<0)throw Error('The insertion target no longer exists.');}
  else {const last=data.slides.map(s=>s.sectionId).lastIndexOf(sectionId);if(last>=0)at=last+1;}
  return {...data,slides:[...data.slides.slice(0,at),...added,...data.slides.slice(at)],sections:section.type==='break'?data.sections.map(s=>s.id===sectionId?{...s,breakMedia:[...(s.breakMedia??[]),...added.map(slide=>({id:id(),slideId:slide.id,fit:'contain' as const}))]}:s):data.sections};
}
/** Count authored references, including non-slide image/audio usages. */
export function mediaUsage(data:ProjectData,assetId:string):number {
  return createMediaRegistry({ format: 'legacy', data }).usages(assetId).length;
}
