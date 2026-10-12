const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');
const {cached,hash}=require('../src/main/translation/cache.cjs');
test('offline cache reuses verified bytes and refuses corruption without attempting download',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'story-cache-test-'));const old=process.env.STORY_STUDIO_TRANSLATION_OFFLINE;process.env.STORY_STUDIO_TRANSLATION_OFFLINE='1';
 try{const bytes=Buffer.from('local-model');const item={hash:hash(bytes),size:bytes.length,name:'test',url:'https://invalid.test/model'};await fs.writeFile(path.join(dir,item.hash),bytes);assert.deepEqual(await cached(dir,item),bytes);await fs.writeFile(path.join(dir,item.hash),'corrupt');await assert.rejects(cached(dir,item),/Offline/);}
 finally{if(old===undefined)delete process.env.STORY_STUDIO_TRANSLATION_OFFLINE;else process.env.STORY_STUDIO_TRANSLATION_OFFLINE=old;await fs.rm(dir,{recursive:true,force:true});}
});
test('download integrity failure does not become a cached model',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'story-cache-test-'));const original=global.fetch;const old=process.env.STORY_STUDIO_TRANSLATION_OFFLINE;delete process.env.STORY_STUDIO_TRANSLATION_OFFLINE;
 try{const bytes=Buffer.from('good');const item={hash:hash(bytes),size:4,name:'test',url:'https://invalid.test/model'};global.fetch=async()=>new Response('evil');await assert.rejects(cached(dir,item),/Integrity check failed/);assert.deepEqual(await fs.readdir(dir),[]);global.fetch=async()=>new Response(bytes);assert.deepEqual(await cached(dir,item),bytes);}
 finally{global.fetch=original;if(old!==undefined)process.env.STORY_STUDIO_TRANSLATION_OFFLINE=old;await fs.rm(dir,{recursive:true,force:true});}
});
