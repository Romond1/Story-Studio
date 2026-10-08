import { useEffect, useMemo, useState, type DragEvent } from 'react';
import type { MediaBin, ProjectData } from '../shared/types';
import { getAssetDisplayLabel } from '../shared/mediaReferences';
import { mediaUsage } from '../shared/mediaPool';
export const POOL_DRAG='application/x-story-studio-assets';
export const SLIDE_DRAG='application/x-story-studio-slide';
export function droppedPaths(event:DragEvent):string[]{
  return Array.from(event.dataTransfer.files).map(file=>window.appApi.getPathForFile(file)).filter(Boolean);
}
export function MediaPool({data,onChange,onImport,onAttachAudio,resolveUrl,busy,focusContentKey}:{data:ProjectData;onChange:(data:ProjectData)=>void;
  onAttachAudio:(id:string,kind:'dialogue'|'sfx'|'bgm'|'section-bgm')=>void;
  onImport:(kind:'files'|'folder'|'drop',paths?:string[],binId?:string)=>Promise<void>;resolveUrl:(path:string)=>string;busy:boolean;focusContentKey?:string}) {
  const [open,setOpen]=useState(true),[bin,setBin]=useState(''),[query,setQuery]=useState(''),[type,setType]=useState('all'),[usage,setUsage]=useState('all');
  useEffect(()=>{if(focusContentKey)setOpen(false);},[focusContentKey]);
  const [selected,setSelected]=useState<Set<string>>(new Set());
  const counts=useMemo(()=>new Map(data.assets.map(a=>[a.id,mediaUsage(data,a.id)])),[data]);
  const bins=data.mediaBins??[];
  const selectedAudio=selected.size===1?data.assets.find(a=>selected.has(a.id)&&a.mediaType==='audio'):undefined;
  const inBin=(id:string|undefined):boolean=>{const visited=new Set<string>();while(id&&!visited.has(id)){if(id===bin)return true;visited.add(id);id=bins.find(b=>b.id===id)?.parentId;}return !bin;};
  const assets=data.assets.filter(a=>inBin(a.binId)&&(type==='all'||a.mediaType===type)&&(usage==='all'||(usage==='used')===!!counts.get(a.id))&&`${getAssetDisplayLabel(a,'edit')} ${a.originalName}`.toLowerCase().includes(query.toLowerCase()));
  const binLabel=(b:MediaBin):string=>{const parent=bins.find(p=>p.id===b.parentId);return parent&&parent.id!==b.id?`${parent.name} / ${b.name}`:b.name;};
  const tree=(parent?:string,depth=0):React.ReactNode=>depth>20?null:bins.filter(b=>b.parentId===parent).map(b=><details key={b.id} open={undefined}><summary><button aria-pressed={bin===b.id} onClick={()=>setBin(b.id)}>{b.name}</button></summary>{tree(b.id,depth+1)}</details>);
  return <section className="media-pool" aria-label="Media Pool" onDragEnter={e=>e.stopPropagation()} onDragOver={e=>{e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='copy';}}
    onDrop={e=>{e.preventDefault();e.stopPropagation();if(e.dataTransfer.types.includes('Files'))void onImport('drop',droppedPaths(e),bin||undefined);}}>
    <header><button onClick={()=>setOpen(!open)} aria-expanded={open}>{open?'▾':'▸'} Media Pool</button><small>{data.assets.length} assets</small></header>
    {open&&<><div className="pool-toolbar"><button disabled={busy} onClick={()=>void onImport('files',undefined,bin||undefined)}>Import Files</button><button disabled={busy} onClick={()=>void onImport('folder',undefined,bin||undefined)}>Import Folder</button>
      <button onClick={()=>{const name=prompt('Bin name');if(name?.trim())onChange({...data,mediaBins:[...bins,{id:crypto.randomUUID(),name:name.trim(),...(bin?{parentId:bin}:{})}]});}}>New bin</button></div>
      <input aria-label="Search media" placeholder="Search media…" value={query} onChange={e=>setQuery(e.target.value)} />
      <div className="pool-filters"><select aria-label="Media type" value={type} onChange={e=>setType(e.target.value)}>{['all','image','video','audio'].map(t=><option key={t} value={t}>{t==='all'?'All types':t}</option>)}</select>
      <select aria-label="Media usage" value={usage} onChange={e=>setUsage(e.target.value)}><option value="all">All usage</option><option value="used">Used</option><option value="unused">Unused</option></select>
      <select aria-label="Move selected media to bin" value="" disabled={!selected.size} onChange={e=>{const id=e.target.value;onChange({...data,assets:data.assets.map(a=>selected.has(a.id)?{...a,binId:id==='root'?undefined:id}:a)});}}><option value="" disabled>Move selected…</option><option value="root">Pool root</option>{bins.map(b=><option value={b.id} key={b.id}>{binLabel(b)}</option>)}</select></div>
      {selectedAudio&&<label>Attach audio to selected lesson object <select aria-label="Attach selected audio" value="" onChange={e=>onAttachAudio(selectedAudio.id,e.target.value as 'dialogue'|'sfx'|'bgm'|'section-bgm')}><option value="" disabled>Choose use…</option><option value="dialogue">Slide dialogue</option><option value="sfx">Slide sound effect</option><option value="bgm">Slide music</option><option value="section-bgm">Section / break music</option></select></label>}
      <div className="pool-body"><aside className="pool-bins" aria-label="Media bins"><button aria-pressed={!bin} onClick={()=>setBin('')}>All media</button>{tree()}</aside>
      <div className="pool-assets" role="listbox" aria-label="Project media" aria-multiselectable="true">{assets.map(a=><button key={a.id} role="option" aria-selected={selected.has(a.id)} className="pool-asset" draggable={a.mediaType!=='audio'}
        onClick={e=>setSelected(old=>{if(!e.ctrlKey&&!e.metaKey&&!e.shiftKey)return new Set([a.id]);const next=new Set(old);next.has(a.id)?next.delete(a.id):next.add(a.id);return next;})}
        onDragStart={e=>{const ids=data.assets.filter(item=>(selected.has(a.id)?selected.has(item.id):item.id===a.id)&&item.mediaType!=='audio').map(item=>item.id);e.dataTransfer.setData(POOL_DRAG,JSON.stringify(ids));e.dataTransfer.effectAllowed='copy';}}
        title={`${getAssetDisplayLabel(a,'edit')} · ${counts.get(a.id)} authored references${a.mediaType==='audio'?' · Select to attach to lesson':''}`}>
        <span className="pool-thumb">{a.mediaType==='image'?<img loading="lazy" draggable={false} src={resolveUrl(a.relativePath)} alt=""/>:a.mediaType==='video'?<video src={resolveUrl(a.relativePath)} muted preload="metadata"/>:'♫'}</span>
        <span>{getAssetDisplayLabel(a,'edit')}</span><small>{a.mediaType} · {counts.get(a.id)?`${counts.get(a.id)} uses`:'Unused'}</small></button>)}</div></div>
      {!assets.length&&<p className="pool-hint">{data.assets.length?'No matching media.':'Import files or drop a folder here to build your library.'}</p>}
      <p className="pool-hint">Ctrl/⌘-click to select several · Drop images/videos onto a timeline item or section</p>
    </>}
  </section>;
}
