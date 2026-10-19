import { useState } from 'react';
import type { HostedBossSession } from '../hosted/hostedSession';
import { stageStandaloneBoss, recoverStandaloneBoss } from '../hosted/standaloneImport';
import { HostedMediaTarget } from './HostedMediaPanel';

export function HostedProjectImport({session}:{session:HostedBossSession}){
  const [staged,setStaged]=useState<ReturnType<typeof stageStandaloneBoss>|null>(null);
  const [replacements,setReplacements]=useState<Record<string,string>>({}),[message,setMessage]=useState('');
  return <details className="hosted-project-import"><summary>Advanced: import standalone game configuration</summary>
    <p>Import replaces this activity’s configuration after review. Scores and local saves are excluded. Recover each unavailable image or video using the episode pool, import a local file, or explicitly clear its assignment.</p>
    <input type="file" aria-label="Import standalone game configuration" accept=".json,application/json" onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;setMessage('');setStaged(null);setReplacements({});try{if(file.size>32*1024*1024)throw new Error('Game file exceeds 32 MB. Export a smaller configuration.');await session.requestEditor('media-list');setStaged(stageStandaloneBoss(JSON.parse(await file.text()),session.assets()));}catch(error){setMessage(String(error));}}}/>
    {staged&&<><p>{staged.config.encounter.name} · {staged.config.cardLibrary.length} cards · {staged.missing.length} media assignments need recovery. Current episode settings remain unchanged until applied.</p>
      {staged.missing.map(item=><div key={item.field} className="hosted-import-missing"><strong>{item.field}</strong><p title={item.original}>Unavailable: {item.original.slice(0,180)}{item.original.length>180?'…':''}</p><HostedMediaTarget accept={`${item.kind}/*`} onAssign={ref=>setReplacements(old=>({...old,[item.field]:ref}))}/>{Object.hasOwnProperty.call(replacements,item.field)&&<small>{replacements[item.field]?'Replacement selected':'Assignment will be cleared'}</small>}</div>)}
      <button type="button" disabled={staged.missing.some(item=>!Object.hasOwnProperty.call(replacements,item.field))} onClick={()=>{try{session.replaceConfig(recoverStandaloneBoss(staged.config,replacements));setStaged(null);setMessage('Configuration applied to the editor. Save the episode to keep it on disk.');}catch(error){setMessage(String(error));}}}>Replace activity configuration</button><button type="button" onClick={()=>setStaged(null)}>Cancel import</button>
    </>}
    {message&&<p role="status">{message}</p>}
  </details>;
}
