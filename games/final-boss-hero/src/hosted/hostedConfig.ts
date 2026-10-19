import { parseModuleConfig } from '../../../../src/shared/modules/validation';
import type { BattleStoreState } from '../store/battleStore';
import type { CardData, EncounterConfig } from '../types/game';

export type BossAuthoredConfig = { encounter: EncounterConfig; cardLibrary: CardData[] };
type Store = { getState(): BattleStoreState; setState(state: Partial<BattleStoreState>): void };
const clone = <T>(value:T):T => JSON.parse(JSON.stringify(value));
type MediaOwner = Record<string, unknown>;
/** Only declared visual fields are translated; prose and gameplay values stay exact. */
export function visitBossMedia(config:BossAuthoredConfig, visit:(owner:MediaOwner,key:string,pointer:string)=>void) {
  const field=(owner:object,key:string,pointer:string)=>{if(typeof (owner as MediaOwner)[key]==='string')visit(owner as MediaOwner,key,pointer);};
  const encounter=config.encounter;
  for(const side of ['hero','villain'] as const)for(const key of ['portrait','video'])field(encounter[side],key,`encounter/${side}/${key}`);
  encounter.introSetup.heroes.forEach(hero=>{for(const key of ['portrait','video'])field(hero,key,`encounter/introSetup/heroes/${hero.id}/${key}`);});
  field(encounter,'background','encounter/background');
  if(encounter.gameBackgrounds)for(const key of Object.keys(encounter.gameBackgrounds))field(encounter.gameBackgrounds,key,`encounter/gameBackgrounds/${key}`);
  encounter.cutscenes.forEach(item=>field(item,'mediaSource',`encounter/cutscenes/${item.id}/mediaSource`));
  for(const group of ['rewards','powerUps'] as const)encounter[group].forEach(item=>field(item,'icon',`encounter/${group}/${item.id}/icon`));
  config.cardLibrary.forEach(card=>{for(const key of ['image','frontImage','backImage'])field(card,key,`cardLibrary/${card.id}/${key}`);});
}
const visitMedia=visitBossMedia;
function strict(value:unknown):BossAuthoredConfig {
  const parsed=parseModuleConfig('final-boss-hero',value);
  if(!parsed || !('encounter' in parsed) || !Array.isArray(parsed.cardLibrary) || !parsed.cardLibrary.length)throw new Error('Invalid hosted Final Boss configuration; no sample content was substituted.');
  return clone(parsed) as BossAuthoredConfig;
}
/** Core-only initialization bypasses the forgiving standalone project importer. */
export function initializeHostedBoss(store:Store,value:unknown,mediaMap:Record<string,string>,builtins:Record<string,string>|string={}) {
  let authored=strict(value);
  const knownUrls=new Map<string,Set<string>>();
  const remember=(map:Record<string,string>)=>{for(const [id,url] of Object.entries(map)){const ids=knownUrls.get(url)??new Set<string>();ids.add(id.startsWith('asset:')?id:`asset:${id}`);knownUrls.set(url,ids);}};
  remember(mediaMap);
  const references=new Map<string,{reference:string;url:string}>();
  const resolve=(reference:string):string=>{
    if(reference.startsWith('asset:')) {return mediaMap[reference]??mediaMap[reference.slice(6)]??reference;}
    if(reference.startsWith('builtin:final-boss-hero/')) {const url=typeof builtins==='string'?undefined:builtins[reference];if(!url)throw new Error(`Unknown bundled media: ${reference}`);return url;}
    return reference;
  };
  const project=(config:BossAuthoredConfig)=>{
    const rendered=clone(config);references.clear();visitMedia(rendered,(owner,key,pointer)=>{const reference=owner[key] as string;const url=resolve(reference);owner[key]=url;references.set(pointer,{reference,url});});return rendered;
  };
  const rendered=project(authored);
  store.setState({activeEncounter:rendered.encounter,cardLibrary:rendered.cardLibrary,playAreaView:{zoom:1,offsetX:0,offsetY:0},uiMode:'play'});
  store.getState().resetBattleSession();
  return {
    updateMedia:(next:Record<string,string>)=>{
      const state=store.getState();
      const rendered=clone({encounter:state.activeEncounter,cardLibrary:state.cardLibrary});
      visitMedia(rendered,(owner,key,pointer)=>{const prior=references.get(pointer);if(prior&&owner[key]===prior.url)owner[key]=prior.reference;});
      Object.assign(mediaMap,next);
      remember(next);
      const refreshed=project(rendered);
      store.setState({activeEncounter:refreshed.encounter,cardLibrary:refreshed.cardLibrary});
    },
    authored:()=>clone(authored),
    proposal:()=>{
      const state=store.getState();const candidate=clone({encounter:state.activeEncounter,cardLibrary:state.cardLibrary});
      // Older editor drafts retained Board Dash references after deleting cards.
      // Repair only those dangling references; keep all remaining authored edits.
      const cardIds=new Set(candidate.cardLibrary.map(card=>card.id));
      if(Array.isArray(candidate.encounter.boardDashCardIds))candidate.encounter.boardDashCardIds=candidate.encounter.boardDashCardIds.filter(id=>typeof id!=='string'||cardIds.has(id));
      visitMedia(candidate,(owner,key,pointer)=>{
        const value=owner[key] as string,prior=references.get(pointer);
        if(prior?.url===value){owner[key]=prior.reference;return;}
        if(typeof builtins!=='string'){
          const matches=Object.entries(builtins).filter(([,url])=>url===value);
          if(matches.length===1){owner[key]=matches[0][0];return;}
        }
        if(value.startsWith('media:')) {
          const matches=[...(knownUrls.get(value)??[])];
          const unique=[...new Set(matches)];if(unique.length!==1)throw new Error('Ambiguous or unregistered media reference. Choose an episode asset.');owner[key]=unique[0];
        }
      });
      return strict(candidate);
    },
    accept:(candidate:BossAuthoredConfig)=>{authored=strict(candidate);},
    preview:(candidate:BossAuthoredConfig)=>{const rendered=project(strict(candidate));store.setState({activeEncounter:rendered.encounter,cardLibrary:rendered.cardLibrary});},
    restoreAuthored:()=>{const rendered=project(authored);store.setState({activeEncounter:rendered.encounter,cardLibrary:rendered.cardLibrary});},
  };
}
