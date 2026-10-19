import {useEffect,useRef,useState} from 'react';
import {fitDashQuestion} from '../../../shared/heroDashQuestionLayout';
export function DashQuestionOverlay({question,onStatus}:{question?:{image:string;text:string};onStatus:(status:'loading'|'ready'|'error',src?:string)=>void}) {
 const [displayed,setDisplayed]=useState<typeof question>(),[visible,setVisible]=useState(false);
 const root=useRef<HTMLDivElement>(null),[natural,setNatural]=useState({width:1,height:1}),[size,setSize]=useState<{width:number;height:number}>();
 const callback=useRef(onStatus);callback.current=onStatus;
 useEffect(()=>{
  let active=true;let timer:ReturnType<typeof setTimeout>|undefined;
  if(!question){setVisible(false);callback.current('ready');timer=setTimeout(()=>setDisplayed(undefined),320);return ()=>clearTimeout(timer);}
  callback.current('loading',question.image);const image=new Image();
  image.onload=()=>{if(!active)return;setNatural({width:image.naturalWidth,height:image.naturalHeight});setDisplayed(question);setVisible(true);callback.current('ready',question.image);};
  image.onerror=()=>{if(!active)return;setVisible(false);setDisplayed(undefined);callback.current('error',question.image);};image.src=question.image;
  return ()=>{active=false;image.onload=null;image.onerror=null;if(timer)clearTimeout(timer);};
 },[question?.image,question?.text]);
 useEffect(()=>{
  const element=root.current;if(!element||!displayed)return;
  const measure=()=>{const viewport=element.getBoundingClientRect();
   const next=fitDashQuestion(viewport,natural,[],displayed.text?76:0);setSize(previous=>previous?.width===next.width&&previous.height===next.height?previous:next);
  };
  measure();const resize=new ResizeObserver(measure);resize.observe(element);return ()=>resize.disconnect();
 },[displayed,natural]);
 return displayed?<div ref={root} className="dash-question" data-visible={visible} aria-hidden={!visible}><div className="dash-question-veil"/><figure style={size?{width:size.width,height:size.height}:undefined}><img src={displayed.image} alt={displayed.text||'Review question image'} onError={()=>{setVisible(false);setDisplayed(undefined);callback.current('error',displayed.image);}}/>{displayed.text&&<figcaption>{displayed.text}</figcaption>}</figure></div>:null;
}

