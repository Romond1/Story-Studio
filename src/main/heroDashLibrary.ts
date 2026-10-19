import {promises as fs} from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {importProjectMedia,detectMediaType} from './mediaImportService';
import {parseDashConfig,type DashConfig} from '../shared/heroDash';
import type {AssetItem} from '../shared/types';
import type {DashLibrarySnapshot,DashLibraryImage} from '../shared/heroDashLibrary';
interface Index {version:1;images:AssetItem[];collections:{id:string;config:DashConfig;updatedAt:string}[]}
/** App-owned review collections. Files are never appended to the active episode. */
export class HeroDashLibrary {
 constructor(private root:string){}
 private async read():Promise<Index>{try{const data=JSON.parse(await fs.readFile(path.join(this.root,'library.json'),'utf8'));if(data.version!==1||!Array.isArray(data.images)||!Array.isArray(data.collections))throw Error('Invalid review library');return data;}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {version:1,images:[],collections:[]};throw e;}}
 private async write(data:Index){await fs.mkdir(this.root,{recursive:true});const tmp=path.join(this.root,`library-${randomUUID()}.tmp`);await fs.writeFile(tmp,JSON.stringify(data));await fs.rename(tmp,path.join(this.root,'library.json'));}
 private image(asset:AssetItem):DashLibraryImage{return {id:asset.id,name:asset.originalName,url:`media://hero-dash/${asset.id}`};}
 async list():Promise<DashLibrarySnapshot>{const data=await this.read();return {images:data.images.map(a=>this.image(a)),collections:data.collections.map(c=>({id:c.id,title:c.config.title,updatedAt:c.updatedAt}))};}
 async importImages(paths:string[]){
  if(!Array.isArray(paths)||paths.length>500||paths.some(p=>typeof p!=='string'||!path.isAbsolute(p)))throw Error('Choose up to 500 image files.');
  const accepted:string[]=[],failures:{name:string;reason:string}[]=[];
  for(const file of paths){try{const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>50*1024*1024||detectMediaType(path.extname(file))!=='image')throw Error('Use PNG, JPG, WebP, GIF or BMP images under 50 MB.');accepted.push(file);}catch(e){failures.push({name:path.basename(file),reason:e instanceof Error?e.message:'Could not read file'});}}
  const data=await this.read(),result=await importProjectMedia(this.root,accepted,'hero-dash');data.images.push(...result.importedAssets);await this.write(data);
  return {images:result.importedAssets.map(a=>this.image(a)),failures:[...failures,...(result.failures??[])]};
 }
 async saveCollection(id:string|undefined,raw:DashConfig,capture:(ref:string)=>Promise<{bytes:Uint8Array;name:string}>){
  const config=parseDashConfig(raw),data=await this.read(),mapped=new Map<string,string>();
  const refs=[...config.cards,...(config.importedImages??[]).map(ref=>mapped.get(ref)??ref).filter(ref=>ref.startsWith('asset:')).map(image=>({image}))];
  for(const card of refs){if(card.image.startsWith('dash:'))continue;if(!mapped.has(card.image)){
   const {bytes,name}=await capture(card.image);if(bytes.byteLength>50*1024*1024)throw Error('Review image exceeds 50 MB.');
   const hash=createHash('sha256').update(bytes).digest('hex');const ext=detectMediaType(path.extname(name))==='image'?path.extname(name).toLowerCase():'.png';
   let asset=data.images.find(a=>a.filename===`${hash}${ext}`);
   if(!asset){const assetId=randomUUID(),filename=`${hash}${ext}`;await fs.mkdir(path.join(this.root,'assets'),{recursive:true});await fs.writeFile(path.join(this.root,'assets',filename),bytes);asset={id:assetId,filename,originalName:name,relativePath:`assets/${filename}`,mediaType:'image',sizeBytes:bytes.byteLength,importedAt:new Date().toISOString()};data.images.push(asset);}
   mapped.set(card.image,`dash:${asset.id}`);
  }card.image=mapped.get(card.image)!;}
  config.importedImages=[...new Set([...(config.importedImages??[]).map(ref=>mapped.get(ref)??ref),...config.cards.map(c=>c.image).filter(ref=>ref.startsWith('dash:'))])];
  for(const ref of config.importedImages)if(!data.images.some(a=>`dash:${a.id}`===ref))throw Error('An imported image is missing from the review library.');
  const collectionId=id&&data.collections.some(c=>c.id===id)?id:randomUUID();data.collections=data.collections.filter(c=>c.id!==collectionId);data.collections.push({id:collectionId,config,updatedAt:new Date().toISOString()});await this.write(data);return {id:collectionId,config};
 }
 async loadCollection(id:string){const collection=(await this.read()).collections.find(c=>c.id===id);if(!collection)throw Error('Review collection not found.');return parseDashConfig(collection.config);}
 async resolveUrl(raw:string):Promise<string|null>{try{const url=new URL(raw);if(url.protocol!=='media:'||url.hostname!=='hero-dash'||!/^\/[a-zA-Z0-9-]{1,200}$/.test(url.pathname))return null;const asset=(await this.read()).images.find(a=>a.id===url.pathname.slice(1));if(!asset||asset.relativePath!==`assets/${asset.filename}`||path.basename(asset.filename)!==asset.filename)return null;const target=path.resolve(this.root,asset.relativePath),root=await fs.realpath(this.root),real=await fs.realpath(target);if(!real.startsWith(root+path.sep))return null;return real;}catch{return null;}}
}

