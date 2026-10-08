import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ImportResult, MediaType } from '../shared/types';
import { createMediaSlide } from '../shared/mediaPool';

export function detectMediaType(ext:string):MediaType|null {
  if(['.png','.jpg','.jpeg','.gif','.webp','.bmp'].includes(ext.toLowerCase()))return 'image';
  if(['.mp4','.mov','.webm','.mkv','.avi'].includes(ext.toLowerCase()))return 'video';
  if(['.mp3','.wav','.ogg','.aac','.m4a'].includes(ext.toLowerCase()))return 'audio';
  return null;
}
/** One importer for native pickers, Pool and Explorer. Files always receive UUID storage names. */
export async function importProjectMedia(folder:string, sources:string[], sectionId:string):Promise<ImportResult> {
  const result:ImportResult={importedAssets:[],createdSlides:[],importedBins:[],failures:[]};
  const visit=async(source:string,parentId?:string):Promise<void>=>{
    const name=path.basename(source);
    try {
      const stat=await fs.lstat(source);
      if(stat.isSymbolicLink()){result.failures!.push({name,reason:'Symbolic links are not imported.'});return;}
      if(stat.isDirectory()){
        const id=randomUUID();result.importedBins!.push({id,name,...(parentId?{parentId}:{})});
        const children=(await fs.readdir(source)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
        for(const child of children)await visit(path.join(source,child),id);
        return;
      }
      const ext=path.extname(source).toLowerCase();const mediaType=detectMediaType(ext);
      if(!stat.isFile()||!mediaType){result.failures!.push({name,reason:'Unsupported media type.'});return;}
      const id=randomUUID();const filename=`${id}${ext}`;
      await fs.copyFile(source,path.join(folder,'assets',filename));
      const asset={id,filename,relativePath:`assets/${filename}`,originalName:name,mediaType,sizeBytes:stat.size,importedAt:new Date().toISOString(),...(parentId?{binId:parentId}:{})};
      result.importedAssets.push(asset);
      if(mediaType!=='audio')result.createdSlides.push(createMediaSlide(asset,sectionId,randomUUID));
    } catch(error) {result.failures!.push({name,reason:error instanceof Error?error.message:'Import failed.'});}
  };
  await fs.mkdir(path.join(folder,'assets'),{recursive:true});
  for(const source of sources)await visit(source);
  return result;
}
