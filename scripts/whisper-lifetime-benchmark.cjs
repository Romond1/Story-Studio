const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');
const {pcm,wer}=require('./whisper-benchmark.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/whisper-lifetime-evidence');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function monitor(){
 const samples=[];let buffer='';
 const script="$ErrorActionPreference='SilentlyContinue';while($true){$p=@(Get-Process whisper-cli,whisper-host -ErrorAction SilentlyContinue | ForEach-Object {@{pid=$_.Id;name=$_.ProcessName;cpuSeconds=$_.CPU;ramMB=$_.WorkingSet64/1MB;privateMB=$_.PrivateMemorySize64/1MB}});$g=(& nvidia-smi --query-gpu=utilization.gpu,memory.used --format=csv,noheader,nounits 2>$null);@{time=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();processes=$p;gpu=$g}|ConvertTo-Json -Compress -Depth 4;Start-Sleep -Milliseconds 400}";
 const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,stdio:['ignore','pipe','ignore']});
 child.stdout.on('data',data=>{buffer+=data;let n;while((n=buffer.indexOf('\n'))>=0){try{samples.push(JSON.parse(buffer.slice(0,n)));}catch{}buffer=buffer.slice(n+1);}});
 return async()=>{const closed=new Promise(r=>child.once('close',r));child.kill();await closed;return samples;};
}
async function main(){
 const baseline=process.argv.includes('--baseline'),prefix=baseline?'before':'after';
 const {TranslationService}=require(baseline?'../.translation-cache/lifetime-baseline/main/translation/service':'../dist/main/main/translation/service');
 const refs=JSON.parse(await fs.readFile(path.join(root,'docs/phase3.1-evidence/references.json'),'utf8'));
 const audio=await Promise.all(refs.map((_,i)=>fs.readFile(path.join(root,`docs/phase3.1-evidence/live-${i}.wav`)).then(pcm)));
 const data={baseline,cpu:os.cpus()[0].model,logicalProcessors:os.cpus().length,results:[]};await fs.mkdir(out,{recursive:true});const stop=monitor();
 const save=()=>fs.writeFile(path.join(out,prefix+'.json'),JSON.stringify(data,null,2));
 try{for(const model of ['base.en','small.en'])for(const execution of ['cpu','gpu']){
  const statuses=[],s=new TranslationService(path.join(root,'.translation-cache'),message=>statuses.push({time:Date.now(),message}));
  const record={model,execution,trials:[],statuses};data.results.push(record);
  try{
   if(!baseline){const start=performance.now();record.prepared=await s.prepare({target:'ja',model,execution});record.prepareMs=performance.now()-start;}
   record.readyIdleStart=Date.now();await sleep(10000);record.readyIdleEnd=Date.now();
   for(let i=0;i<6;i++){const j=i===0?0:i-1,start=Date.now();const result=await s.run({audio:audio[j],target:'ja',model,execution});record.trials.push({phase:i?'warm':'first',fixture:j,started:start,finished:Date.now(),...result,wer:wer(refs[j],result.transcript)});console.log(prefix,model,execution,i,Math.round(result.metrics.transcriptionMs),result.transcript);await save();}
   record.afterIdleStart=Date.now();await sleep(10000);record.afterIdleEnd=Date.now();
  }finally{const start=performance.now();await s.cancelCurrent(true);record.disableMs=performance.now()-start;record.disabledAt=Date.now();await sleep(1500);await save();}
 }}finally{data.resources=await stop();await save();}
}
module.exports={monitor};if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
