/** Frame-local logical clock. Native primitives are captured before any patch. */
export function createPausableClock(platform) {
 let state='running',offset=0,pausedAt=0,serial=0;
 const timers=new Map(),frames=new Map();
 const now=()=> (state==='paused'||state==='stopped'||state==='disposed'?pausedAt:platform.now())-offset;
 const arm=job=>{if(state!=='running')return;job.native=platform.setTimeout(()=>{if(state!=='running'||!timers.has(job.id))return;if(!job.interval)timers.delete(job.id);job.callback(...job.args);if(job.interval&&timers.has(job.id)){job.due=now()+job.delay;arm(job);}},Math.max(0,job.due-now()));};
 const schedule=(callback,delay,interval,args)=>{if(typeof callback!=='function')throw new TypeError('Hosted timers require a function.');const id=++serial;if(state==='disposed'||state==='stopped')return id;const duration=Math.max(interval?1:0,Number(delay)||0);const job={id,callback,args,interval,delay:duration,due:now()+duration,native:null};timers.set(id,job);arm(job);return id;};
 const clear=id=>{const job=timers.get(id);if(job){platform.clearTimeout(job.native);timers.delete(id);}};
 const armFrame=job=>{if(state!=='running')return;job.native=platform.requestAnimationFrame(()=>{if(state!=='running'||!frames.has(job.id))return;frames.delete(job.id);job.callback(now());});};
 const pause=()=>{if(state!=='running')return;pausedAt=platform.now();state='paused';for(const job of timers.values())platform.clearTimeout(job.native);for(const job of frames.values())platform.cancelAnimationFrame(job.native);};
 const stop=()=>{pause();if(state==='disposed')return;state='stopped';timers.clear();frames.clear();};
 return {get state(){return state;},now,setTimeout:(fn,ms,...args)=>schedule(fn,ms,false,args),setInterval:(fn,ms,...args)=>schedule(fn,ms,true,args),clearTimeout:clear,clearInterval:clear,
 requestAnimationFrame(callback){const job={id:++serial,callback,native:null};if(state==='disposed'||state==='stopped')return job.id;frames.set(job.id,job);armFrame(job);return job.id;},
 cancelAnimationFrame(id){const job=frames.get(id);if(job){platform.cancelAnimationFrame(job.native);frames.delete(id);}},
 pause,resume(){if(state!=='paused')return;offset+=platform.now()-pausedAt;state='running';for(const job of timers.values())arm(job);for(const job of frames.values())armFrame(job);},stop,dispose(){stop();state='disposed';}};
}

export function installHostedScheduler(targetWindow) {
 const native={setTimeout:targetWindow.setTimeout.bind(targetWindow),clearTimeout:targetWindow.clearTimeout.bind(targetWindow),setInterval:targetWindow.setInterval.bind(targetWindow),clearInterval:targetWindow.clearInterval.bind(targetWindow),requestAnimationFrame:targetWindow.requestAnimationFrame.bind(targetWindow),cancelAnimationFrame:targetWindow.cancelAnimationFrame.bind(targetWindow),now:targetWindow.performance.now.bind(targetWindow.performance),dateNow:targetWindow.Date.now.bind(targetWindow.Date)};
 const clock=createPausableClock(native),restores=[],media=new Map(),contexts=new Set(),resumeContexts=new Set(),animations=new Set();
 const replace=(object,key,value)=>{const descriptor=Object.getOwnPropertyDescriptor(object,key);Object.defineProperty(object,key,{configurable:true,writable:true,value});restores.push(()=>{if(descriptor)Object.defineProperty(object,key,descriptor);else delete object[key];});};
 for(const key of ['setTimeout','clearTimeout','setInterval','clearInterval','requestAnimationFrame','cancelAnimationFrame'])replace(targetWindow,key,clock[key]);
 const epoch=native.dateNow()-native.now();replace(targetWindow.performance,'now',clock.now);replace(targetWindow.Date,'now',()=>epoch+clock.now());
 const mediaPrototype=targetWindow.HTMLMediaElement?.prototype,nativePlay=mediaPrototype?.play,nativePause=mediaPrototype?.pause;
 if(mediaPrototype){
  replace(mediaPrototype,'play',function(){if(clock.state==='stopped'||clock.state==='disposed')return Promise.resolve();const record=media.get(this)??{resume:false};media.set(this,record);record.resume=true;if(clock.state==='paused')return Promise.resolve();return Promise.resolve(nativePlay.call(this)).then(value=>{if(clock.state==='paused')nativePause.call(this);return value;});});
  replace(mediaPrototype,'pause',function(){const record=media.get(this);if(record)record.resume=false;return nativePause.call(this);});
 }
 const contextMethods=new Map();
 for(const name of ['AudioContext','webkitAudioContext']){
  const Constructor=targetWindow[name];if(!Constructor)continue;
  const prototype=Constructor.prototype;
  if(!contextMethods.has(prototype)){
   const methods={resume:prototype.resume,suspend:prototype.suspend,close:prototype.close};contextMethods.set(prototype,methods);
   replace(prototype,'resume',function(){contexts.add(this);if(clock.state==='paused'){resumeContexts.add(this);return Promise.resolve();}if(clock.state==='stopped'||clock.state==='disposed')return Promise.resolve();return methods.resume.call(this);});
  }
  replace(targetWindow,name,new Proxy(Constructor,{construct(ctor,args,newTarget){const context=Reflect.construct(ctor,args,newTarget);contexts.add(context);if(clock.state==='paused'){if(context.state==='running')resumeContexts.add(context);void contextMethods.get(prototype).suspend.call(context);}return context;}}));
 }
 const freezeAnimations=()=>{if(clock.state!=='paused')return;for(const animation of targetWindow.document?.getAnimations?.()??[]){if(animation.playState==='running'){animations.add(animation);animation.pause();}}};
 const observer=targetWindow.MutationObserver?new targetWindow.MutationObserver(freezeAnimations):null;observer?.observe(targetWindow.document.documentElement,{subtree:true,attributes:true,childList:true});
 const blockInput=event=>{if(clock.state!=='running'){event.preventDefault();event.stopImmediatePropagation();}};
 const inputEvents=['keydown','keyup','pointerdown','pointerup','click','dblclick','touchstart'];for(const name of inputEvents)targetWindow.addEventListener(name,blockInput,true);
 const pause=async()=>{if(clock.state!=='running')return;clock.pause();for(const item of targetWindow.document?.querySelectorAll?.('audio,video')??[])if(!media.has(item))media.set(item,{resume:!item.paused});for(const [item,record]of media){record.resume=record.resume&&!item.paused;nativePause?.call(item);}const pending=[];for(const context of contexts)if(context.state==='running'){resumeContexts.add(context);pending.push(contextMethods.get(Object.getPrototypeOf(context))?.suspend.call(context)??context.suspend());}freezeAnimations();await Promise.all(pending);};
 const resume=async()=>{if(clock.state!=='paused')return;clock.resume();for(const animation of animations)if(animation.playState==='paused')animation.play();animations.clear();const pending=[];for(const [item,record]of media)if(record.resume){pending.push(Promise.resolve(nativePlay.call(item)));}for(const context of resumeContexts){if(context.state!=='closed')pending.push(contextMethods.get(Object.getPrototypeOf(context))?.resume.call(context)??context.resume());}resumeContexts.clear();await Promise.all(pending);};
 const stop=()=>{clock.stop();for(const item of media.keys())nativePause?.call(item);media.clear();for(const context of contexts){if(context.state!=='closed')void(contextMethods.get(Object.getPrototypeOf(context))?.close.call(context)??context.close());}contexts.clear();resumeContexts.clear();for(const animation of targetWindow.document?.getAnimations?.()??[])animation.cancel();animations.clear();};
 let disposed=false;
 return {get state(){return clock.state;},now:clock.now,setDeadline:native.setTimeout,clearDeadline:native.clearTimeout,pause,resume,stop,dispose(){if(disposed)return;disposed=true;stop();clock.dispose();observer?.disconnect();for(const name of inputEvents)targetWindow.removeEventListener(name,blockInput,true);for(const restore of restores.reverse())restore();}};
}
