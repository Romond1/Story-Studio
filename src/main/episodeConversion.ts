import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { LessonProject } from '../shared/lesson/model';
import type { EpisodeAdventure } from '../shared/episodeProtocol';
import { parseLessonProject } from '../shared/lesson/validation';
import { parseEpisodeProject } from '../shared/episode/validation';
import { createMediaRegistry } from '../shared/content/mediaRegistry';
type FileDigest = { path: string; bytes: number; sha256: string };
const sha256=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const contained=(root:string,file:string)=>{const rel=path.relative(root,file);return rel!==''&&rel!=='..'&&!rel.startsWith(`..${path.sep}`)&&!path.isAbsolute(rel);};
async function resolveDestination(value:string):Promise<string>{
 try{return await fs.realpath(value);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;const parent=path.dirname(value);if(parent===value)throw error;return path.join(await resolveDestination(parent),path.basename(value));}
}
async function inventory(root:string):Promise<FileDigest[]> {
 const files:FileDigest[]=[];
 const walk=async(folder:string)=>{for(const name of (await fs.readdir(folder)).sort()){
  const file=path.join(folder,name),stat=await fs.lstat(file);
  if(stat.isSymbolicLink())throw Error('Conversion does not follow symbolic links.');
  if(!contained(root,await fs.realpath(file)))throw Error('Unsafe conversion source path.');
  if(stat.isDirectory())await walk(file);
  else if(stat.isFile()){const bytes=await fs.readFile(file);files.push({path:path.relative(root,file).replaceAll('\\','/'),bytes:bytes.byteLength,sha256:sha256(bytes)});}
  else throw Error('Unsupported conversion source file.');
 }};await walk(root);return files;
}
async function copyVerified(source:string,target:string,files:FileDigest[],includeProject=true){
 for(const entry of files){if(!includeProject&&entry.path==='project.json')continue;const bytes=await fs.readFile(path.join(source,entry.path));if(sha256(bytes)!==entry.sha256)throw Error('Source changed during conversion.');const output=path.join(target,entry.path);await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,bytes,{flag:'wx'});if(sha256(await fs.readFile(output))!==entry.sha256)throw Error('Conversion copy verification failed.');}
}
export async function convertSceneToEpisode(input:{source:string;target:string;backupRoot:string;data:unknown;adventure:EpisodeAdventure;writeAtomic:(folder:string,data:LessonProject,createOnly?:boolean)=>Promise<string>}) {
 const source=await fs.realpath(input.source),target=await fs.realpath(input.target);
 if(source===target||contained(source,target)||contained(target,source))throw Error('Choose an empty conversion folder outside the source project.');
 const backupRoot=await resolveDestination(path.resolve(input.backupRoot));
 if(backupRoot===source||contained(source,backupRoot)||backupRoot===target||contained(target,backupRoot))throw Error('Private backup folder must be outside source and target.');
 if((await fs.readdir(target)).length)throw Error('Conversion target must be empty.');
 const scene=parseLessonProject(input.data);
 const onDisk=parseLessonProject(JSON.parse(await fs.readFile(path.join(source,'project.json'),'utf8')));
 if(scene.id!==onDisk.id)throw Error('Source project identity changed.');
 const report=createMediaRegistry({format:'scene',data:scene}).dependencies();
 if(report.issues.some(issue=>issue.kind==='unknown-content'))throw Error('Unknown authored content blocks conversion.');
 // Explicit field allowlist: session and extension objects are never spread into the envelope.
 const data=parseEpisodeProject({format:'story-studio-episode',version:1,id:scene.id,title:scene.title,createdAt:scene.createdAt,updatedAt:scene.updatedAt,
  assets:scene.assets,mediaBins:scene.mediaBins,scenes:scene.scenes,sequences:scene.sequences,sections:scene.sections,cards:scene.cards,library:scene.library,cardSets:scene.cardSets,
  adventure:input.adventure,requiredCapabilities:['derived-images-v1','manual-catalog-v1'],derivedImages:[],catalog:{entities:[]}});
 const files=await inventory(source);
 for(const asset of scene.assets)if(!files.some(file=>file.path===asset.relativePath))throw Error(`Missing source media: ${asset.relativePath}`);
 const backupPath=path.join(backupRoot,randomUUID());await fs.mkdir(backupPath,{recursive:true});
 await copyVerified(source,path.join(backupPath,'source'),files);
 await fs.writeFile(path.join(backupPath,'source-manifest.json'),JSON.stringify({version:1,source,files},null,2),{flag:'wx'});
 await fs.writeFile(path.join(backupPath,'authored-snapshot.json'),JSON.stringify(scene,null,2),{flag:'wx'});
 await copyVerified(source,target,files,false);
 if(JSON.stringify(await inventory(source))!==JSON.stringify(files))throw Error('Source changed during conversion.');
 const migrationReport=path.join(backupPath,'conversion-report.json');
 await fs.writeFile(migrationReport,JSON.stringify({version:1,source,target,backupPath,sourceFormat:scene.format,targetFormat:data.format,files},null,2),{flag:'wx'});
 const lastSavedAt=await input.writeAtomic(target,data,true);
 return {folderPath:target,data,lastSavedAt,backupPath,migrationReport};
}
