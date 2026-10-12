const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
async function verifyRuntime(runtime,manifest){
  try{
    for(const entry of manifest){
      const file=path.join(runtime,entry.path);
      const stat=await fs.promises.stat(file);
      if(!stat.isFile()||stat.size!==entry.size)return false;
      const hash=createHash('sha256');
      for await(const chunk of fs.createReadStream(file))hash.update(chunk);
      if(hash.digest('hex')!==entry.sha256)return false;
    }
    return manifest.length>0;
  }catch{return false;}
}
async function ensureRuntime(runtime,manifest,install){
  if(await verifyRuntime(runtime,manifest))return;
  await install();
  if(!await verifyRuntime(runtime,manifest))throw new Error('Whisper runtime integrity verification failed after extraction.');
}
module.exports={verifyRuntime,ensureRuntime};
