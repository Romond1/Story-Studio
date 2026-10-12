// Injected only by run.cjs into the isolated benchmark instance. No image data retained.
module.exports = function installProfile() {
  const p=window.__storyProfile={interval:80,smoothing:45,pose:null,active:false,video:null,settings:null,gpuAvailable:null,workers:0};
  const WorkerBase=window.Worker;window.Worker=class extends WorkerBase{constructor(...args){super(...args);p.workers++;this.profileEnded=false;}terminate(){if(!this.profileEnded){p.workers--;this.profileEnded=true;}super.terminate();}};
  p.reset=()=>{p.data={raf:[],camera:[],capture:[],lessonCapture:[],effects:[],overlay:[],sampleCpu:[],drawingCpu:[],drawingStrokes:[],inference:[],roundTrip:[],bitmap:[],resultTimes:[],paintAge:[],firstPaint:[],deliveryToPaint:[],poses:[],longTasks:[],gpu:[],duplicates:0,faceResults:0,results:0};p.started=performance.now();p.active=true;p.lastPose=-1;};
  p.stop=()=>{p.active=false;return {duration:performance.now()-p.started,...p.data,settings:p.settings,workers:p.workers,gpuAvailable:p.gpuAvailable,visibility:document.visibilityState,viewport:[innerWidth,innerHeight,devicePixelRatio]};};
  p.reset();p.active=false;
  const tick=t=>{if(p.active)p.data.raf.push(t);requestAnimationFrame(tick);};requestAnimationFrame(tick);
  new PerformanceObserver(list=>{if(p.active)for(const e of list.getEntries())p.data.longTasks.push({start:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:false});
  const observe=v=>{p.video=v;p.settings=v.srcObject?.getVideoTracks()[0]?.getSettings();const cb=(t,m)=>{if(p.video!==v)return;if(p.active)p.data.capture.push({t,frames:m.presentedFrames,media:m.mediaTime});v.requestVideoFrameCallback(cb);};v.requestVideoFrameCallback(cb);};
  p.before=(v,t)=>{if(p.video!==v)observe(v);if(!p.lessonVideo){const lesson=document.querySelector('.present-story-layers video');if(lesson){p.lessonVideo=lesson;const frame=(t,m)=>{if(p.active)p.data.lessonCapture.push({t,frames:m.presentedFrames,media:m.mediaTime});lesson.requestVideoFrameCallback(frame);};lesson.requestVideoFrameCallback(frame);}}p.drawStart=performance.now();if(p.active){p.data.camera.push(t);if(v.currentTime===p.lastVideoTime)p.data.duplicates++;p.lastVideoTime=v.currentTime;}};
  p.effectsDone=()=>{p.overlayStart=performance.now();if(p.active)p.data.effects.push(p.overlayStart-p.drawStart);};
  p.sampleDone=()=>{const now=performance.now();if(p.active)p.data.sampleCpu.push(now-p.overlayStart);p.overlayStart=now;};
  p.drawing=(duration,strokes)=>{if(p.active){p.data.drawingCpu.push(duration);p.data.drawingStrokes.push(strokes);}};
  p.prepared=(t,now)=>{if(p.active)p.data.bitmap.push(now-t);};
  p.result=(data,now)=>{p.resultArrival=now;if(!p.active)return;p.data.results++;p.data.inference.push(data.inferenceMs);p.data.roundTrip.push(now-data.timestamp);p.data.resultTimes.push(now);if(data.observation){p.data.faceResults++;const a=data.observation.landmarks[1];p.data.poses.push({t:data.timestamp,x:a.x,y:a.y,z:a.z});}};
  p.paint=()=>{if(!p.active)return;const now=performance.now();p.data.overlay.push(now-p.overlayStart);if(p.pose){p.data.paintAge.push(now-p.pose.timestamp);if(p.lastPose!==p.pose.timestamp){p.data.firstPaint.push(now-p.pose.timestamp);p.data.deliveryToPaint.push(now-p.resultArrival);p.lastPose=p.pose.timestamp;}}};
  // Asynchronous GPU query: sample one camera upload+draw per second, never gl.finish/readPixels.
  const tex=WebGL2RenderingContext.prototype.texImage2D,draw=WebGL2RenderingContext.prototype.drawArrays;
  const states=new WeakMap();
  WebGL2RenderingContext.prototype.texImage2D=function(...args){
    let s=states.get(this);if(!s){s={ext:this.getExtension('EXT_disjoint_timer_query_webgl2'),last:0};states.set(this,s);p.gpuAvailable=!!s.ext;}
    if(s.ext&&p.active&&performance.now()-s.last>1000&&!s.query){s.query=this.createQuery();s.last=performance.now();this.beginQuery(s.ext.TIME_ELAPSED_EXT,s.query);s.running=true;}
    return tex.apply(this,args);
  };
  WebGL2RenderingContext.prototype.drawArrays=function(...args){const result=draw.apply(this,args),s=states.get(this);if(s?.running){this.endQuery(s.ext.TIME_ELAPSED_EXT);s.running=false;const gl=this,q=s.query;const poll=()=>{if(gl.isContextLost()){s.query=null;return;}if(!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)){setTimeout(poll,20);return;}if(p.active&&!gl.getParameter(s.ext.GPU_DISJOINT_EXT))p.data.gpu.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);s.query=null;};setTimeout(poll,20);}return result;};
};
