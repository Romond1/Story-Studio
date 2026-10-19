import type {EpisodeProject} from '../episode/model';
import type {AdventureDefinition} from '../definitions/model';
import {parseAdventureDefinition} from '../definitions/validation';
import {parseEpisodeProject} from '../episode/validation';
import {createMediaRegistry} from '../content/mediaRegistry';
import {arr,fail,identity,num,one,shape,unique} from '../modules/checks';
import {ADVENTURE_DEFINITION_PATH,BOSS_BUILTIN_REFS,PACKAGE_CAPABILITIES,PACKAGE_LIMITS,type PackageManifestV1} from './model';
/** Canonical package paths deliberately exclude URL encodings and platform aliases. */
export function isSafePackagePath(value:unknown):value is string {
 return typeof value==='string'&&value.length>0&&value.length<=500&&!/[\\%\x00-\x1f\x7f:?#<>"|*]/.test(value)&&!value.startsWith('/')&&value.split('/').every(segment=>!!segment&&segment!=='.'&&segment!=='..'&&!/[. ]$/.test(segment)&&! /^(con|conin\$|conout\$|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(segment));
}
const packagePath=(v:unknown,p:string)=>{if(!isSafePackagePath(v))fail(p);};
const hash=(v:unknown,p:string)=>{if(typeof v!=='string'||! /^[0-9a-f]{64}$/.test(v))fail(p);};
const version=(v:unknown,p:string)=>{if(v!==1)fail(p);};
const definitionRef={adventureId:identity,version:identity,bundledPath:packagePath,sha256:hash};
export function parsePackageManifest(value:unknown):PackageManifestV1 {
 shape({format:one(['story-studio-package']),version,episodeId:identity,adventure:shape({id:identity,version:identity}),requiredCapabilities:arr(one(PACKAGE_CAPABILITIES)),files:arr(shape({path:packagePath,bytes:num(0,PACKAGE_LIMITS.maxFileBytes,true),sha256:hash}),2,PACKAGE_LIMITS.maxFiles),definitions:arr(shape({kind:one(['adventure']),...definitionRef}),1,1),adventureDependencies:arr(shape(definitionRef),1,1)},{materializedBuiltins:arr(shape({ref:one(BOSS_BUILTIN_REFS),moduleVersion:version,assetId:identity,sha256:hash}),0,7)})(value,'package manifest');
 const m=JSON.parse(JSON.stringify(value)) as PackageManifestV1;
 unique((m.materializedBuiltins??[]).map(ref=>ref.ref),'materialized builtin refs');unique((m.materializedBuiltins??[]).map(ref=>ref.assetId),'materialized builtin assets');
 unique(m.requiredCapabilities,'package capabilities');unique(m.files.map(file=>file.path.normalize('NFC').toLowerCase()),'package file paths');
 if(m.files.some(file=>file.path==='manifest.json')||m.files.reduce((sum,file)=>sum+file.bytes,0)>PACKAGE_LIMITS.maxTotalBytes)fail('package file budget');
 if(m.files.some(file=>['project.json',ADVENTURE_DEFINITION_PATH].includes(file.path)&&file.bytes>PACKAGE_LIMITS.maxJsonBytes))fail('package JSON budget');
 if(!m.files.some(file=>file.path==='project.json'))fail('project.json');
 const d=m.definitions[0],a=m.adventureDependencies[0],file=m.files.find(file=>file.path===ADVENTURE_DEFINITION_PATH);
 if(!file||d.bundledPath!==ADVENTURE_DEFINITION_PATH||a.bundledPath!==ADVENTURE_DEFINITION_PATH||d.adventureId!==m.adventure.id||a.adventureId!==m.adventure.id||d.version!==m.adventure.version||a.version!==m.adventure.version||d.sha256!==file.sha256||a.sha256!==file.sha256)fail('adventure snapshot reference');
 return m;
}
/** Reject unknown input fields first, then construct an exact authored-field projection. */
export function projectAuthoredEpisode(value:unknown):EpisodeProject {
 const p=parseEpisodeProject(value);
 return parseEpisodeProject({format:'story-studio-episode',version:1,id:p.id,title:p.title,createdAt:p.createdAt,updatedAt:p.updatedAt,
  assets:p.assets,mediaBins:p.mediaBins,scenes:p.scenes,sequences:p.sequences,...(p.sections?{sections:p.sections}:{}),cards:p.cards,library:p.library,cardSets:p.cardSets,
  adventure:p.adventure,requiredCapabilities:p.requiredCapabilities,derivedImages:p.derivedImages,catalog:p.catalog,
  ...(p.activities?{activities:p.activities}:{}),...(p.occurrences?{occurrences:p.occurrences}:{}),...(p.adventureDefinition?{adventureDefinition:p.adventureDefinition}:{})});
}
export const projectPortableProjection=projectAuthoredEpisode;
export function validatePortableEpisode(value:unknown):EpisodeProject {
 const p=projectAuthoredEpisode(value);if(!p.adventureDefinition)throw new Error('Portable episode requires an explicit adventure definition snapshot');
 const registry=createMediaRegistry({format:'scene',data:p}),report=registry.dependencies();
 if(registry.diagnostics().length)throw new Error(`Portable media registry: ${registry.diagnostics()[0].kind}`);
 if(!report.complete||report.issues.length)throw new Error(`Portable dependency unresolved: ${report.issues[0]?.kind??'unknown'} ${report.issues[0]?.field??''}`);
 unique(p.assets.map(asset=>asset.relativePath.normalize('NFC').toLowerCase()),'portable asset paths');
 for(const asset of p.assets)if(!isSafePackagePath(asset.relativePath)||!asset.relativePath.startsWith('assets/'))fail('portable asset path');
 return p;
}
function canonical(value:unknown):string {if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;if(value&&typeof value==='object')return `{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;return JSON.stringify(value);}
export function validatePackageClosure(episode:unknown,manifest:unknown,definition:unknown):void {
 const p=validatePortableEpisode(episode),m=parsePackageManifest(manifest),d=parseAdventureDefinition(definition);
 if(m.episodeId!==p.id||m.adventure.id!==p.adventure.id||m.adventure.version!==p.adventure.version)fail('package episode identity');
 if(canonical(d)!==canonical(p.adventureDefinition))fail('package adventure definition agreement');
 if(canonical([...m.requiredCapabilities].sort())!==canonical([...p.requiredCapabilities].sort()))fail('package capability agreement');
 for(const builtin of m.materializedBuiltins??[]){const asset=p.assets.find(asset=>asset.id===builtin.assetId);if(!asset||asset.mediaType!=='image'||m.files.find(file=>file.path===asset.relativePath)?.sha256!==builtin.sha256)fail('materialized builtin asset digest');}
 const expected=['project.json',ADVENTURE_DEFINITION_PATH,...p.assets.map(asset=>asset.relativePath)];
 if(expected.length!==m.files.length||expected.some(path=>!m.files.some(file=>file.path===path)))fail('package complete file closure');
 for(const asset of p.assets)if(m.files.find(file=>file.path===asset.relativePath)?.bytes!==asset.sizeBytes)fail('package asset byte metadata');
}
