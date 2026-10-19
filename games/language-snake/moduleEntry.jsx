import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { stopMusic, setSoundEnabled } from './effects.js';
import { installHostedModuleBridge } from '../shared/hostedBridge.mjs';
import { parseHostToModuleMessage } from '../../src/shared/modules/protocol';
import { parseModuleConfig } from '../../src/shared/modules/validation';
import { toSnakeRuntime, exportSnakeConfig } from './hostedConfig.mjs';
import { readGameInputMessage } from './inputBridge.mjs';

export function startHostedSnake(scheduler) {
 const instanceId=new URLSearchParams(window.location.search).get('instanceId')||'';
 let root=null,hosted=null,api=null,bridge=null,mediaMap={};
 class Boundary extends React.Component {state={failed:false};static getDerivedStateFromError(){return {failed:true};}componentDidCatch(error){bridge.error(error);}render(){return this.state.failed?<p>Language Snake could not start. Restart from Control.</p>:this.props.children;}}
 const exportConfig=()=>{if(!hosted?.read)throw new Error('Snake configuration is not ready.');return parseModuleConfig('language-snake',exportSnakeConfig(hosted.read(),hosted.audioRefs,mediaMap));};
 const unmount=()=>{root?.unmount();root=null;api=null;stopMusic();};
 const initialize=async(config,map,context)=>{
  unmount();mediaMap=map;const authored=parseModuleConfig('language-snake',config),runtime=toSnakeRuntime(authored,map);setSoundEnabled(true);
  await new Promise(resolve=>{
   hosted={runtime,audioRefs:{...(authored.sounds?{sounds:{...authored.sounds}}:{}),...(authored.music?{music:authored.music}:{})},
    ready(value){api=value;resolve();},
    save:()=>bridge.proposeConfig(exportConfig()),
    complete(players,result){if(bridge.state!=='running')return;const ids=bridge.context.participantIds;
     bridge.emit('score-reported',{scores:ids.slice(0,players.length).map((participantId,index)=>({participantId,score:players[index].score+(players[index].crowns||0)*(hosted.read().heroCrownSettings.bonusValue||0)}))});
     bridge.emit('activity-completed',{participantIds:[...ids],outcome:/time up|loss|defeat/i.test(result.title)?'lost':/victory/i.test(result.title)?'won':'completed'});
     const requests=ids.slice(0,players.length).flatMap((participantId,index)=>players[index].crowns>0?[{participantId,rewardId:'hero-crown',quantity:players[index].crowns}]:[]);if(requests.length)bridge.emit('reward-requested',{requests});
    }};
   root=ReactDOM.createRoot(document.getElementById('root'));root.render(<Boundary><App hosted={hosted}/></Boundary>);
  });
 };
 bridge=installHostedModuleBridge({targetWindow:window,moduleType:'language-snake',instanceId,scheduler,parseHostCommand:parseHostToModuleMessage,adapter:{initialize,start:()=>api?.start(),reset:(config,context,map)=>initialize(config,map,context),stop:()=>{unmount();setSoundEnabled(false);},dispose:()=>{unmount();setSoundEnabled(false);window.removeEventListener('message',input);},exportConfig}});
 const input=event=>{if(bridge.state!=='running')return;const packet=readGameInputMessage(event,{parentWindow:window.parent,instanceId,origin:window.location.origin});if(packet)window.dispatchEvent(new KeyboardEvent(packet.phase,{...packet,bubbles:true,cancelable:true}));};
 window.addEventListener('message',input);
 return bridge;
}
