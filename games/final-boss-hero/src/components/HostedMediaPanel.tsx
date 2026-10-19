import { useEffect, useRef, useState, useSyncExternalStore, type ComponentProps, type CSSProperties } from 'react';
import { getHostedBossSession, type HostedBossSession } from '../hosted/hostedSession';
import type { EditorAsset } from '../../../../src/shared/modules/protocol';

const DRAG='application/x-story-studio-asset';
/** Accept drops over the complete field, including its read-only input. */
export function useHostedMediaDrop<T extends HTMLElement>(kind:string,onAssign:((ref:string)=>void|Promise<void>)|undefined,field=false,onMessage?:(text:string)=>void){
  const ref=useRef<T>(null);
  const session=getHostedBossSession();
  useEffect(()=>{
    const element=ref.current;
    const target=field?element?.closest('label')??element:element;
    if(!target||!session||!onAssign)return;
    target.classList.add('hosted-drop-surface');
    const over=(event:DragEvent)=>{if(!event.dataTransfer?.types.includes(DRAG))return;event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='copy';target.classList.add('is-drag-over');};
    const leave=(event:DragEvent)=>{if(!target.contains(event.relatedTarget as Node|null))target.classList.remove('is-drag-over');};
    const drop=(event:DragEvent)=>{
      if(!event.dataTransfer?.types.includes(DRAG))return;
      event.preventDefault();event.stopPropagation();target.classList.remove('is-drag-over');
      const asset=session.assets().find(item=>item.id===event.dataTransfer!.getData(DRAG));
      if(!asset?.url||asset.mediaType!==kind){onMessage?.(`Drop an available ${kind} here.`);return;}
      void Promise.resolve(onAssign(`asset:${asset.id}`)).then(()=>onMessage?.(`Assigned ${asset.name}`)).catch(error=>onMessage?.(String(error)));
    };
    target.addEventListener('dragover',over as EventListener);target.addEventListener('dragenter',over as EventListener);target.addEventListener('dragleave',leave as EventListener);target.addEventListener('drop',drop as EventListener);
    return()=>{target.classList.remove('hosted-drop-surface','is-drag-over');target.removeEventListener('dragover',over as EventListener);target.removeEventListener('dragenter',over as EventListener);target.removeEventListener('dragleave',leave as EventListener);target.removeEventListener('drop',drop as EventListener);};
  },[session,kind,onAssign,field,onMessage]);
  return ref;
}
export function MediaReferenceInput({allowLiteral=false,...props}:ComponentProps<'input'>&{allowLiteral?:boolean}){
  const session=getHostedBossSession();
  const assets=useSyncExternalStore(session?.subscribeMedia??(()=>()=>{}),session?.assets??(()=>emptyAssets));
  const value=String(props.value??'');
  const assigned=assets.find(asset=>value===`asset:${asset.id}`||value===asset.url);
  // CSS backgrounds and emoji icons remain editable using the original controls.
  if(!session||(allowLiteral&&!assigned&&!/^(asset:|media:|blob:|data:|https?:|file:)/i.test(value)))return <input {...props}/>;
  return <input {...props} readOnly value={assigned?.name||(value?'Missing asset — replace or clear below':'')} placeholder="No media assigned" title={assigned?.name||(value?'This media is unavailable. Select a replacement or import it.':'Choose from the episode media pool')}/>;
}
const emptyAssets:EditorAsset[]=[];
export function HostedMediaPanel({session}:{session:HostedBossSession}){
  const assets=useSyncExternalStore(session.subscribeMedia,session.assets);
  const selected=useSyncExternalStore(session.subscribeMedia,session.selected);
  const [query,setQuery]=useState(''),[kind,setKind]=useState('all'),[open,setOpen]=useState(true);
  const [thumbnailSize,setThumbnailSize]=useState(150);
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const refresh=async()=>{try{await session.requestEditor('media-list');}catch(error){setMessage(String(error));}};
  useEffect(()=>{void refresh();},[session]);
  const importMedia=async()=>{setBusy(true);setMessage('');try{const result=await session.requestEditor('media-import');if(result.importedIds?.length)session.select(result.importedIds[0]);setMessage(result.reason|| (result.cancelled?'Import cancelled.':`${result.importedIds?.length??0} assets added to the episode.`));}catch(error){setMessage(String(error));}finally{setBusy(false);}};
  const rows=assets.filter(asset=>(kind==='all'||asset.mediaType===kind)&&asset.name.toLowerCase().includes(query.toLowerCase()));
  const preview=assets.find(asset=>asset.id===selected);
  return <aside className={`hosted-media-panel ${open?'':'is-collapsed'}`} aria-label="Episode Media Pool">
    <button type="button" className="hosted-panel-toggle" aria-expanded={open} onClick={()=>setOpen(!open)}>{open?'▾':'▸'} Episode Media Pool <small>{assets.length}</small></button>
    {open&&<div className="hosted-pool-content">
      <div className="hosted-pool-actions"><button type="button" disabled={busy} onClick={()=>void importMedia()}>{busy?'Importing…':'Import media'}</button><button type="button" disabled={busy} onClick={()=>void refresh()}>Refresh</button></div>
      <input type="search" aria-label="Search episode media" placeholder="Search episode media…" value={query} onChange={e=>setQuery(e.target.value)}/>
      <select aria-label="Media type" value={kind} onChange={e=>setKind(e.target.value)}><option value="all">All media</option><option value="image">Images</option><option value="video">Videos</option><option value="audio">Audio</option></select>
      <label className="hosted-thumbnail-size">Thumbnails<input type="range" aria-label="Thumbnail size" min="130" max="240" step="10" value={thumbnailSize} onChange={e=>setThumbnailSize(Number(e.target.value))}/></label>
      <p className="hosted-pool-help">Drag onto an image field or card preview. Or select a thumbnail, then click “Media pool” at the field.</p>
      {message&&<p role="status">{message}</p>}
      {assets.some(asset=>!asset.url)&&<p role="alert">Some media is missing. Import a replacement, select it, and assign it to the affected fields. Existing references are retained until you replace or clear them.</p>}
      <div className="hosted-asset-list" role="listbox" aria-label="Episode assets" style={{'--thumbnail-size':`${thumbnailSize}px`} as CSSProperties}>
        {rows.map(asset=><button type="button" role="option" aria-label={`${asset.name} · ${asset.mediaType}${!asset.url?' · unavailable':''}`} title={asset.name} aria-selected={selected===asset.id} key={asset.id} draggable={!!asset.url&&asset.mediaType!=='audio'} onDragStart={e=>{e.dataTransfer.setData(DRAG,asset.id);e.dataTransfer.setData('text/plain',`asset:${asset.id}`);e.dataTransfer.effectAllowed='copy';}} onClick={()=>session.select(asset.id)}>
          <span className="hosted-asset-thumb">{asset.url?(asset.mediaType==='image'?<img src={asset.url} alt="" loading="lazy" draggable={false}/>:asset.mediaType==='video'?<video src={asset.url} muted preload="metadata"/>:'♫'):'Missing'}</span>
          <small className="hosted-asset-kind">{asset.mediaType==='video'?'▶ Video':asset.mediaType==='audio'?'♫ Audio':'Image'}{!asset.url?' · unavailable':''}</small>
        </button>)}
      </div>
      {!rows.length&&<p>{assets.length?'No matching media.':'Import media to start. Assets are shared with the episode.'}</p>}
      {preview?.url&&<details className="hosted-asset-preview"><summary>Preview {preview.name}</summary>{preview.mediaType==='video'?<video src={preview.url} controls preload="metadata"/>:preview.mediaType==='image'?<img src={preview.url} alt={preview.name}/>:<audio src={preview.url} controls/>}</details>}
    </div>}
  </aside>;
}

/** Shared controls for the editor's existing upload fields; no gameplay changes. */
export function HostedMediaTarget({accept,onAssign}:{accept:string;onAssign:(ref:string)=>void|Promise<void>}){
  const session=getHostedBossSession()!;
  const assets=useSyncExternalStore(session.subscribeMedia,session.assets);
  const selected=useSyncExternalStore(session.subscribeMedia,session.selected);
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const kind=accept.includes('video')?'video':'image';
  const dropRef=useHostedMediaDrop<HTMLSpanElement>(kind,onAssign,true,setMessage);
  const assign=async(asset?:EditorAsset)=>{
    if(!asset||asset.mediaType!==kind||!asset.url){setMessage(`Select an available ${kind} in the Episode Media Pool.`);return;}
    await onAssign(`asset:${asset.id}`);setMessage(`Assigned ${asset.name}`);
  };
  return <span ref={dropRef} className="hosted-media-target" role="group" aria-label={`${kind} media assignment`}>
    <small className="hosted-drop-hint">Drop {kind} here</small>
    <span className="hosted-target-actions"><button type="button" title={`Use the ${kind} selected in the media pool`} onClick={()=>void assign(assets.find(asset=>asset.id===selected)).catch(error=>setMessage(String(error)))}>Media pool</button>
      <button type="button" title={`Import ${kind} from your computer`} disabled={busy} onClick={async()=>{setBusy(true);setMessage('');try{const result=await session.requestEditor('media-import');if(result.cancelled){setMessage('Import cancelled.');return;}const imported=session.assets().filter(asset=>result.importedIds?.includes(asset.id)&&asset.mediaType===kind);if(imported.length===1){session.select(imported[0].id);await assign(imported[0]);}else setMessage('Select an imported asset in the pool, then assign it.');if(result.reason)setMessage(result.reason);}catch(error){setMessage(String(error));}finally{setBusy(false);}}}>{busy?'Importing…':'Import'}</button>
      <button type="button" title="Remove media from this field; keep it in the pool" onClick={async()=>{try{await onAssign('');setMessage('Cleared this field. Media stays in the pool.');}catch(error){setMessage(String(error));}}}>Clear</button></span>
    {message&&<small role="status">{message}</small>}
  </span>;
}
