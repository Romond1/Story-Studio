import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { installHostBridge } from './hostBridge.mjs';
import { installHostedScheduler } from '../shared/hostedScheduler.mjs';
import { installHostedModuleBridge } from '../shared/hostedBridge.mjs';
import { parseHostToModuleMessage } from '../../src/shared/modules/protocol';
import { BOARD_DASH_ICONS } from './src/data/boardDashAssets';
import type { HostedBossSession } from './src/hosted/hostedSession';
import './src/styles.css';
import './viewport.css';
import './src/components/hostedEditor.css';

const query = new URLSearchParams(window.location.search);
const instanceId = query.get('instanceId') || '';
const moduleHost = query.get('moduleHost') === '1';
// Install the frame clock before importing game code or GSAP's ticker.
const scheduler = moduleHost ? installHostedScheduler(window) : null;
const root = ReactDOM.createRoot(document.getElementById('root')!);
let fail:(error:Error)=>void=()=>{};

class GameErrorBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { fail(error); }
  render() {
    return this.state.failed
      ? <p className="game-load-error">Final Boss Hero could not start. Use Restart in Story Studio to try again.</p>
      : this.props.children;
  }
}

async function boot() {
  if(!instanceId){root.render(<p className="game-load-error">Launch Final Boss Hero from Story Studio’s Mastery section.</p>);return;}
  if(!moduleHost || !scheduler){
    const [{App},{default:gsap}]=await Promise.all([import('./src/App'),import('gsap')]);
    const host=installHostBridge({targetWindow:window,instanceId,unmount:()=>root.unmount(),stopAnimations:()=>gsap.globalTimeline.clear()});
    fail=error=>host.error(error);
    function LegacyGame(){useEffect(()=>{host.ready();},[]);return <App/>;}
    root.render(<GameErrorBoundary><LegacyGame/></GameErrorBoundary>);return;
  }
  let session:HostedBossSession|null=null,animation:typeof import('gsap').default|null=null,unmounted=false;
  const builtins=Object.fromEntries(Object.entries(BOARD_DASH_ICONS).map(([key,url])=>[`builtin:final-boss-hero/assets/board-dash/${key==='rollAgain'?'roll-again':key}.png`,url]));
  const unmount=()=>{if(!unmounted){unmounted=true;root.unmount();}};
  const input=installHostBridge({targetWindow:window,instanceId,unmount,stopAnimations:()=>animation?.globalTimeline.clear()});
  const guard=(event:Event)=>{const target=event.target as HTMLElement|null;if(host.state!=='running'&&!target?.closest?.('input,textarea,select,[contenteditable="true"]')){event.preventDefault();event.stopImmediatePropagation();}};
  window.addEventListener('keydown',guard,true);window.addEventListener('pointerdown',guard,true);
  const host=installHostedModuleBridge({targetWindow:window,moduleType:'final-boss-hero',instanceId,scheduler,parseHostCommand:parseHostToModuleMessage,adapter:{
    async initialize(config:unknown,mediaMap:Record<string,string>,context:{participantIds:string[]}){
      const [{App},{useBattleStore},{connectHostedBoss},{default:gsap}]=await Promise.all([import('./src/App'),import('./src/store/battleStore'),import('./src/hosted/hostedSession'),import('gsap')]);
      animation=gsap;gsap.globalTimeline.pause();
      session=connectHostedBoss({store:useBattleStore,config,mediaMap,builtins,port:{context,proposeConfig:next=>host.proposeConfig(next),emit:(type,payload)=>host.emit(type,payload),requestInventory:()=>host.requestInventory(),requestEditor:operation=>host.requestEditor(operation)}});
      root.render(<GameErrorBoundary><App/></GameErrorBoundary>);
    },
    start(){animation?.globalTimeline.resume();document.body.dataset.moduleState='running';},
    pause(){animation?.globalTimeline.pause();document.body.dataset.moduleState='paused';},
    resume(){animation?.globalTimeline.resume();document.body.dataset.moduleState='running';},
    exportConfig(){if(!session)throw new Error('Final Boss configuration is not initialized.');return session.exportConfig();},
    updateMedia(assets:import('../../src/shared/modules/protocol').EditorAsset[]){session?.updateMedia(assets);},
    reset(){throw new Error('Final Boss reset requires a fresh hosted frame and run identity.');},
    stop(){session?.dispose();animation?.globalTimeline.clear();input.dispose();document.body.dataset.moduleState='stopped';},
    dispose(){session?.dispose();window.removeEventListener('keydown',guard,true);window.removeEventListener('pointerdown',guard,true);input.dispose();},
  }});
  fail=error=>{void host.error(error);};
}
void boot().catch(error=>{scheduler?.dispose();root.render(<p className="game-load-error">Final Boss Hero could not start: {String(error?.message||error)}</p>);});
