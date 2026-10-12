const fs=require('node:fs'),path=require('node:path');
const folder=path.resolve('docs/performance-evidence'),env=JSON.parse(fs.readFileSync(path.join(folder,'environment.json'))),n=env.logicalProcessors;
const stats=a=>{a=a.filter(Number.isFinite).sort((a,b)=>a-b);return a.length?{mean:a.reduce((x,y)=>x+y,0)/a.length,p95:a[Math.min(a.length-1,Math.ceil(a.length*.95)-1)],max:a.at(-1),min:a[0],n:a.length}:null;};
const gaps=a=>a.slice(1).map((v,i)=>v-a[i]);
const results=[];
for(const file of fs.readdirSync(folder).filter(x=>/^(A|B|C|D|E|F)(-.*)?\.json$/.test(x))){
 const r=JSON.parse(fs.readFileSync(path.join(folder,file))),system=[],total=[],roles={},mem=[],privateMem=[],durations=[];
 for(let i=1;i<r.samples.length;i++){
  const prev=r.samples[i-1],s=r.samples[i],dt=(s.wall-prev.wall)/1000;durations.push(dt);let sum=0;
  for(const p of s.processes){const old=prev.processes.find(q=>q.pid===p.pid);if(!old||!Number.isFinite(p.cpu.cumulativeCPUUsage))continue;
   const cpu=100*(p.cpu.cumulativeCPUUsage-old.cpu.cumulativeCPUUsage)/dt/n;sum+=cpu;
   const role=p.window?(p.window.includes('— Present')?'Presenter':'Control'):(p.type==='Browser'?'Main':p.type+(p.serviceName?': '+p.serviceName:''));
   (roles[role]??={cpu:[],workingMiB:[],privateMiB:[],pids:[]}).cpu.push(cpu);roles[role].workingMiB.push(p.memory.workingSetSize/1024);roles[role].privateMiB.push(p.memory.privateBytes/1024);if(!roles[role].pids.includes(p.pid))roles[role].pids.push(p.pid);
  }
  total.push(sum);system.push(100*(1-(s.system.idle-prev.system.idle)/(s.system.total-prev.system.total)));
  mem.push(s.processes.reduce((a,p)=>a+p.memory.workingSetSize/1024,0));privateMem.push(s.processes.reduce((a,p)=>a+(p.memory.privateBytes||0)/1024,0));
 }
 const p=r.presenter,seconds=p?p.duration/1000:null;
 const cpu=stats(total);if(cpu)cpu.mean=total.reduce((a,v,i)=>a+v*durations[i],0)/durations.reduce((a,b)=>a+b,0);
 results.push({name:r.name,duration:(r.samples.at(-1).wall-r.samples[0].wall)/1000,cpuSystemPercent:cpu,backgroundPlusAppSystemPercent:stats(system),workingMiB:stats(mem),privateMiB:stats(privateMem),privateFirst:privateMem[0],privateLast:privateMem.at(-1),roles:Object.fromEntries(Object.entries(roles).map(([k,v])=>[k,{pids:v.pids,cpu:stats(v.cpu),workingMiB:stats(v.workingMiB),privateMiB:stats(v.privateMiB)}])),
  presenter:p?{seconds,cameraFps:p.camera.length/seconds,captureCallbackHz:p.capture.length/seconds,captureFrameHz:p.capture.length>1?(p.capture.at(-1).frames-p.capture[0].frames)*1000/(p.capture.at(-1).t-p.capture[0].t):null,rafHz:p.raf.length/seconds,inferenceHz:p.results/seconds,faceFraction:p.results?p.faceResults/p.results:null,inferenceMs:stats(p.inference),resultAgeMs:stats(p.roundTrip),firstPaintAgeMs:stats(p.firstPaint),deliveryToPaintMs:stats(p.deliveryToPaint),allPaintAgeMs:stats(p.paintAge),framePreparePathMs:stats(p.bitmap),cameraSubmitCpuMs:stats(p.effects),overlaySubmitCpuMs:stats(p.overlay),gpuUploadAndDrawMs:stats(p.gpu),gpuAvailable:p.gpuAvailable,rafGapMs:stats(gaps(p.raf)),cameraGapMs:stats(gaps(p.camera)),inferenceGapMs:stats(gaps(p.resultTimes)),longTaskMs:stats(p.longTasks.map(x=>x.duration)),duplicates:p.duplicates,settings:p.settings,viewport:p.viewport,visibility:p.visibility}:null,
  additional:p?{sampleCpuMs:stats(p.sampleCpu||[]),drawingCpuMs:stats(p.drawingCpu||[]),drawingHz:(p.drawingCpu?.length||0)/seconds,strokeCounts:stats(p.drawingStrokes||[]),workers:p.workers,lessonFps:(p.lessonCapture?.length||0)/seconds,lessonFrameGapMs:stats(gaps((p.lessonCapture||[]).map(x=>x.t)))}:null,
  control:{rafHz:r.control.raf.length/(r.control.duration/1000),rafGapMs:stats(gaps(r.control.raf)),longTaskMs:stats(r.control.longTasks.map(x=>x.duration)),drawingCpuMs:stats(r.control.drawingCpu||[]),drawingHz:(r.control.drawingCpu?.length||0)/(r.control.duration/1000)},validity:r.validity,lesson:r.lesson,actions:r.actions.length,errors:r.errors});
}
fs.writeFileSync(path.join(folder,'summary.json'),JSON.stringify(results,null,2));
console.table(results.map(r=>({run:r.name,sec:r.duration.toFixed(1),cpu:r.cpuSystemPercent?.mean.toFixed(2),p95:r.cpuSystemPercent?.p95.toFixed(2),peak:r.cpuSystemPercent?.max.toFixed(2),privateMiB:r.privateMiB?.mean.toFixed(0),camera:r.presenter?.cameraFps.toFixed(2),capture:r.presenter?.captureFrameHz?.toFixed(2),tracking:r.presenter?.inferenceHz.toFixed(2),infer:r.presenter?.inferenceMs?.mean.toFixed(1),inferP95:r.presenter?.inferenceMs?.p95.toFixed(1),age:r.presenter?.firstPaintAgeMs?.p95.toFixed(1),face:r.presenter?.faceFraction?.toFixed(2)})));
