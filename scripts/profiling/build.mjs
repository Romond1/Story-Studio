// Opt-in benchmark build. Transforms copies in memory; never edits application source.
import { build } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
if (process.env.STORY_STUDIO_PROFILE !== '1') throw new Error('Set STORY_STUDIO_PROFILE=1 for this diagnostic-only build.');
const replace = (s, a, b) => { if (!s.includes(a)) throw new Error(`Instrumentation anchor missing: ${a}`); return s.replace(a,b); };
const hook = 'globalThis.__storyProfile';
const outDir = path.resolve('.tmp-face-profile-build');
await build({ build: { outDir }, plugins: [{ name:'isolated-profiling', enforce:'pre', transform(code,id) {
  id=id.replaceAll('\\','/');
  if(id.endsWith('/shared/faceTracking.ts')) {
    code=replace(code,'now - this.last < 80',`now - this.last < (${hook}?.interval ?? 80)`);
    code=replace(code,'this.pending = this.last = now; return true;',`this.pending = now; const interval = ${hook}?.interval ?? 80; this.last = ${hook}?.compensated && Number.isFinite(this.last) ? now - ((now-this.last)%interval) : now; return true;`);
    code=replace(code,'/ 45)',`/ (${hook}?.smoothing ?? 45))`);
  }
  if(id.endsWith('/tracking/FaceTrackingSession.ts')) {
    code=replace(code,"new URL('face.worker.js', baseUrl)","new URL('profile.worker.js', baseUrl)");
    code=replace(code,'const now = performance.now();',`const now = performance.now(); ${hook}?.result(data,now);`);
    code=replace(code,"try { this.worker.postMessage({ type: 'frame'",`try { ${hook}?.prepared(now,performance.now()); this.worker.postMessage({ type: 'frame'`);
    code=replace(code,'return this.disposed ? null : pose;',`${hook} && (${hook}.pose = this.disposed ? null : pose); return this.disposed ? null : pose;`);
  }
  if(id.endsWith('/camera/CameraLayer.tsx')) {
    code=replace(code,'effects.draw(video, latest.current);',`${hook}?.before(video,time); effects.draw(video, latest.current); ${hook}?.effectsDone();`);
    code=replace(code,'tracking.current?.sample(video, time);',`tracking.current?.sample(video, time); ${hook}?.sampleDone();`);
    code=replace(code,'latest.current.mirror, video.videoWidth, video.videoHeight);',`latest.current.mirror, video.videoWidth, video.videoHeight); ${hook}?.paint();`);
  }
  if(id.endsWith('/drawing/renderDrawing.ts')) {
    code=replace(code,'const ratio = window.devicePixelRatio || 1;',`const profileStarted = performance.now(); const ratio = window.devicePixelRatio || 1;`);
    code=replace(code,'  ctx.restore();',`  ctx.restore(); ${hook}?.drawing(performance.now()-profileStarted, markers.length+transient.length);`);
  }
  return {code,map:null};
}}] });
const worker = await build({configFile:false,logLevel:'error',plugins:[{name:'worker-timing',enforce:'pre',transform(code,id){
  if(!id.replaceAll('\\','/').endsWith('/tracking/face.worker.ts')) return;
  code=replace(code,'const result = landmarker.detectForVideo(data.bitmap, data.timestamp);','const started = performance.now(); const result = landmarker.detectForVideo(data.bitmap, data.timestamp); const inferenceMs = performance.now() - started;');
  code=replace(code,"type: 'result', timestamp: data.timestamp, observation","type: 'result', timestamp: data.timestamp, observation, inferenceMs");
  return {code,map:null};
}}],build:{write:false,minify:true,target:'es2021',lib:{entry:path.resolve('src/renderer/camera/tracking/face.worker.ts'),name:'ProfileWorker',formats:['iife']},rollupOptions:{output:{inlineDynamicImports:true}}}});
await writeFile(path.join(outDir,'face-tracking/profile.worker.js'),(Array.isArray(worker)?worker[0]:worker).output.find(x=>x.type==='chunk').code);
console.log('Diagnostic build ready. Normal build scripts do not include any profiling hooks.');
