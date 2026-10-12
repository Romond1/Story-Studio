const {cached}=require('./cache.cjs');
const path=require('node:path');
const extract=require('extract-zip');
const {ensureRuntime}=require('./whisper-runtime.cjs');
const runtimeManifests=require('./whisper-runtime-manifests.json');
const {execFile}=require('node:child_process');
function probeNvidia(){
  return new Promise(resolve=>execFile('nvidia-smi',['--query-gpu=name','--format=csv,noheader'],{windowsHide:true,timeout:5000},(error,stdout)=>{
    const device=stdout?.trim().split(/\r?\n/)[0];
    resolve(error||!device?{reason:'NVIDIA GPU/driver unavailable (nvidia-smi probe failed).'}:{device});
  }));
}
function verifyCudaLog(log){
  const model=log.match(/whisper_model_load:.*CUDA\d+\s+total size\s*=\s*([\d.]+)\s*MB/i);
  const compute=log.match(/whisper_init_state:.*compute buffer \(encode\)\s*=\s*([\d.]+)\s*MB/i);
  const initialized=/whisper_backend_init_gpu:\s*using CUDA\d+ backend/i.test(log);
  if(!initialized||!model||Number(model[1])<=0||!compute||Number(compute[1])<=0)throw new Error('CUDA allocation verification failed; Whisper did not confirm GPU model and compute buffers.');
  return true;
}
function cudaDeviceFromLog(log){
  const selected=log.match(/whisper_backend_init_gpu:\s*using CUDA(\d+) backend/i)?.[1];
  if(selected===undefined)return undefined;
  return log.match(new RegExp(`^\\s*Device ${selected}:\\s*(.+?),\\s*compute capability`, 'mi'))?.[1].trim();
}
const models={
  'base.en':{hash:'a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002',size:147964211},
  'small.en':{hash:'c6138d6d58ecc8322097e0f987c32f1be8bb0a18532a3f88f734d1bbf9c41e5d',size:487614201},
};
async function prepareSpeech(cache,model,status,backend='cpu'){
  if(process.platform!=='win32'||process.arch!=='x64')throw new Error('Automatic whisper.cpp installation currently supports Windows x64 only.');
  if(!models[model])throw new Error('Unsupported Whisper model');
  if(!['cpu','cuda'].includes(backend))throw new Error('Unsupported speech backend');
  const archive=backend==='cuda'?{name:'whisper.cpp v1.8.2 CUDA runtime',hash:'54a3c012e6c567e2e8bed874cdf49c55f018ec8d90bb5d5271568aa573291b2d',size:457274520,url:'https://github.com/ggml-org/whisper.cpp/releases/download/v1.8.2/whisper-cublas-12.4.0-bin-x64.zip'}:{name:'whisper.cpp v1.8.2 CPU runtime',hash:'b1514ebc099765e39fa37eb780b92a140a94c86bb0b3b3d98226b38825979732',size:3832432,url:'https://github.com/ggml-org/whisper.cpp/releases/download/v1.8.2/whisper-bin-x64.zip'};
  const runtime=path.join(cache,backend==='cpu'?'whisper-1.8.2':'whisper-1.8.2-cuda');
  status(`Verifying ${archive.name}…`);
  await ensureRuntime(runtime,runtimeManifests[backend],async()=>{
    await cached(cache,archive,status);
    await extract(path.join(cache,archive.hash),{dir:runtime});
  });
  const exe=path.join(runtime,'Release','whisper-cli.exe');
  const name=`ggml-${model}.bin`;
  const info={...models[model],name,url:`https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${name}`};
  await cached(cache,info,status);
  return {exe,modelPath:path.join(cache,info.hash),backend};
}
async function prepareResidentSpeech(cache,model,status,backend='cpu'){
  const fs=require('node:fs/promises'),crypto=require('node:crypto');
  // Packaged translation assets are copied beside this module; development uses source assets.
  const bundled=path.join(__dirname,'whisper-host.exe');
  let host=bundled,manifestPath=path.join(__dirname,'whisper-host-manifest.json');
  try{await fs.access(manifestPath);}catch{host=path.resolve(__dirname,'../../../native/whisper-host/bin/win32-x64/whisper-host.exe');manifestPath=path.resolve(__dirname,'../../../native/whisper-host/manifest.json');}
  host=host.replace(/app\.asar([\\/])/,'app.asar.unpacked$1');
  const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8')),bytes=await fs.readFile(host);
  if(bytes.length!==manifest.size||crypto.createHash('sha256').update(bytes).digest('hex')!==manifest.sha256)throw Error('Bundled Whisper host integrity verification failed');
  const prepared=await prepareSpeech(cache,model,status,backend);
  return {...prepared,host};
}
module.exports={prepareSpeech,prepareResidentSpeech,probeNvidia,verifyCudaLog,cudaDeviceFromLog};
