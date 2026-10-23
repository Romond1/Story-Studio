import { useLayoutEffect, useRef } from 'react';
import type { SceneObjectPlan } from '../../shared/lesson/projection';
import { bubbleLayout } from '../../shared/lesson/bubbleAppearance';

/** Vectors and logical-unit text fitting are shared by every scene surface. */
export function SceneBubble({object}:{object:Extract<SceneObjectPlan,{kind:'text'|'bubble'}>}) {
  const {style,rect,transform}=bubbleLayout(object.bubbleDefId,object.bubbleTail);
  const text=useRef<HTMLSpanElement>(null);
  const width=object.box.width*rect.width,height=object.box.height*rect.height;
  const maximum=object.fontSize*Math.min(1,object.box.width/360,object.box.height/170);
  useLayoutEffect(()=>{
    const node=text.current;if(!node)return;
    const fit=()=>{
      let low=.01,high=Math.max(low,maximum);
      const fits=(size:number)=>{node.style.fontSize=`${size}px`;const area=node.parentElement!;return node.scrollWidth<=area.clientWidth&&node.scrollHeight<=area.clientHeight;};
      if(fits(high))return;
      for(let n=0;n<18;n++){const middle=(low+high)/2;if(fits(middle))low=middle;else high=middle;}
      node.style.fontSize=`${low}px`;
    };
    fit();document.fonts?.addEventListener('loadingdone',fit);
    return()=>document.fonts?.removeEventListener('loadingdone',fit);
  },[object.text,object.fontSize,object.align,width,height,maximum]);
  return <div className="lesson-vector-bubble" data-bubble-shape={style.shape} data-bubble-tail={style.tail?(object.bubbleTail??'bottom-left'):'none'}>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <g transform={transform} fill="#ffffff" stroke="#263448" strokeWidth="1.2" strokeLinejoin="round">
        {style.shape==='speech'?<path d="M 13 4 H 87 Q 98 4 98 16 V 64 Q 98 77 85 77 H 42 L 22 96 L 26 77 H 13 Q 2 77 2 64 V 17 Q 2 4 13 4 Z"/>
          :style.shape==='thought'?<><path d="M 16 16 C 12 2 34 0 39 9 C 48 -1 65 1 69 10 C 83 0 96 12 91 24 C 104 31 99 49 91 51 C 103 65 90 79 77 74 C 65 88 53 81 48 76 C 34 87 20 78 20 71 C 3 76 -2 55 7 48 C -4 36 2 19 16 16 Z"/><ellipse cx="23" cy="87" rx="6" ry="5"/><ellipse cx="14" cy="96" rx="3" ry="2.5"/></>
          :style.shape==='shout'?<path d="M 50 2 L 58 15 L 76 5 L 75 22 L 94 16 L 86 34 L 99 42 L 88 53 L 97 68 L 79 69 L 82 89 L 63 80 L 53 98 L 44 82 L 25 94 L 25 75 L 5 80 L 14 61 L 1 51 L 14 39 L 4 22 L 23 25 L 24 7 L 41 17 Z"/>
          :style.shape==='oval'?<path d="M 26 73 C -10 60 -4 3 50 3 C 110 3 110 77 50 77 H 42 L 22 96 L 26 73 Z"/>
          :<rect x="2" y="2" width="96" height="96"/>}
      </g>
    </svg>
    <div className="lesson-bubble-text-area" style={{position:'absolute',left:`${rect.x*100}%`,top:`${rect.y*100}%`,width:`${rect.width*100}%`,height:`${rect.height*100}%`,display:'flex',alignItems:'center',overflow:'hidden'}}>
      <span ref={text} className="lesson-bubble-text" style={{display:'block',flexShrink:0,width:'100%',fontSize:maximum,lineHeight:1.05,color:object.color,textAlign:object.align,whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{object.text}</span>
    </div>
  </div>;
}
