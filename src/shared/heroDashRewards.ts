import type {DashView} from './heroDash';
export function positiveDashReward(previous:DashView,next:DashView):0|1|null {
 if(previous.status!=='playing'||previous.level!==next.level||next.effect<=previous.effect||next.status==='ready')return null;
 for(const racer of [0,1] as const)if(next.scores[racer]>previous.scores[racer]&&next.positions[racer]>previous.positions[racer])return racer;
 return null;
}
export function cheerPose(elapsed:number,count=3){
 const jumps=Math.min(count,Math.max(0,Math.floor(elapsed/.65))),done=elapsed>=count*.65;
 return {height:done?0:Math.max(0,Math.sin((elapsed% .65)/.65*Math.PI))*.78,arms:done?0:1,jumps,done};
}
