import { realpathSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { MediaType } from '../shared/types';
import type { MediaDiagnostic, MediaFailureCode, MediaManifestRequest, MediaResolveRequest, MediaResolveResult } from '../shared/mediaRegistryProtocol';
import { canonicalMediaPath } from '../shared/content/mediaResolution';
const inside=(root:string,file:string)=>{const rel=path.relative(root,file);return !!rel && rel!=='..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);};
function safePath(value:unknown): value is string {
 return typeof value==='string' && !!value && !/[\\\x00-\x1f:?#]/.test(value) && !value.startsWith('/') && value.split('/').every(segment=>!!segment && segment!=='.' && segment!=='..' && !/[. ]$/.test(segment));
}
type Entry={relativePath:string;mediaType:MediaType;error?:MediaFailureCode};
/** Runtime access index only. Authored records remain owned by Control's immutable document. */
export class MediaRegistryService {
 private active: {id:string;folder:string;root:string;revision:number;entries:Map<string,Entry>;legacy:Set<string>;grants:Map<string,string>} | null=null;
 activate(folder:string){this.active={id:randomUUID(),folder,root:realpathSync(folder),revision:-1,entries:new Map(),legacy:new Set(),grants:new Map()};return {id:this.active.id};}
 isCurrent(leaseId:string,revision:number){return !!this.active && this.active.id===leaseId && this.active.revision===revision;}
 getLease(folder:string){return this.active?.folder===folder?{id:this.active.id,revision:this.active.revision}:null;}
 register(request:MediaManifestRequest):{ok:boolean;diagnostics:MediaDiagnostic[]} {
 const active=this.active; const diagnostics:MediaDiagnostic[]=[];
 if(!active || !request || request.leaseId!==active.id || request.expectedFolder!==active.folder || !Number.isSafeInteger(request.revision) || request.revision<=active.revision)return {ok:false,diagnostics:[{code:'stale-project'}]};
 if(!Array.isArray(request.assets)||!Array.isArray(request.legacyPaths)||request.assets.length>100000||request.legacyPaths.length>100000)return {ok:false,diagnostics:[{code:'unregistered'}]};
 const entries=new Map<string,Entry>(); const paths=new Map<string,string[]>();
 for(const asset of request.assets){
 if(!asset || typeof asset.id!=='string' || !asset.id || !['image','audio','video'].includes(asset.mediaType))return {ok:false,diagnostics:[{code:'unregistered'}]};
 const error=entries.has(asset.id)?'ambiguous':safePath(asset.relativePath)?undefined:'unsafe-path';
 entries.set(asset.id,{relativePath:asset.relativePath,mediaType:asset.mediaType,error});
 if(error)diagnostics.push({code:error,assetId:asset.id});
 if(safePath(asset.relativePath))paths.set(asset.relativePath,[...(paths.get(asset.relativePath)??[]),asset.id]);
 }
 for(const [relativePath,ids] of paths)if(ids.length>1)for(const id of ids){entries.get(id)!.error='ambiguous';diagnostics.push({code:'ambiguous',assetId:id,path:relativePath});}
 const legacy=new Set<string>();for(const value of request.legacyPaths){if(safePath(value))legacy.add(value);else diagnostics.push({code:'unsafe-path',path:typeof value==='string'?value:undefined});}
 active.entries=entries;active.legacy=legacy;active.revision=request.revision;active.grants.clear();return {ok:true,diagnostics};
 }
 private async checkedPath(root:string,relativePath:string):Promise<string|null>{
 if(!safePath(relativePath))return null; const candidate=path.resolve(root,relativePath);if(!inside(root,candidate))return null;
 const real=await fs.realpath(candidate);if(!inside(root,real))return null;return (await fs.stat(real)).isFile()?real:null;
 }
 async resolve(request:MediaResolveRequest):Promise<MediaResolveResult>{
 const active=this.active;if(!active||!request||request.leaseId!==active.id||request.revision!==active.revision)return {ok:false,code:'stale-project'};
 let relativePath:string;let mediaType:MediaType|undefined;
 if(typeof request.assetId==='string'){const entry=active.entries.get(request.assetId);if(!entry)return {ok:false,code:'unregistered'};if(entry.error)return {ok:false,code:entry.error};if(request.expectedType && request.expectedType!==entry.mediaType)return {ok:false,code:'wrong-type'};relativePath=entry.relativePath;mediaType=entry.mediaType;}
 else if(typeof request.legacyPath==='string' && active.legacy.has(request.legacyPath))relativePath=request.legacyPath;
 else return {ok:false,code:'unregistered'};
 try {const file=await this.checkedPath(active.root,relativePath);if(this.active!==active||active.revision!==request.revision)return {ok:false,code:'stale-project'};if(!file)return {ok:false,code:'unsafe-path'};
 const grant=randomUUID();active.grants.set(grant,relativePath);return {ok:true,url:`media://scoped/${active.id}/${grant}`,assetId:request.assetId,mediaType};
 }catch{return {ok:false,code:this.active!==active||active.revision!==request.revision?'stale-project':'missing'};}
 }
 /** Compatibility URLs use the same pinned root and filesystem containment checks. */
 async resolveLegacyUrl(url: string): Promise<string | null> {
  const active = this.active;
  if (!active) return null;
  try {
   if (!url.startsWith('media://') || url.startsWith('media://scoped/')) return null;
   const relativePath = canonicalMediaPath(url);
   if (!relativePath) return null;
   const result = await this.checkedPath(active.root, relativePath);
   return this.active === active ? result : null;
  } catch { return null; }
 }
 async resolveUrl(url:string):Promise<string|null>{
 try {const parsed=new URL(url);const parts=parsed.pathname.split('/');const active=this.active;if(parsed.protocol!=='media:'||parsed.hostname!=='scoped'||!active||parts.length!==3||parts[1]!==active.id)return null;const relativePath=active.grants.get(parts[2]);if(!relativePath)return null;const revision=active.revision;const result=await this.checkedPath(active.root,relativePath);return this.active===active && active.revision===revision?result:null;}catch{return null;}
 }
}
