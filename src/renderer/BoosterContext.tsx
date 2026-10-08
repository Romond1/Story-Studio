import { useState } from 'react';
import type { ProjectData, SequenceItem } from '../shared/types';

export function BoosterContext({data,tab,item,index,count,onTab,onReturn,onSelect,onMedia,onReuse,onIndependent,onPrompt,onCards,onBreak}: {
  data:ProjectData;tab:'activation'|'language'|'games'|'badge';item:SequenceItem|null;index:number;count:number;
  onTab:(tab:'activation'|'language'|'games')=>void;onReturn:()=>void;onSelect:(direction:-1|1)=>void;
  onMedia:(assetId:string)=>void;onReuse:(slideId:string,independent:boolean)=>void;onIndependent:()=>void;onPrompt:()=>void;onCards:()=>void;onBreak:(id:string)=>void;
}) {
  const [slideId,setSlideId]=useState(''),[independent,setIndependent]=useState(false);
  return <section className="booster-context" aria-label="Booster editing context">
    <div className="booster-breadcrumb"><span>Lesson › Boosters › {tab[0].toUpperCase()+tab.slice(1)}</span></div>
    <div className="booster-navigation"><label>Booster <select aria-label="Edit Booster" value={tab==='badge'?'activation':tab} onChange={e=>onTab(e.target.value as 'activation'|'language'|'games')}><option value="activation">Activation</option><option value="language">Language</option><option value="games">Games</option></select></label><button disabled={index<=0} onClick={()=>onSelect(-1)}>Previous item</button><span>{count ? `${index+1} / ${count}` : 'Empty sequence'}</span><button disabled={index<0||index>=count-1} onClick={()=>onSelect(1)}>Next item</button></div>
    {item?.type==='slideRef'&&<p>{item.independentCopyOf?'Independent slide copy: edits leave the original unchanged. The copy is stored with lesson slides.':'Reused slide: edits update its Story content.'} {!item.independentCopyOf&&<button onClick={onIndependent}>Make Independent Copy</button>}</p>}
    <details><summary>Add Booster content</summary><div className="booster-add">
      <button onClick={onCards}>New Card canvas</button><button onClick={onPrompt}>Add Prompt / Question</button>
      <label>Use Existing Break<select aria-label="Existing Break" value="" onChange={e=>{if(e.target.value)onBreak(e.target.value);}}><option value="">Choose Break…</option>{data.sections.filter(s=>s.type==='break').map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label><label>Add Image / Video<select aria-label="Add Booster media" value="" onChange={e=>{if(e.target.value)onMedia(e.target.value);}}><option value="">Choose from Media Pool…</option>{data.assets.filter(a=>a.mediaType==='image'||a.mediaType==='video').map(a=><option key={a.id} value={a.id}>{a.originalName||a.filename} · {a.mediaType}</option>)}</select></label>
      <label>Use Existing Slide<select aria-label="Existing Story Slide" value={slideId} onChange={e=>setSlideId(e.target.value)}><option value="">Choose a Story slide…</option>{data.slides.map((s,i)=><option value={s.id} key={s.id}>{s.name||`Slide ${i+1}`}</option>)}</select></label>
      <label><input type="checkbox" checked={independent} onChange={e=>setIndependent(e.target.checked)}/> Make independent copy</label>
      <button disabled={!data.slides.some(s=>s.id===slideId)} onClick={()=>onReuse(slideId,independent)}>{independent?'Add Independent Copy':'Reuse Slide'}</button>
    </div></details>
  </section>;
}
