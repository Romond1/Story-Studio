import {RemovalGate,type RemovalStatus} from '../../../shared/personRemoval';
export interface PersonMask {bytes:Uint8Array;width:number;height:number;timestamp:number}
/** Owns a single CPU worker and small masks, never a capture stream. */
export class PersonRemovalSession {
 private worker:Worker;private gate=new RemovalGate();private ready=false;private disposed=false;
 private current:PersonMask|null=null;private watchdog:ReturnType<typeof setTimeout>;
 private lastReport=0;private windowStart=performance.now();private results=0;private inferenceMs=0;
 constructor(private report:(status:RemovalStatus)=>void){
  const baseUrl=new URL('person-removal/',document.baseURI).href;
  this.worker=new Worker(new URL('person.worker.js',baseUrl));this.report({state:'initializing'});
  this.watchdog=setTimeout(()=>this.fail('Person removal initialization timed out. Toggle it off and on to retry.'),20000);
  this.worker.onerror=e=>{e.preventDefault();this.fail('Person removal worker failed. Toggle it off and on to retry.');};
  this.worker.onmessageerror=()=>this.fail('Person mask could not be read. Toggle removal off and on.');
  this.worker.onmessage=({data})=>{
   if(this.disposed)return;
   if(data.type==='error'){this.fail(data.message??'Person inference failed.');return;}
   clearTimeout(this.watchdog);
   if(data.type==='ready'){this.ready=true;return;}
   if(data.type!=='result')return;
   const now=performance.now();
   if(!Number.isFinite(data.inferenceMs)||data.inferenceMs<0||!(data.bytes instanceof Uint8Array)||data.width!==256||data.height!==144||data.bytes.length!==256*144){this.fail('Invalid person mask. Toggle removal off and on.');return;}
   const fresh=this.gate.finish(data.timestamp,now,data.inferenceMs);
   if(this.gate.overloaded){this.fail('Person removal exceeded its processing budget. Output hidden; toggle removal off to use the original camera.');return;}
   this.inferenceMs=this.inferenceMs?this.inferenceMs*.75+data.inferenceMs*.25:data.inferenceMs;
   if(fresh){this.current={bytes:data.bytes,width:data.width,height:data.height,timestamp:data.timestamp};this.results++;}
  };
  this.worker.postMessage({type:'init',baseUrl});
 }
 sample(video:HTMLVideoElement,now:number,renderFps:number){
  if(this.disposed||!this.ready||video.readyState<2||!video.videoWidth)return;
  if(now-this.lastReport>=1000){const elapsed=Math.max(1,now-this.windowStart);this.report({state:this.gate.fps===6?'slow':'running',fps:Math.round(this.results*10000/elapsed)/10,inferenceMs:Math.round(this.inferenceMs*10)/10,maskAgeMs:Math.min(30000,Math.round(this.current?now-this.current.timestamp:0)),renderFps:Math.round(renderFps*10)/10});this.lastReport=now;this.windowStart=now;this.results=0;}
  if(!this.gate.begin(now))return;
  this.watchdog=setTimeout(()=>this.fail('Person removal stopped responding. Output hidden; toggle removal off and on.'),3000);
  void createImageBitmap(video,{resizeWidth:256,resizeHeight:144,resizeQuality:'low'}).then(bitmap=>{
   if(this.disposed){bitmap.close();return;}
   try{this.worker.postMessage({type:'frame',timestamp:now,bitmap},[bitmap]);}
   catch{bitmap.close();this.fail('Unable to send camera frame for person removal.');}
  }).catch(()=>this.fail('Unable to prepare a person-removal frame.'));
 }
 mask(now:number):PersonMask|null{return !this.disposed&&this.current&&now-this.current.timestamp<=400?this.current:null;}
 private fail(message:string){if(this.disposed)return;this.dispose();this.report({state:'error',message});}
 dispose(){if(this.disposed)return;this.disposed=true;clearTimeout(this.watchdog);this.worker.onmessage=null;this.worker.onerror=null;this.worker.onmessageerror=null;this.worker.terminate();this.current=null;}
}
