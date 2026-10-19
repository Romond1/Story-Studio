import {useEffect,useRef,useState,type RefObject} from 'react';
import type {DashView} from '../../../shared/heroDash';
import {positiveDashReward} from '../../../shared/heroDashRewards';
const colors=['#ff626d','#ffba52','#ffe46b','#77dca0','#70c7ff','#b993ff'];
export function DashRewards({view,host}:{view:DashView;host:RefObject<HTMLDivElement>}){
 const previous=useRef(view),timer=useRef<ReturnType<typeof setTimeout>>(),winnerTimer=useRef<ReturnType<typeof setTimeout>>();
 const [correct,setCorrect]=useState<{racer:0|1;key:number}|null>(null),[winner,setWinner]=useState<number|null>(null);
 useEffect(()=>{
  const old=previous.current;previous.current=view;
  if(view.level!==old.level||view.effect<old.effect||view.scores.some((s,i)=>s<old.scores[i])||view.status==='ready'){clearTimeout(timer.current);clearTimeout(winnerTimer.current);setCorrect(null);setWinner(null);return;}
  const racer=positiveDashReward(old,view);
  if(racer!==null){clearTimeout(timer.current);setCorrect({racer,key:view.effect});timer.current=setTimeout(()=>setCorrect(null),Math.min(12000,(view.positions[racer]-old.positions[racer])*1000+2100));}
  if(view.effect>old.effect&&racer===null){clearTimeout(timer.current);setCorrect(null);}
  if(view.status!=='finished'){clearTimeout(winnerTimer.current);setWinner(null);}
 },[view]);
 useEffect(()=>{
  const element=host.current;if(!element)return;
  const celebrate=(event:Event)=>{const racer=(event as CustomEvent<number>).detail;if(racer!==0&&racer!==1)return;clearTimeout(timer.current);clearTimeout(winnerTimer.current);setCorrect(null);setWinner(racer);winnerTimer.current=setTimeout(()=>setWinner(null),10000);};
  element.addEventListener('dash-finish-arrived',celebrate);
  return()=>{element.removeEventListener('dash-finish-arrived',celebrate);clearTimeout(timer.current);clearTimeout(winnerTimer.current);};
 },[host]);
 const big=winner!==null;
 if(!big&&!correct)return null;
 return <div key={big?`winner-${view.level}`:correct!.key} className={`dash-reward ${big?'dash-reward-winner':'dash-reward-correct'}`} data-reward={big?'winner':'correct'} role="status" aria-live="polite">
  <div className="dash-reward-confetti" aria-hidden="true">{Array.from({length:big?64:30},(_,i)=><i key={i} style={{left:`${(i*37)%100}%`,background:colors[i%6],animationDelay:`${i%9*.13}s`,animationDuration:`${2+i%4*.3}s`}}/>)}</div>
  {big&&<div className="dash-reward-balloons" aria-hidden="true">{Array.from({length:8},(_,i)=><i key={i} style={{left:`${4+i*13}%`,background:colors[i%6],animationDelay:`${i%4*.35}s`}}/>)}</div>}
  <div className="dash-reward-message">
   {!big&&<svg className="dash-reward-rainbow" viewBox="0 0 240 125" aria-hidden="true">{colors.map((color,i)=><path key={color} d={`M ${12+i*12} 120 A ${108-i*12} ${108-i*12} 0 0 1 ${228-i*12} 120`} fill="none" stroke={color} strokeWidth="12"/>)}</svg>}
   <strong>{big?'The winner is…':'Correct!'}</strong><span>{view.names[big?winner!:correct!.racer]}{big?'!':' · Great work!'}</span>
  </div>
 </div>;
}
