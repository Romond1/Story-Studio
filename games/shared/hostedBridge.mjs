/** Authenticated, serial module lifecycle; adapter code owns native game mechanics. */
export function installHostedModuleBridge({targetWindow,moduleType,instanceId,scheduler,parseHostCommand,adapter}) {
 const parent=targetWindow.parent,origin=targetWindow.location.origin;
 let state='created',context=null,hostGeneration=null,sequence=0,configRevision=0,config=null,mediaMap={},queue=Promise.resolve(),configQueue=Promise.resolve(),disposed=false;
 const requests=new Set(),pendingConfigs=new Map(),pendingInventory=new Map(),pendingEditor=new Map();
 const uuid=()=>targetWindow.crypto?.randomUUID?.()??`request-${++sequence}`;
 const sameContext=(left,right)=>!!left&&!!right&&JSON.stringify(left)===JSON.stringify(right);
 const base=(requestId)=>({channel:'story-studio-module',version:1,moduleType,moduleVersion:1,hostGeneration,requestId,context});
 const send=(type,payload={},requestId=uuid())=>{if(!context||disposed)return;parent.postMessage({...base(requestId),type,sequence:++sequence,...payload},origin==='null'?'*':origin);};
 const rejectPending=()=>{for(const item of [...pendingConfigs.values(),...pendingInventory.values(),...pendingEditor.values()]){item.clear();item.reject(new Error('Module closed before Core acknowledged the request.'));}pendingConfigs.clear();pendingInventory.clear();pendingEditor.clear();};
 const dispose=async()=>{if(disposed)return;state='disposed';rejectPending();await adapter.dispose?.();scheduler.dispose();disposed=true;targetWindow.removeEventListener('message',receive);targetWindow.removeEventListener('pagehide',dispose);};
 const command=async value=>{
  if(disposed)return;
  if(value.type==='initialize'){
   if(state!=='created'&&state!=='stopped')throw Error('Module is already initialized.');
   context=value.context;hostGeneration=value.hostGeneration;configRevision=value.configRevision;config=value.config;mediaMap=value.mediaMap??{};
   await scheduler.pause();await adapter.initialize(config,mediaMap,context,configRevision);state='initialized';send('ack',{command:value.type},value.requestId);send('ready');return;
  }
  if(value.type==='config-request'){
   try{await proposeConfig(()=>adapter.exportConfig?.(),value.requestId);}
   catch(error){send('config-failed',{message:String(error?.message??error).slice(0,2048)},value.requestId);}
   return;
  }
  if(value.type==='start'){if(state!=='initialized')throw Error('Module must be initialized before start.');await adapter.start?.();state='running';await scheduler.resume();}
  else if(value.type==='pause'){if(state==='paused'){send('ack',{command:value.type},value.requestId);return;}if(state!=='running')throw Error('Module must be running before pause.');await scheduler.pause();await adapter.pause?.();state='paused';}
  else if(value.type==='resume'){if(state!=='paused')throw Error('Module must be paused before resume.');await adapter.resume?.();state='running';await scheduler.resume();}
  else if(value.type==='reset'){await scheduler.pause();context=value.context;rejectPending();await adapter.reset?.(config,context,mediaMap);state='initialized';}
  else if(value.type==='stop'){if(state!=='stopped'){await scheduler.pause();await adapter.stop?.();state='stopped';rejectPending();}}
  else if(value.type==='dispose'){send('ack',{command:value.type},value.requestId);await dispose();return;}
  else return;
  send('ack',{command:value.type},value.requestId);
 };
 function receive(event){
  if(disposed||event.source!==parent||event.origin!==origin)return;
  const value=parseHostCommand(event.data);if(!value||value.moduleType!==moduleType||value.context?.instanceId!==instanceId)return;
  if(value.type==='initialize'){if(state!=='created'&&(value.hostGeneration!==hostGeneration||!sameContext(context,value.context)))return;}
  else if(value.hostGeneration!==hostGeneration||!sameContext(context,value.context)){
   // Reset alone can replace the run identity, never episode/participant/instance authority.
   const resetContext=value.type==='reset'&&context?{...value.context,runId:context.runId}:null;
   if(value.hostGeneration!==hostGeneration||!sameContext(context,resetContext))return;
  }
  if(value.type==='config-ack'){
   const pending=pendingConfigs.get(value.requestId);if(!pending)return;
   pendingConfigs.delete(value.requestId);pending.clear();
   configRevision=Math.max(configRevision,value.configRevision);
   if(value.accepted)config=pending.config;
   pending.resolve({accepted:value.accepted,configRevision:value.configRevision,reason:value.reason});return;
  }
  if(value.type==='event-ack')return;
  if(value.type==='media-catalogue'){adapter.updateMedia?.(value.assets);return;}
  if(value.type==='editor-response'){
   const pending=pendingEditor.get(value.requestId);if(!pending)return;
   pendingEditor.delete(value.requestId);pending.clear();pending.resolve(value);return;
  }
  if(value.type==='inventory-response'){
   const pending=pendingInventory.get(value.requestId);if(!pending)return;
   pendingInventory.delete(value.requestId);pending.clear();pending.resolve(value.inventory);return;
  }
  if(requests.has(value.requestId))return;requests.add(value.requestId);
  queue=queue.then(()=>command(value)).catch(async error=>{send('error',{message:String(error?.message??error).slice(0,2048)},value.requestId);await dispose();});
 }
 function proposeConfig(next,requestId=uuid()) {
  const result=configQueue.then(async()=>{
   if(!context||state==='stopped'||state==='disposed')throw new Error('Module editor is not active.');
   const proposed=typeof next==='function'?await next():next;
   return new Promise((resolve,reject)=>{const timer=(scheduler.setDeadline??setTimeout)(()=>{pendingConfigs.delete(requestId);reject(new Error('Configuration acknowledgement timed out.'));},15000);pendingConfigs.set(requestId,{config:proposed,resolve,reject,clear:()=> (scheduler.clearDeadline??clearTimeout)(timer)});send('config-proposal',{expectedRevision:configRevision,configVersion:1,config:proposed},requestId);});
  });
  configQueue=result.catch(()=>{});return result;
 }
 targetWindow.addEventListener('message',receive);targetWindow.addEventListener('pagehide',dispose,{once:true});
 return {
  get state(){return state;},get context(){return context;},get configRevision(){return configRevision;},get config(){return config;},
  proposeConfig,
  requestEditor(operation){
   if(!context||disposed||state==='stopped')return Promise.reject(new Error('Module is not active.'));
   const requestId=uuid();
   return new Promise((resolve,reject)=>{const timer=(scheduler.setDeadline??setTimeout)(()=>{pendingEditor.delete(requestId);reject(new Error('Episode editor request timed out. Retry in Story Studio.'));},operation==='media-list'?15000:300000);pendingEditor.set(requestId,{resolve,reject,clear:()=> (scheduler.clearDeadline??clearTimeout)(timer)});send('editor-request',{operation},requestId);});
  },
  requestInventory(){
   if(!context||disposed||state==='stopped')return Promise.reject(new Error('Module is not active.'));
   const requestId=uuid();
   return new Promise((resolve,reject)=>{const timer=(scheduler.setDeadline??setTimeout)(()=>{pendingInventory.delete(requestId);reject(new Error('Core inventory request timed out.'));},15000);pendingInventory.set(requestId,{resolve,reject,clear:()=> (scheduler.clearDeadline??clearTimeout)(timer)});send('inventory-request',{},requestId);});
  },
  error(error){send('error',{message:String(error?.message??error).slice(0,2048)});void dispose();},
  emit(type,payload){if(state!=='running')throw Error('Module results require a running session.');const eventId=uuid();const event={version:1,eventId,context,sequence:sequence+1,type,payload};send('event',{event},eventId);return eventId;},
  dispose,
 };
}
