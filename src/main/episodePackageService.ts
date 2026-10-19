import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { isSafePackagePath, parsePackageManifest, projectAuthoredEpisode, validatePackageClosure, validatePortableEpisode } from '../shared/package/validation';
import { PACKAGE_LIMITS, type PackageManifestV1 } from '../shared/package/model';
import { detectMediaType } from './mediaImportService';
import type { AssetItem } from '../shared/types';
import { collectModuleAssets, remapModuleAssets } from '../shared/modules/media';

const {maxFileBytes:MAX_FILE,maxTotalBytes:MAX_TOTAL,maxJsonBytes:MAX_JSON,maxFiles:MAX_FILES}=PACKAGE_LIMITS;
const digest=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const inside=(root:string,file:string)=>{const r=path.relative(root,file);return !!r&&r!=='..'&&!r.startsWith(`..${path.sep}`)&&!path.isAbsolute(r);};
function safePath(value:string){
 if(!isSafePackagePath(value))throw Error(`Unsafe package path: ${value}`);
 return value;
}
async function fileAt(root:string,relative:string){
 safePath(relative);let current=root;
 for(const segment of relative.split('/')){current=path.join(current,segment);if((await fs.lstat(current)).isSymbolicLink())throw Error('Package symbolic links are unsupported.');}
 const real=await fs.realpath(current);if(!inside(root,real)||!(await fs.stat(real)).isFile())throw Error('Unsafe package containment.');return real;
}
async function jsonAt(root:string,name:string,expected?:{bytes:number;sha256:string}){
 const handle=await fs.open(await fileAt(root,name),'r');const chunks:Buffer[]=[];let size=0;
 try{if((await handle.stat()).size>MAX_JSON)throw Error('Package JSON size limit exceeded.');while(true){const buffer=Buffer.alloc(Math.min(64*1024,MAX_JSON+1-size));const {bytesRead}=await handle.read(buffer,0,buffer.length,null);if(!bytesRead)break;size+=bytesRead;if(size>MAX_JSON)throw Error('Package JSON size limit exceeded.');chunks.push(buffer.subarray(0,bytesRead));}}finally{await handle.close();}
 const bytes=Buffer.concat(chunks),sha256=digest(bytes);if(expected&&(expected.bytes!==size||expected.sha256!==sha256))throw Error('Package JSON hash changed during validation.');return {value:JSON.parse(bytes.toString('utf8')),bytes:size,sha256};
}
async function inventory(root:string){const result:string[]=[];let entries=0;const walk=async(folder:string,depth:number)=>{if(depth>32)throw Error('Package directory depth limit exceeded.');const directory=await fs.opendir(folder);for await(const entry of directory){if(++entries>MAX_FILES*2)throw Error('Package entry count limit exceeded.');const file=path.join(folder,entry.name),st=await fs.lstat(file);if(st.isSymbolicLink()||!inside(root,await fs.realpath(file)))throw Error('Package symbolic link or containment violation.');if(st.isDirectory())await walk(file,depth+1);else if(st.isFile()){result.push(safePath(path.relative(root,file).replaceAll('\\','/')));if(result.length>MAX_FILES)throw Error('Package file count limit exceeded.');}else throw Error('Unsupported package entry.');}};await walk(root,0);return result.sort();}
async function validateMedia(root:string,asset:AssetItem){
 const ext=path.extname(asset.relativePath).toLowerCase();if(detectMediaType(ext)!==asset.mediaType)throw Error('Package media type/extension mismatch.');const handle=await fs.open(await fileAt(root,asset.relativePath),'r');const b=Buffer.alloc(64);let size=0;try{size=(await handle.read(b,0,b.length,0)).bytesRead;}finally{await handle.close();}const text=(start:number,end:number)=>b.toString('ascii',start,end),starts=(hex:string)=>b.subarray(0,hex.length/2).equals(Buffer.from(hex,'hex'));
 const riff=text(0,4)==='RIFF',iso=text(4,8)==='ftyp';
 const signatures:Record<string,boolean>={'.png':starts('89504e470d0a1a0a'),'.jpg':starts('ffd8ff'),'.jpeg':starts('ffd8ff'),'.gif':['GIF87a','GIF89a'].includes(text(0,6)),'.webp':riff&&text(8,12)==='WEBP','.bmp':text(0,2)==='BM','.mp3':text(0,3)==='ID3'||b[0]===255&&(b[1]&224)===224,'.wav':riff&&text(8,12)==='WAVE','.ogg':text(0,4)==='OggS','.aac':b[0]===255&&(b[1]&246)===240,'.m4a':iso,'.mp4':iso,'.mov':iso||['moov','mdat','wide'].includes(text(4,8)),'.webm':starts('1a45dfa3'),'.mkv':starts('1a45dfa3'),'.avi':riff&&text(8,12)==='AVI '};if(size<4||!signatures[ext])throw Error(`Package media signature does not match ${asset.mediaType}: ${asset.relativePath}`);
}
async function cleanupStage(stage:string,target:string){const absolute=path.resolve(stage),parent=path.dirname(path.resolve(target));if(path.dirname(absolute)!==parent||!path.basename(absolute).startsWith('.story-package-'))throw Error('Unsafe staging cleanup path.');await fs.rm(absolute,{recursive:true,force:true});}
async function copyDigest(source:string,target:string,expected?:{bytes:number;sha256:string}){
 const input=await fs.open(source,'r');let output:Awaited<ReturnType<typeof fs.open>>|undefined;
 try{const stat=await input.stat();if(!stat.isFile()||stat.size>MAX_FILE)throw Error('Package file size limit exceeded.');await fs.mkdir(path.dirname(target),{recursive:true});output=await fs.open(target,'wx');const hash=createHash('sha256'),buffer=Buffer.alloc(128*1024);let bytes=0;
 while(true){const {bytesRead}=await input.read(buffer,0,buffer.length,null);if(!bytesRead)break;bytes+=bytesRead;if(bytes>MAX_FILE)throw Error('Package file size limit exceeded.');const chunk=buffer.subarray(0,bytesRead);hash.update(chunk);await output.writeFile(chunk);}
 await output.sync();const sha256=hash.digest('hex');if(expected&&(bytes!==expected.bytes||sha256!==expected.sha256))throw Error('Package file hash or size mismatch.');return {bytes,sha256};
 }finally{await input.close();await output?.close();}
}
async function staging(sourceValue:string,targetValue:string){
 if((await fs.lstat(sourceValue)).isSymbolicLink()||(await fs.lstat(targetValue)).isSymbolicLink())throw Error('Package roots cannot be symbolic links.');
 const source=await fs.realpath(sourceValue),target=await fs.realpath(targetValue);
 if(source===target||inside(source,target)||inside(target,source))throw Error('Package destination must be outside the source.');
 if((await fs.readdir(target)).length)throw Error('Package destination must be empty.');
 const stage=await fs.mkdtemp(path.join(path.dirname(target),'.story-package-'));return {source,target,stage};
}
async function publish(stage:string,target:string,assertCurrent:()=>void){
 assertCurrent();if((await fs.readdir(target)).length)throw Error('Package destination changed.');
 // rmdir removes only the selected empty directory; rename publishes the fully validated tree.
 await fs.rmdir(target);try{assertCurrent();await fs.rename(stage,target);}catch(error){await fs.mkdir(target).catch(()=>{});throw error;}
}
export async function rejectPackageFolder(folder:string){
 try{await fs.lstat(path.join(folder,'manifest.json'));}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}
 throw Error('This folder is an immutable package. Use Import portable episode to create an editable copy.');
}
export async function exportEpisodePackage(input:{source:string;target:string;data:unknown;builtinRoot:string;assertCurrent:()=>void}){
 input.assertCurrent();const {source,target,stage}=await staging(input.source,input.target);
 try{
 let data=projectAuthoredEpisode(input.data);const files:PackageManifestV1['files']=[],paths=new Set<string>();let total=0;
 const add=async(relative:string,from:string)=>{safePath(relative);const key=relative.normalize('NFC').toLowerCase();if(paths.has(key))throw Error('Package path collision.');paths.add(key);const result=await copyDigest(from,path.join(stage,relative));total+=result.bytes;if(total>MAX_TOTAL||files.length>=MAX_FILES)throw Error('Package size/count limit exceeded.');files.push({path:relative,...result});return result;};
 for(const asset of data.assets){if(!asset.relativePath.startsWith('assets/'))throw Error('Portable assets must be inside assets/.');await add(asset.relativePath,await fileAt(source,asset.relativePath));}
 const materializedBuiltins:NonNullable<PackageManifestV1['materializedBuiltins']>=[],remaps=new Map<string,string>(),ids=new Set([...data.assets.map(a=>a.id),...data.derivedImages.map(a=>a.id)]);
 for(const activity of data.activities??[])for(const use of collectModuleAssets(activity))if(use.ref.startsWith('builtin:')&&!remaps.has(use.ref)){
 const match=/^builtin:final-boss-hero\/assets\/board-dash\/(start|finish|move|bonus|back3|roll-again|steal)\.png$/.exec(use.ref);if(!match)throw Error('Unsupported builtin package dependency.');
 const base=`builtin-${digest(Buffer.from(use.ref)).slice(0,24)}`;let id=base,index=0;while(ids.has(id))id=`${base}-${++index}`;ids.add(id);
 let relative=`assets/${id}.png`;while(paths.has(relative.toLowerCase())){id=`${base}-${++index}`;if(ids.has(id))continue;ids.add(id);relative=`assets/${id}.png`;}
 const builtinRoot=await fs.realpath(input.builtinRoot);const bytes=await add(relative,await fileAt(builtinRoot,`final-boss-hero/assets/board-dash/${match[1]}.png`));
 data.assets.push({id,relativePath:relative,filename:path.basename(relative),originalName:`${match[1]}.png`,mediaType:'image',sizeBytes:bytes.bytes,importedAt:data.createdAt});remaps.set(use.ref,`asset:${id}`);materializedBuiltins.push({ref:use.ref,moduleVersion:1,assetId:id,sha256:bytes.sha256});
 }
 if(data.activities)data.activities=data.activities.map(a=>remapModuleAssets(a,ref=>remaps.get(ref)??ref));data=validatePortableEpisode(data);
 const put=async(name:string,value:unknown)=>{const bytes=Buffer.from(JSON.stringify(value,null,2));if(bytes.length>MAX_JSON)throw Error('Package JSON size limit exceeded.');await fs.mkdir(path.dirname(path.join(stage,name)),{recursive:true});await fs.writeFile(path.join(stage,name),bytes,{flag:'wx'});const item={path:name,bytes:bytes.length,sha256:digest(bytes)};files.push(item);return item;};
 await put('project.json',data);const definition=await put('definitions/adventure.json',data.adventureDefinition);
 const snapshot={kind:'adventure' as const,adventureId:data.adventure.id,version:data.adventure.version,bundledPath:definition.path,sha256:definition.sha256};
 const manifest=parsePackageManifest({format:'story-studio-package',version:1,episodeId:data.id,adventure:data.adventure,requiredCapabilities:data.requiredCapabilities,materializedBuiltins,files,definitions:[snapshot],adventureDependencies:[{adventureId:snapshot.adventureId,version:snapshot.version,bundledPath:snapshot.bundledPath,sha256:snapshot.sha256}]});
 validatePackageClosure(data,manifest,data.adventureDefinition);await fs.writeFile(path.join(stage,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx'});
 await inspect(stage);await publish(stage,target,input.assertCurrent);return {folderPath:target};
 }finally{await cleanupStage(stage,target);}
}
async function inspect(source:string){
 const manifestBytes=await jsonAt(source,'manifest.json'),manifest=parsePackageManifest(manifestBytes.value);if(manifest.files.length>MAX_FILES)throw Error('Package file count limit exceeded.');let total=0;const paths=new Set<string>();
 for(const file of manifest.files){safePath(file.path);const key=file.path.normalize('NFC').toLowerCase();if(paths.has(key)||file.path==='manifest.json')throw Error('Package path collision.');paths.add(key);if(file.bytes>MAX_FILE||(total+=file.bytes)>MAX_TOTAL)throw Error('Package size limit exceeded.');}
 const actual=await inventory(source),expected=['manifest.json',...manifest.files.map(f=>f.path)].sort();if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('Package inventory contains missing or unlisted files.');
 // Hash streams without allocating file-sized buffers. Import repeats verification during the actual copy.
 for(const file of manifest.files){const handle=await fs.open(await fileAt(source,file.path),'r');try{const hash=createHash('sha256');let size=0;for await(const chunk of handle.createReadStream({autoClose:false})){size+=chunk.length;if(size>file.bytes)throw Error('Package file size mismatch.');hash.update(chunk);}if(size!==file.bytes||hash.digest('hex')!==file.sha256)throw Error('Package file hash mismatch.');}finally{await handle.close();}}
 const data=validatePortableEpisode((await jsonAt(source,'project.json',manifest.files.find(file=>file.path==='project.json')!)).value),definition=(await jsonAt(source,'definitions/adventure.json',manifest.files.find(file=>file.path==='definitions/adventure.json')!)).value;validatePackageClosure(data,manifest,definition);for(const asset of data.assets)await validateMedia(source,asset);return {manifest,data,manifestBytes};
}
export async function importEpisodePackage(input:{source:string;target:string;assertCurrent:()=>void}){
 input.assertCurrent();const {source,target,stage}=await staging(input.source,input.target);
 try{const {manifest,manifestBytes}=await inspect(source);for(const file of manifest.files)await copyDigest(await fileAt(source,file.path),path.join(stage,file.path),file);
 await copyDigest(await fileAt(source,'manifest.json'),path.join(stage,'manifest.json'),manifestBytes);const {data}=await inspect(stage);
 await fs.unlink(path.join(stage,'manifest.json'));await fs.unlink(path.join(stage,'definitions','adventure.json'));await fs.rmdir(path.join(stage,'definitions'));
 await publish(stage,target,input.assertCurrent);return {folderPath:target,data,lastSavedAt:data.updatedAt};
 }finally{await cleanupStage(stage,target);}
}
