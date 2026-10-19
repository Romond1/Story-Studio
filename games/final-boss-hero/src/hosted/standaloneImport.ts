import { parseModuleConfig } from '../../../../src/shared/modules/validation';
import { background, icon, media } from '../../../../src/shared/modules/checks';
import type { EditorAsset } from '../../../../src/shared/modules/protocol';
import { visitBossMedia, type BossAuthoredConfig } from './hostedConfig';

export type MissingBossMedia={field:string;original:string;kind:'image'|'video'};
/** Stage authoring only; no mutation, localStorage, runtime restoration or silent media loss. */
export function stageStandaloneBoss(value:unknown,assets:EditorAsset[]){
  const input=value as {metadata?:{schema?:string;version?:number};project?:BossAuthoredConfig};
  if(input?.metadata?.schema!=='final-boss-hero-project'||input.metadata.version!==1||!input.project)throw new Error('Choose a version 1 Final Boss Hero project file.');
  const candidate=JSON.parse(JSON.stringify(input.project)) as BossAuthoredConfig;
  const missing:MissingBossMedia[]=[];
  visitBossMedia(candidate,(owner,key,field)=>{
    const original=owner[key] as string;
    const kind=key==='video'||(key==='mediaSource'&&owner.mediaType==='video')?'video':'image';
    const asset=assets.find(asset=>`asset:${asset.id}`===original&&asset.mediaType===kind&&asset.url);
    let valid=false;
    try{(key==='background'||field.includes('/gameBackgrounds/')?background:key==='icon'?icon:media)(original,field);valid=!original.startsWith('asset:')||!!asset;}catch{}
    if(!valid){missing.push({field,original,kind});owner[key]='';}
  });
  const config=parseModuleConfig('final-boss-hero',candidate);
  return {config,missing};
}
export function recoverStandaloneBoss(config:BossAuthoredConfig,replacements:Record<string,string>):BossAuthoredConfig{
  const candidate=JSON.parse(JSON.stringify(config));
  visitBossMedia(candidate,(owner,key,field)=>{if(Object.hasOwnProperty.call(replacements,field))owner[key]=replacements[field];});
  return parseModuleConfig('final-boss-hero',candidate);
}
