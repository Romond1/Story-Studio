import {useEffect,useState} from 'react';
import type {DashLibrarySnapshot} from '../../../shared/heroDashLibrary';
export function useDashLibrary(){
 const [library,setLibrary]=useState<DashLibrarySnapshot>({images:[],collections:[]}),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const refresh=()=>window.appApi.heroDash.list().then(setLibrary);
 useEffect(()=>{void refresh().catch(e=>setNotice(String(e)));},[]);
 const importImages=async(paths?:string[])=>{setBusy(true);setNotice('Importing review images…');try{const result=await window.appApi.heroDash.importImages(paths);await refresh();setNotice([result.images.length?`${result.images.length} images ready`:'',...result.failures.map(f=>`${f.name}: ${f.reason}`)].filter(Boolean).join(' · '));return result.images;}catch(e){setNotice(String(e));return [];}finally{setBusy(false);}};
 return {library,busy,notice,setNotice,refresh,importImages};
}
