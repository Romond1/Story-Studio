import { useEffect, useRef, useState } from 'react';
import { CAMERA_DEFAULTS, transformCameraLayout, type CameraCorner, type CameraSettings, type CameraStatus, type CameraLayout } from '../../shared/cameraProtocol';
import { CameraSession } from '../../shared/cameraSession';
import {PersonRemovalSession} from './removal/PersonRemovalSession';
import { CameraEffects } from './CameraEffects';
import { FaceTrackingSession } from './tracking/FaceTrackingSession';
import { drawTracking, releaseTrackingCanvas } from './tracking/drawTracking';
import { MerlinCostumeOverlay } from './tracking/MerlinCostumeOverlay';
import './camera.css';

function cameraError(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Camera permission denied. Allow camera access in system privacy settings, then turn camera off and on.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'Selected camera is unavailable. Connect it or select another camera.';
  if (name === 'NotReadableError' || name === 'AbortError') return 'Camera could not start. Close other camera apps, then turn camera off and on.';
  return error instanceof Error ? error.message : 'Camera failed. Turn camera off and on to retry.';
}

export function CameraLayer() {
  const [draftLayout, setDraftLayout] = useState<CameraLayout | null>(null);
  const draft = useRef<CameraLayout | null>(null);
  const drag = useRef<{x:number;y:number;layout:CameraLayout;mode:CameraCorner|'move';parent:DOMRect} | null>(null);
  const layer = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<CameraSettings>(CAMERA_DEFAULTS);
  const latest = useRef(settings); latest.current = settings;
  const canvas = useRef<HTMLCanvasElement>(null);
  const merlinCanvas = useRef<HTMLCanvasElement>(null);
  const trackingCanvas = useRef<HTMLCanvasElement>(null);
  const removal=useRef<PersonRemovalSession|null>(null);
  const tracking = useRef<FaceTrackingSession | null>(null);
  const merlin = useRef<MerlinCostumeOverlay | null>(null);
  const [live, setLive] = useState(false);
  const session = useRef<CameraSession<MediaStream> | null>(null);
  if (!session.current) session.current = new CameraSession(async deviceId => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera capture is unavailable in this environment.');
    return navigator.mediaDevices.getUserMedia({ audio: false, video: {
      width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 },
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    } });
  }, stream => stream.getTracks().forEach(track => track.stop()));
  useEffect(() => {
    const api = window.cameraPresenter;
    if (!api) return;
    let disposed = false, received = false;
    const unsubscribe = api.subscribe(value => { received = true; setSettings(value); });
    void api.get().then(value => { if (!disposed && !received) setSettings(value); }).catch(() => {});
    return () => { disposed = true; unsubscribe(); };
  }, []);
  useEffect(()=>{
    if(!settings.personRemoval||!settings.enabled||!live||settings.preset==='hidden'){window.cameraPresenter?.reportRemoval?.({state:'off'});return;}
    try{removal.current=new PersonRemovalSession(status=>window.cameraPresenter?.reportRemoval?.(status));}
    catch{window.cameraPresenter?.reportRemoval?.({state:'error',message:'Unable to initialize person removal. Output hidden.'});}
    return()=>{removal.current?.dispose();removal.current=null;};
  },[settings.personRemoval,settings.enabled,settings.deviceId,settings.preset==='hidden',live]);
  useEffect(() => {
    if (!settings.tracking.enabled || !settings.enabled || !live) {
      releaseTrackingCanvas(trackingCanvas.current);
      merlin.current?.dispose(); merlin.current = null;
      window.cameraPresenter?.reportTracking?.({ state: 'off' });
      return;
    }
    try {
      tracking.current = new FaceTrackingSession(status => window.cameraPresenter?.reportTracking?.(status));
      if (merlinCanvas.current && !merlin.current) {
        merlin.current = new MerlinCostumeOverlay(merlinCanvas.current);
      }
    } catch {
      window.cameraPresenter?.reportTracking?.({ state: 'error', message: 'Unable to start the face tracking worker. Turn tracking off and on to retry.' });
    }
    return () => {
      tracking.current?.dispose(); tracking.current = null;
      merlin.current?.dispose(); merlin.current = null;
      releaseTrackingCanvas(trackingCanvas.current);
    };
  }, [settings.tracking.enabled, settings.enabled, live, settings.deviceId]);
  useEffect(() => {
    const api = window.cameraPresenter;
    if (!api) return;
    let disposed = false, frame = 0, effects: CameraEffects | null = null;
    let state: CameraStatus['state'] = settings.enabled ? 'starting' : 'off';
    let message: string | undefined;
    let devices: CameraStatus['devices'] = [];
    const video = document.createElement('video');
    video.muted = true; video.autoplay = true; video.playsInline = true;
    const owner = session.current!;
    const report = () => { if (!disposed) api.report({ state, message, devices }); };
    const enumerate = async () => {
      try {
        const list = await navigator.mediaDevices?.enumerateDevices();
        if (disposed) return;
        devices = (list ?? []).filter(d => d.kind === 'videoinput').map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
        report();
      } catch { /* Device names are optional until permission is granted. */ }
    };
    const fail = (error: unknown) => {
      if (disposed) return;
      state = 'error'; message = cameraError(error); setLive(false);
      tracking.current?.dispose(); tracking.current = null;
      merlin.current?.dispose(); merlin.current = null;
      releaseTrackingCanvas(trackingCanvas.current);
      cancelAnimationFrame(frame); owner.stop(); video.srcObject = null;
      effects?.dispose(); effects = null; report();
    };
    const contextLost = (event: Event) => { event.preventDefault(); fail(new Error('Camera graphics context was lost. Turn camera off and on to retry.')); };
    const element = canvas.current!;
    element.addEventListener('webglcontextlost', contextLost);
    navigator.mediaDevices?.addEventListener('devicechange', enumerate);
    const unload = () => { tracking.current?.dispose(); merlin.current?.dispose(); owner.stop(); };
    window.addEventListener('pagehide', unload);
    setLive(false); report(); void enumerate();
    if (settings.enabled) {
      void (async () => {
        try {
          effects = new CameraEffects(element);
          const stream = await owner.start(settings.deviceId);
          if (!stream || disposed) return;
          stream.getVideoTracks().forEach(track => track.addEventListener('ended', () => fail(new Error('Camera disconnected. Select another camera or turn it off and on.')), { once: true }));
          video.srcObject = stream;
          await video.play();
          if (disposed) return;
          state = 'live'; setLive(true); report(); void enumerate();
          let lastDraw = 0,draws=0,fpsStart=performance.now(),renderFps=30;
          const draw = (time: number) => {
            if (disposed || !effects) return;
            try {
              if (latest.current.preset !== 'hidden' && time - lastDraw >= 1000 / 30) {
                draws++;if(time-fpsStart>=1000){renderFps=draws*1000/(time-fpsStart);draws=0;fpsStart=time;}
                removal.current?.sample(video,time,renderFps);const mask=removal.current?.mask(time)??null;
                const vis=latest.current.personRemoval&&!mask?'hidden':'visible';
                element.style.visibility=vis;
                if (merlinCanvas.current) merlinCanvas.current.style.visibility=vis;
                trackingCanvas.current!.style.visibility=vis;
                element.dataset.personMask=latest.current.personRemoval?(mask?'fresh':'waiting'):'off';
                effects.draw(video, latest.current, mask); lastDraw = time - ((time - lastDraw) % (1000 / 30));
                // Tracking failure is isolated from camera capture and keying.
                try {
                  tracking.current?.sample(video, time);
                  const currentPose = tracking.current?.pose(time) ?? null;
                  merlin.current?.updateAndRender(
                    currentPose,
                    latest.current.tracking,
                    latest.current.mirror,
                    video.videoWidth,
                    video.videoHeight,
                    time
                  );
                  drawTracking(trackingCanvas.current!, currentPose, latest.current.tracking,
                    latest.current.mirror, video.videoWidth, video.videoHeight);
                } catch {
                  tracking.current?.dispose(); tracking.current = null;
                  merlin.current?.clear();
                  trackingCanvas.current!.width = video.videoWidth;
                  api.reportTracking?.({ state: 'error', message: 'Tracking overlay failed. Turn tracking off and on to retry.' });
                }
              }
              frame = requestAnimationFrame(draw);
            } catch (error) { fail(error); }
          };
          frame = requestAnimationFrame(draw);
        } catch (error) { fail(error); }
      })();
    } else owner.stop();
    return () => {
      disposed = true; cancelAnimationFrame(frame); owner.stop();
      tracking.current?.dispose(); tracking.current = null;
      merlin.current?.dispose(); merlin.current = null;
      releaseTrackingCanvas(trackingCanvas.current);
      video.pause(); video.srcObject = null; effects?.dispose();
      element.removeEventListener('webglcontextlost', contextLost);
      navigator.mediaDevices?.removeEventListener('devicechange', enumerate);
      window.removeEventListener('pagehide', unload);
    };
  }, [settings.enabled, settings.deviceId]);
  const layout = draftLayout ?? settings.layout;
  const commit = (next: CameraLayout) => { setSettings(old=>({...old,layout:next})); window.cameraPresenter?.setLayout?.(next); };
  return <div ref={layer} className={`camera-layer camera-${settings.preset}${layout?' camera-free':''}${settings.editLayout?' camera-editing':''}`} data-camera-live={live}
    onPointerDown={e=>{
      if(!settings.editLayout || e.button!==0)return;
      const rect=e.currentTarget.getBoundingClientRect(),parent=e.currentTarget.parentElement!.getBoundingClientRect();
      const initial={x:(rect.left-parent.left)/parent.width,y:(rect.top-parent.top)/parent.height,width:rect.width/parent.width,height:rect.height/parent.height};
      drag.current={x:e.clientX,y:e.clientY,layout:initial,mode:((e.target as HTMLElement).closest<HTMLElement>('.camera-resize')?.dataset.corner as CameraCorner)??'move',parent};
      e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault(); e.stopPropagation();
    }}
    onPointerMove={e=>{
      const d=drag.current;if(!d)return;const dx=(e.clientX-d.x)/d.parent.width,dy=(e.clientY-d.y)/d.parent.height;
      const next=transformCameraLayout(d.layout,d.mode,dx,dy);draft.current=next;setDraftLayout(next);
    }}
    onPointerUp={e=>{if(!drag.current)return;if(draft.current)commit(draft.current);drag.current=null;draft.current=null;setDraftLayout(null);e.currentTarget.releasePointerCapture(e.pointerId);}}
    onPointerCancel={()=>{drag.current=null;draft.current=null;setDraftLayout(null);}}
    onLostPointerCapture={()=>{drag.current=null;draft.current=null;setDraftLayout(null);}}
    style={{ visibility: live && settings.preset !== 'hidden' ? 'visible' : 'hidden', ...(layout?{left:`${layout.x*100}%`,top:`${layout.y*100}%`,width:`${layout.width*100}%`,height:`${layout.height*100}%`,right:'auto',bottom:'auto'}:{}) }}>
    <canvas ref={canvas} style={{visibility:settings.personRemoval?'hidden':'visible'}} />
    <canvas ref={merlinCanvas} className="face-tracking-overlay merlin-costume-overlay" style={{visibility:settings.personRemoval?'hidden':'visible'}} />
    <canvas ref={trackingCanvas} className="face-tracking-overlay" style={{visibility:settings.personRemoval?'hidden':'visible'}} />
    {settings.editLayout && <><span className="camera-move-hint">Drag to move</span>{(['nw','ne','sw','se'] as const).map(corner=><button key={corner} type="button" data-corner={corner} className={`camera-resize camera-resize-${corner}`} aria-label={`Resize camera ${ {nw:'top left',ne:'top right',sw:'bottom left',se:'bottom right'}[corner]}`} title="Drag corner to resize; arrow keys also work" onKeyDown={e=>{
      if(!e.key.startsWith('Arrow'))return;e.preventDefault();e.stopPropagation();const rect=layer.current!.getBoundingClientRect(),p=layer.current!.parentElement!.getBoundingClientRect();const l=layout??{x:(rect.left-p.left)/p.width,y:(rect.top-p.top)/p.height,width:rect.width/p.width,height:rect.height/p.height};commit(transformCameraLayout(l,corner,e.key==='ArrowRight'?.02:e.key==='ArrowLeft'?-.02:0,e.key==='ArrowDown'?.02:e.key==='ArrowUp'?-.02:0));
    }}>{ {nw:'↖',ne:'↗',sw:'↙',se:'↘'}[corner]}</button>)}</>}

  </div>;
}
