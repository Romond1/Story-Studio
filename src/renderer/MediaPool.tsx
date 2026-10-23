import { useMediaPoolZoom, MediaPoolZoom } from './MediaPoolZoom';
import { useEffect, useMemo, useState, type DragEvent } from 'react';
import type { MediaBin, ProjectData } from '../shared/types';
import { getAssetDisplayLabel } from '../shared/mediaReferences';
import { createMediaRegistry } from '../shared/content/mediaRegistry';
import { mediaDisplayName, renameMediaAsset } from '../shared/mediaDisplayName';
import { MediaPoolThumbnail } from './MediaPoolThumbnail';
import { MediaAssetPreview } from './MediaAssetPreview';
import { MediaPoolContextMenu, type MediaPoolMenuTarget } from './MediaPoolContextMenu';
import { groupMediaByType, removeFromMediaPool, renameMediaBin, removeMediaBin } from '../shared/mediaPool';
export const POOL_DRAG='application/x-story-studio-assets';
export const SLIDE_DRAG='application/x-story-studio-slide';
export function droppedPaths(event:DragEvent):string[]{
  return Array.from(event.dataTransfer.files).map(file=>window.appApi.getPathForFile(file)).filter(Boolean);
}
export function MediaPool({data,onChange,onImport,onAttachAudio,onInsert,resolveUrl,busy,focusContentKey}:{data:ProjectData;onChange:(data:ProjectData)=>void;
  onInsert?: (ids:string[])=>void;
  onAttachAudio:(id:string,kind:'dialogue'|'sfx'|'bgm'|'section-bgm')=>void;
  onImport:(kind:'files'|'folder'|'drop',paths?:string[],binId?:string)=>Promise<void>;resolveUrl:(path:string)=>string;busy:boolean;focusContentKey?:string}) {
  const poolZoom = useMediaPoolZoom();
  const [open,setOpen]=useState(true),[bin,setBin]=useState(''),[query,setQuery]=useState(''),[type,setType]=useState('all'),[usage,setUsage]=useState('all');
  useEffect(()=>{if(focusContentKey){setOpen(false);setPreviewId(null);}},[focusContentKey]);
  const [selected,setSelected]=useState<Set<string>>(new Set());
  const [previewId,setPreviewId]=useState<string|null>(null);
  const [context,setContext]=useState<MediaPoolMenuTarget|null>(null);
  const registry=useMemo(()=>createMediaRegistry({format:'legacy',data}),[data]);
  const previewAsset=previewId?registry.get(previewId):undefined;
  useEffect(()=>{if(previewId&&!previewAsset)setPreviewId(null);},[previewId,previewAsset]);
  const counts=useMemo(()=>new Map(registry.list().map(a=>[a.id,registry.usages(a.id).length])),[registry]);
  const bins=registry.bins();
  useEffect(()=>{if(bin&&!bins.some(item=>item.id===bin))setBin('');},[bin,bins]);
  const selectedAudio=selected.size===1?data.assets.find(a=>selected.has(a.id)&&a.mediaType==='audio'):undefined;
  const inBin=(id:string|undefined):boolean=>{const visited=new Set<string>();while(id&&!visited.has(id)){if(id===bin)return true;visited.add(id);id=bins.find(b=>b.id===id)?.parentId;}return !bin;};
  const poolAssets=registry.list().filter(a=>!a.hiddenFromMediaPool);
  const [groupedBins,setGroupedBins]=useState<Set<string>>(new Set());
  const groupingKey=`${data.createdAt}:${bin}`,grouped=groupedBins.has(groupingKey);
  const filteredAssets=poolAssets.filter(a=>inBin(a.binId)&&(type==='all'||a.mediaType===type)&&(usage==='all'||(usage==='used')===!!counts.get(a.id))&&`${mediaDisplayName(a)} ${getAssetDisplayLabel(a,'edit')} ${a.originalName} ${a.filename}`.toLowerCase().includes(query.toLowerCase()));
  const assets=grouped?groupMediaByType(filteredAssets):filteredAssets;
  const binLabel=(b:MediaBin):string=>{const parent=bins.find(p=>p.id===b.parentId);return parent&&parent.id!==b.id?`${parent.name} / ${b.name}`:b.name;};
  const tree=(parent?:string,depth=0):React.ReactNode=>depth>20?null:bins.filter(b=>b.parentId===parent).map(b=><details key={b.id} open={undefined}><summary><button aria-pressed={bin===b.id} onClick={()=>setBin(b.id)}>{b.name}</button></summary>{tree(b.id,depth+1)}</details>);
  return <section ref={poolZoom.ref} style={poolZoom.style} className="media-pool" aria-label="Media Pool" onDragEnter={e=>e.stopPropagation()} onDragOver={e=>{e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='copy';}}
    onDrop={e=>{e.preventDefault();e.stopPropagation();if(e.dataTransfer.types.includes('Files'))void onImport('drop',droppedPaths(e),bin||undefined);}}>
    <header><button onClick={()=>{setOpen(!open);setPreviewId(null);setContext(null);}} aria-expanded={open}>{open?'▾':'▸'} Media Pool</button><MediaPoolZoom zoom={poolZoom.zoom} onChange={poolZoom.setZoom} /></header>
    {open&&<><div className="pool-toolbar"><button disabled={busy} onClick={()=>void onImport('files',undefined,bin||undefined)}>Import Files</button><button disabled={busy} onClick={()=>void onImport('folder',undefined,bin||undefined)}>Import Folder</button>
      <button onClick={()=>{const name=prompt('Bin name');if(name?.trim())onChange({...data,mediaBins:[...bins,{id:crypto.randomUUID(),name:name.trim(),...(bin?{parentId:bin}:{})}]});}}>New bin</button><button disabled={!bin||busy} onClick={()=>{const name=prompt('Rename bin',bins.find(item=>item.id===bin)?.name);if(name!==null)onChange(renameMediaBin(data,bin,name));}}>Rename bin</button><button disabled={!bin||busy} title="Remove this bin; keep its media and nested bins in the parent bin" onClick={()=>{const parent=bins.find(item=>item.id===bin)?.parentId;onChange(removeMediaBin(data,bin));setBin(parent??'');}}>Remove bin</button></div>
      <div style={{display:'flex',gap:5}}><input style={{minWidth:0,flex:1}} aria-label="Search media" placeholder="Search media…" value={query} onChange={e=>setQuery(e.target.value)} /><button aria-label="Group by file type" aria-pressed={grouped} title="Pictures first, then videos; toggle off to restore bin order" onClick={()=>setGroupedBins(previous=>{const next=new Set(previous);next.has(groupingKey)?next.delete(groupingKey):next.add(groupingKey);return next;})}>Type ↕</button></div>
      {(!registry.dependencies().complete || registry.diagnostics().length > 0) && <p role="status">Some media references are missing, ambiguous, or unsupported. Usage is incomplete; all imported media is retained.</p>}
      <div className="pool-filters"><select aria-label="Media type" value={type} onChange={e=>setType(e.target.value)}>{['all','image','video','audio'].map(t=><option key={t} value={t}>{t==='all'?'All types':t}</option>)}</select>
      <select aria-label="Media usage" value={usage} onChange={e=>setUsage(e.target.value)}><option value="all">All usage</option><option value="used">Used</option><option value="unused">Unused</option></select>
      <select aria-label="Move selected media to bin" value="" disabled={!selected.size} onChange={e=>{const id=e.target.value;onChange({...data,assets:data.assets.map(a=>selected.has(a.id)?{...a,binId:id==='root'?undefined:id}:a)});}}><option value="" disabled>Move selected…</option><option value="root">Pool root</option>{bins.map(b=><option value={b.id} key={b.id}>{binLabel(b)}</option>)}</select></div>
      {selectedAudio&&<label>Attach audio to selected lesson object <select aria-label="Attach selected audio" value="" onChange={e=>onAttachAudio(selectedAudio.id,e.target.value as 'dialogue'|'sfx'|'bgm'|'section-bgm')}><option value="" disabled>Choose use…</option><option value="dialogue">Slide dialogue</option><option value="sfx">Slide sound effect</option><option value="bgm">Slide music</option><option value="section-bgm">Section / break music</option></select></label>}
      <div className="pool-body"><aside className="pool-bins" aria-label="Media bins"><button aria-pressed={!bin} onClick={()=>setBin('')}>All media</button>{tree()}</aside>
      <div className="pool-assets" role="listbox" aria-label="Project media" aria-multiselectable="true">{assets.map(a=><button key={a.id} role="option" aria-selected={selected.has(a.id)} className="pool-asset" data-asset-id={a.id} draggable={a.mediaType!=='audio'}
        onContextMenu={e=>{if(a.mediaType==='audio')return;e.preventDefault();e.stopPropagation();e.currentTarget.focus();const r=e.currentTarget.getBoundingClientRect();setSelected(new Set([a.id]));setContext({assetId:a.id,x:e.clientX||r.left,y:e.clientY||r.bottom});}}
        onClick={e=>{setSelected(old=>{if(!e.ctrlKey&&!e.metaKey&&!e.shiftKey)return new Set([a.id]);const next=new Set(old);next.has(a.id)?next.delete(a.id):next.add(a.id);return next;});if(!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&a.mediaType!=='audio')setPreviewId(a.id);}}
        onDragStart={e=>{const ids=data.assets.filter(item=>(selected.has(a.id)?selected.has(item.id):item.id===a.id)&&item.mediaType!=='audio').map(item=>item.id);e.dataTransfer.setData(POOL_DRAG,JSON.stringify(ids));e.dataTransfer.effectAllowed='copy';}}
        title={mediaDisplayName(a)} aria-label={mediaDisplayName(a)}>
        <MediaPoolThumbnail asset={a} src={resolveUrl(a.relativePath)}/></button>)}</div></div>
      {!assets.length&&<p className="pool-hint">{poolAssets.length?'No matching media.':'Import files or drop a folder here to build your library.'}</p>}
      <p className="pool-hint">Ctrl/⌘-click to select several · Drop images/videos onto a timeline item or section</p>
    </>}
    {open&&previewAsset&&<MediaAssetPreview key={previewAsset.id} asset={previewAsset} src={resolveUrl(previewAsset.relativePath)} onClose={()=>setPreviewId(null)}
      onRename={title=>onChange(renameMediaAsset(data,previewAsset.id,title))}/>}
    {open&&context&&poolAssets.some(a=>a.id===context.assetId)&&<MediaPoolContextMenu key={context.assetId} target={context} onClose={()=>setContext(null)}
      onAdd={onInsert?()=>onInsert([context.assetId]):undefined} onRemove={()=>{onChange(removeFromMediaPool(data,context.assetId));setSelected(old=>{const next=new Set(old);next.delete(context.assetId);return next;});}}/>}
  </section>;
}
