import type { BattleStoreState } from '../store/battleStore';
import { initializeHostedBoss, type BossAuthoredConfig } from './hostedConfig';
import type { EditorOperation, EditorAsset, EditorResult } from '../../../../src/shared/modules/protocol';

type Store={getState():BattleStoreState;setState(value:Partial<BattleStoreState>):void};
export type CoreInventoryRow={participantId:string;rewards:{rewardId:string;quantity:number}[]};
type Port={context:{participantIds:string[]};proposeConfig(config:BossAuthoredConfig):Promise<{accepted:boolean;configRevision:number;reason?:string}>;emit(type:string,payload:unknown):unknown;requestInventory?:()=>Promise<CoreInventoryRow[]>;requestEditor?:(operation:EditorOperation)=>Promise<EditorResult>};
const authoringMethods: (keyof BattleStoreState)[] = [
  'setEncounterName','updateIntroSetup','createIntroHeroOption','updateIntroHeroOption','deleteIntroHeroOption',
  'updateHero','updateVillain','setBackground','setGameBackground','toggleCardSelection','setCardSelected',
  'createCard','updateCard','duplicateCard','deleteCard','toggleMiniGameEnabled','setGameOrder','moveGameOrderItem',
  'setRoundCount','setDifficulty','updateBattleSettings','updateBattleResolutionRules','updatePointerHighlight',
  'createCutscene','updateCutscene','duplicateCutscene','deleteCutscene','createActionItem','updateActionItem','deleteActionItem',
  'setBoardDashMedallionCount','setBoardDashCardLimit','setBoardDashCardSelected','createReward','updateReward','duplicateReward','deleteReward',
  'createPowerUp','updatePowerUp','duplicatePowerUp','deletePowerUp',
];
export type HostedBossSession=ReturnType<typeof connectHostedBoss>;
let activeSession:HostedBossSession|null=null;
export const getHostedBossSession=()=>activeSession;

/** Encounters belong to Core; battle progress stays inside this disposable run. */
export function connectHostedBoss({store,config,mediaMap,builtins={},port}:{store:Store;config:unknown;mediaMap:Record<string,string>;builtins?:Record<string,string>;port:Port}) {
  const projection=initializeHostedBoss(store,config,mediaMap,builtins);
  const listeners=new Set<()=>void>();let status='Episode configuration loaded',disposed=false,draftError='';
  let assets:EditorAsset[]=[],selectedId='',failedDraft:BossAuthoredConfig|null=null;
  const mediaListeners=new Set<()=>void>();
  const notifyMedia=()=>{for(const listener of mediaListeners)listener();};
  let queued:BossAuthoredConfig|null=null,flight:Promise<void>|null=null,completed=false;
  const notify=(message:string)=>{status=message;for(const listener of listeners)listener();};
  const beforeClose=(event:BeforeUnloadEvent)=>{if(flight||queued||failedDraft||draftError){event.preventDefault();event.returnValue='';notify('Episode save failed: Keep Present open and apply pending changes before closing.');}};
  if(typeof window!=='undefined')window.addEventListener('beforeunload',beforeClose);
  const flush=():Promise<void>=>{
    if(flight)return flight.then(()=>flush());if(!queued||disposed)return Promise.resolve();
    const candidate=queued;queued=null;notify('Saving changes to episode…');
    flight=port.proposeConfig(candidate).then(ack=>{
      if(disposed)return;
      if(!ack.accepted)throw new Error(ack.reason||'Episode rejected these changes.');
      projection.accept(candidate);failedDraft=null;notify(draftError||'Changes accepted by episode');
    }).catch(error=>{if(!disposed){failedDraft=candidate;notify(`Episode save failed: ${String(error?.message||error)}`);}}).finally(()=>{flight=null;});
    return flight.then(()=>flush());
  };
  const queue=()=>{try{queued=projection.proposal();projection.preview(queued);draftError='';void flush();}catch(error){queued=null;draftError=`Episode save failed: ${String((error as Error).message||error)}`;notify(draftError);}};
  const originals:Partial<BattleStoreState>={};const replacements:Record<string,unknown>={};
  for(const name of authoringMethods){const original=store.getState()[name] as (...args:unknown[])=>unknown;(originals as Record<string,unknown>)[name]=original;replacements[name]=(...args:unknown[])=>{
    const result=original(...args);
    // Standalone creation uses remote examples. Hosted creations start unassigned.
    const state=store.getState();
    if(name==='createCard')store.setState({cardLibrary:state.cardLibrary.map(card=>card.id===result?{...card,image:''}:card)});
    if(name==='createIntroHeroOption')store.setState({activeEncounter:{...state.activeEncounter,introSetup:{...state.activeEncounter.introSetup,heroes:state.activeEncounter.introSetup.heroes.map(hero=>hero.id===result?{...hero,portrait:''}:hero)}}});
    if(name==='createCutscene')store.setState({activeEncounter:{...state.activeEncounter,cutscenes:state.activeEncounter.cutscenes.map(scene=>scene.id===result?{...scene,mediaSource:''}:scene)}});
    queue();return result;
  };}
  for(const name of ['saveEncounterToLocalStorage','loadEncounterFromLocalStorage','exportProjectFile','importProjectFile'] as const){originals[name]=store.getState()[name] as never;replacements[name]=()=>{throw new Error('Hosted configuration is owned by the episode. Use Apply changes to episode.');};}
  originals.setUIMode=store.getState().setUIMode;
  replacements.setUIMode=(mode:BattleStoreState['uiMode'])=>{
    if(mode==='play'&&(flight||queued||failedDraft||draftError)){notify(draftError||'Episode save failed: Apply or retry pending changes before playing.');return;}
    if(mode==='edit'&&store.getState().uiMode!=='edit')projection.restoreAuthored();
    originals.setUIMode!(mode);
  };
  originals.completeMiniGame=store.getState().completeMiniGame;
  replacements.completeMiniGame=(result:Parameters<BattleStoreState['completeMiniGame']>[0])=>{
    originals.completeMiniGame!(result);if(disposed)return;
    const state=store.getState(),participantIds=[...port.context.participantIds];
    port.emit('score-reported',{scores:participantIds.map(participantId=>({participantId,score:state.scores.hero}))});
    if(state.battleProgress.phase==='battleComplete'&&!completed){
      completed=true;
      const outcome=state.battleState.outcome==='heroVictory'?'won':state.battleState.outcome==='villainVictory'?'lost':state.battleState.outcome==='draw'?'draw':'completed';
      port.emit('activity-completed',{participantIds,outcome});
      if(outcome==='won'){
        const requests=projection.authored().encounter.rewards.filter(reward=>reward.value>0).flatMap(reward=>participantIds.map(participantId=>({participantId,rewardId:reward.id,quantity:Math.min(1000,Math.max(1,Math.round(reward.value)))})));
        if(requests.length)port.emit('reward-requested',{requests});
      }
    }
  };
  store.setState(replacements as Partial<BattleStoreState>);
  const session={
    status:()=>status,
    subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};},
    save:async()=>{if(!flight&&!queued)queue();await flush();},
    assets:()=>assets,
    selected:()=>selectedId,
    replaceConfig:(candidate:BossAuthoredConfig)=>{projection.preview(candidate);queue();},
    select:(id:string)=>{selectedId=id;notifyMedia();},
    subscribeMedia:(listener:()=>void)=>{mediaListeners.add(listener);return()=>{mediaListeners.delete(listener);};},
    updateMedia:(next:EditorAsset[])=>{
      if(disposed||JSON.stringify(next)===JSON.stringify(assets))return;
      assets=next;
      projection.updateMedia(Object.fromEntries(assets.filter(asset=>asset.url).map(asset=>[`asset:${asset.id}`,asset.url!])));
      notifyMedia();
    },
    requestEditor:async(operation:EditorOperation)=>{
      if(!port.requestEditor)throw new Error('Episode editor bridge is unavailable.');
      if(operation==='episode-save'){await session.save();if(failedDraft||draftError)throw new Error(status);}
      const result=await port.requestEditor(operation);
      if(disposed)throw new Error('Episode editor closed.');
      if(!result.ok)throw new Error(result.reason||'Episode operation failed.');
      if(result.assets)session.updateMedia(result.assets);
      if(operation==='episode-save')notify(result.cancelled?'Episode save cancelled — changes remain unsaved':'Episode saved');
      return result;
    },
    exportConfig:()=>store.getState().uiMode==='edit'?projection.proposal():projection.authored(),
    inventory:()=>port.requestInventory?port.requestInventory():Promise.reject(new Error('Core inventory is unavailable.')),
    dispose:()=>{if(disposed)return;disposed=true;queued=null;if(typeof window!=='undefined')window.removeEventListener('beforeunload',beforeClose);store.setState(originals);listeners.clear();mediaListeners.clear();if(activeSession===session)activeSession=null;},
  };
  activeSession=session;return session;
}
