export interface RemovalStatus {state:'off'|'initializing'|'running'|'slow'|'error';message?:string;fps?:number;inferenceMs?:number;maskAgeMs?:number;renderFps?:number}
export function parseRemovalStatus(value:unknown):RemovalStatus|null {
 if(!value||typeof value!=='object')return null;const v=value as RemovalStatus;
 if(!['off','initializing','running','slow','error'].includes(v.state)||v.message!==undefined&&typeof v.message!=='string')return null;
 const result:RemovalStatus={state:v.state,...(v.message?{message:v.message.slice(0,512)}:{})};
 for(const key of ['fps','inferenceMs','maskAgeMs','renderFps'] as const){const metric=v[key];if(metric!==undefined){if(!Number.isFinite(metric)||metric<0||metric>(key==='fps'||key==='renderFps'?120:30000))return null;result[key]=metric;}}
 return result;
}
export class RemovalGate {
 private pending:number|null=null;private last=-Infinity;private expensive=0;private costs:number[]=[];
 fps=12;overloaded=false;
 begin(now:number){if(this.overloaded||this.pending!==null||now-this.last<1000/this.fps)return false;this.pending=this.last=now;return true;}
 finish(timestamp:number,now:number,inferenceMs:number){
  if(timestamp!==this.pending)return false;this.pending=null;
  this.costs=[...this.costs.slice(-4),inferenceMs];
  if(this.costs.length>=3&&this.costs.reduce((sum,n)=>sum+n,0)/this.costs.length>45)this.fps=6;
  else if(this.costs.length===5&&this.costs.every(n=>n<25))this.fps=12;
  this.expensive=inferenceMs>150?this.expensive+1:0;if(this.expensive>=5)this.overloaded=true;
  return !this.overloaded&&now-timestamp<=400;
 }
}
