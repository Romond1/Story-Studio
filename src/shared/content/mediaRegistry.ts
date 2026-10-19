import type { AssetItem, MediaBin, MediaType, ProjectData } from '../types';
import type { LessonProject } from '../lesson/model';
import { collectMediaDependencies, type AssetUse, type DependencyReport } from './mediaDependencies';
import { canonicalMediaPath, compatibilityMediaUrl, type AssetResolution } from './mediaResolution';
export type ProjectDocument = {format:'scene'; data:LessonProject} | {format:'legacy'; data:ProjectData};
export type RegistryDiagnostic = {kind:'duplicate-id'|'ambiguous-path'|'unsafe-path'|'duplicate-bin'|'missing-bin'|'bin-cycle'; field:string; value:string};
export interface RegistryImage { id:string; label:string; mediaType:'image'; sourceAssetId?:string }
export interface MediaRegistryView {
  get(id:string): Readonly<AssetItem>|undefined;
  list(type?:MediaType): readonly Readonly<AssetItem>[];
  bins(): readonly Readonly<MediaBin>[];
  dependencies(): DependencyReport;
  usages(id:string): readonly AssetUse[];
  diagnostics(): readonly RegistryDiagnostic[];
  resolvePath(value:string, expected?:MediaType): AssetResolution;
  images(): readonly Readonly<RegistryImage>[];
  image(id:string): Readonly<RegistryImage>|undefined;
}
export function freezeSnapshot<T>(value:T): T {
  if (value && typeof value === 'object') { for (const item of Object.values(value)) freezeSnapshot(item); Object.freeze(value); }
  return value;
}
export function createMediaRegistry(document:ProjectDocument): MediaRegistryView {
  const assets = freezeSnapshot(document.data.assets.map(asset => ({...asset}))), bins = freezeSnapshot((document.data.mediaBins ?? []).map(bin => ({...bin})));
  const ids = new Map<string,Readonly<AssetItem>[]>(), paths = new Map<string,Readonly<AssetItem>[]>(), diagnostics:RegistryDiagnostic[] = [];
  assets.forEach((asset,i) => {
    ids.set(asset.id,[...(ids.get(asset.id) ?? []),asset]);
    const path = canonicalMediaPath(asset.relativePath);
    if (path) paths.set(path,[...(paths.get(path) ?? []),asset]); else diagnostics.push({kind:'unsafe-path',field:`/assets/${i}/relativePath`,value:asset.relativePath});
  });
  for (const [id,records] of ids) if (records.length > 1) diagnostics.push({kind:'duplicate-id',field:'/assets',value:id});
  for (const [path,records] of paths) if (records.length > 1) diagnostics.push({kind:'ambiguous-path',field:'/assets',value:path});
  const binIds = new Map<string,Readonly<MediaBin>[]>();
  bins.forEach(bin => binIds.set(bin.id,[...(binIds.get(bin.id) ?? []),bin]));
  for (const [id,records] of binIds) if (records.length > 1) diagnostics.push({kind:'duplicate-bin',field:'/mediaBins',value:id});
  bins.forEach((bin,i) => {
    const seen = new Set<string>(); let current:Readonly<MediaBin>|undefined = bin;
    while(current) {
      if(seen.has(current.id)) { diagnostics.push({kind:'bin-cycle',field:`/mediaBins/${i}/parentId`,value:current.id}); break; }
      seen.add(current.id); if(!current.parentId) break;
      const parent = binIds.get(current.parentId);
      if (!parent) { diagnostics.push({kind:'missing-bin',field:`/mediaBins/${i}/parentId`,value:current.parentId}); break; }
      current = parent.length === 1 ? parent[0] : undefined;
    }
  });
  assets.forEach((asset,i) => { if(asset.binId && !binIds.has(asset.binId)) diagnostics.push({kind:'missing-bin',field:`/assets/${i}/binId`,value:asset.binId}); });
  const get = (id:string) => ids.get(id)?.length === 1 ? ids.get(id)![0] : undefined;
  const imageIds = new Map<string,RegistryImage[]>();
  assets.filter(asset=>asset.mediaType==='image').forEach(asset=>imageIds.set(asset.id,[...(imageIds.get(asset.id)??[]),{id:asset.id,label:asset.originalName||asset.filename,mediaType:'image'}]));
  if(document.format==='scene' && document.data.format==='story-studio-episode') for(const derived of document.data.derivedImages) {
    if(ids.has(derived.id)||imageIds.has(derived.id))diagnostics.push({kind:'duplicate-id',field:'/derivedImages',value:derived.id});
    const existing=imageIds.get(derived.id)??[];
    imageIds.set(derived.id,[...existing,{id:derived.id,label:derived.label||derived.id,mediaType:'image',sourceAssetId:derived.sourceAssetId},...(ids.has(derived.id)&&!existing.length?[{id:derived.id,label:derived.id,mediaType:'image' as const}]:[])]);
  }
  const images = freezeSnapshot([...imageIds.values()].filter(records=>records.length===1).map(records=>records[0]));
  const image = (id:string) => imageIds.get(id)?.length===1 ? images.find(item=>item.id===id) : undefined;
  const resolvePath = (value:string, expected?:MediaType):AssetResolution => {
    const path = canonicalMediaPath(value); if(!path) return {ok:false,code:'unsafe-path'};
    const records = paths.get(path); if(!records) return {ok:false,code:'unregistered'};
    if(records.length !== 1 || !get(records[0].id)) return {ok:false,code:'ambiguous'};
    const asset = records[0]; if(expected && asset.mediaType !== expected) return {ok:false,code:'wrong-type',assetId:asset.id};
    return {ok:true,assetId:asset.id,mediaType:asset.mediaType,url:compatibilityMediaUrl(value)!};
  };
  const report = freezeSnapshot(collectMediaDependencies(document,{get:id=>imageIds.has(id)?image(id):get(id),has:id=>ids.has(id)||imageIds.has(id),resolvePath}));
  return Object.freeze({get,list:(type?:MediaType)=>type ? Object.freeze(assets.filter(asset=>asset.mediaType===type)) : assets,bins:()=>bins,dependencies:()=>report,usages:(id:string)=>Object.freeze(report.uses.filter(use=>use.assetId===id)),diagnostics:()=>freezeSnapshot(diagnostics),resolvePath,images:()=>images,image});
}
