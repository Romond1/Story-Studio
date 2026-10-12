const fs=require('node:fs'),path=require('node:path');const dir=path.resolve('docs/whisper-lifetime-evidence');
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const output={};
for(const name of ['before','after']){
 const data=JSON.parse(fs.readFileSync(path.join(dir,name+'.json')));
 output[name]=data.results.map(r=>{
  const warm=r.trials.filter(t=>t.phase==='warm'),pid=r.prepared?.metrics.speechPid;
  const sampleIdle=(start,end)=>{
   const samples=data.resources.filter(s=>s.time>=start&&s.time<=end);
   const native=samples.flatMap(s=>(s.processes||[]).filter(p=>pid===undefined||p.pid===pid).map(p=>({...p,time:s.time})));
   const a=native[0],b=native.at(-1),gpu=samples.map(s=>String(s.gpu).split(',').map(Number));
   return {sampleCount:samples.length,nativeRamMB:mean(native.map(p=>p.ramMB)),nativeCpuPercent:a&&b&&b.time>a.time?(b.cpuSeconds-a.cpuSeconds)*100000/(b.time-a.time)/data.logicalProcessors:0,systemGpuPercent:mean(gpu.map(g=>g[0])),systemVramMB:mean(gpu.map(g=>g[1]))};
  };
  return {model:r.model,execution:r.execution,prepareMs:r.prepareMs,nativePreparation:r.prepared?.metrics,firstTranscriptionMs:r.trials[0].metrics.transcriptionMs,warmTranscriptionMs:mean(warm.map(t=>t.metrics.transcriptionMs)),warmTranscriptRangeMs:[Math.min(...warm.map(t=>t.metrics.transcriptionMs)),Math.max(...warm.map(t=>t.metrics.transcriptionMs))],warmTotalMs:mean(warm.map(t=>t.metrics.totalMs)),translationMs:mean(warm.map(t=>t.metrics.translationMs)),legacyLoadMs:mean(warm.map(t=>t.metrics.whisperLoadMs).filter(Number.isFinite)),hostRssAfterRequestMB:mean(warm.map(t=>t.metrics.rssMB)),wordErrors:warm.reduce((n,t)=>n+t.wer.errors,0),words:warm.reduce((n,t)=>n+t.wer.words,0),readyIdle:sampleIdle(r.readyIdleStart,r.readyIdleEnd),afterIdle:sampleIdle(r.afterIdleStart,r.afterIdleEnd),disableMs:r.disableMs};
 });
}
const cameraFile=path.join(dir,'synthetic-camera-benchmark.json');
if(fs.existsSync(cameraFile)){
 const percentile=(a,p)=>[...a].sort((x,y)=>x-y)[Math.floor((a.length-1)*p)];
 const diffs=a=>a.slice(1).map((t,i)=>t-a[i]);
 output.camera=JSON.parse(fs.readFileSync(cameraFile)).results.map(r=>({name:r.config.name,seconds:r.presenter.duration/1000,drawFPS:r.presenter.camera.length/r.presenter.duration*1000,deliveredFPS:r.presenter.capture.length/r.presenter.duration*1000,trackingHz:r.presenter.results/r.presenter.duration*1000,facePercent:r.presenter.faceResults/r.presenter.results*100,trackingInferenceMs:mean(r.presenter.inference),presenterRafP95Ms:percentile(diffs(r.presenter.raf),.95),controlRafP95Ms:percentile(diffs(r.control.raf),.95),presenterLongTasks:r.presenter.longTasks.length,controlLongTasks:r.control.longTasks.length,trials:r.runs.length,transcriptionMs:mean(r.runs.map(t=>t.metrics.transcriptionMs)),captionMs:mean(r.runs.map(t=>t.speechToCaptionMs)),uniqueNativePids:[...new Set(r.runs.map(t=>t.metrics.speechPid))],videos:r.videos}));
}
fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify(output,null,2));console.log(JSON.stringify(output,null,2));
