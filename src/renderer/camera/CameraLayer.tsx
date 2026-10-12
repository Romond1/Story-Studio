import { useEffect, useRef, useState } from 'react';
import { CAMERA_DEFAULTS, type CameraSettings, type CameraStatus } from '../../shared/cameraProtocol';
import { CameraSession } from '../../shared/cameraSession';
import { CameraEffects } from './CameraEffects';
import { FaceTrackingSession } from './tracking/FaceTrackingSession';
import { drawTracking, releaseTrackingCanvas } from './tracking/drawTracking';
import './camera.css';

function cameraError(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Camera permission denied. Allow camera access in system privacy settings, then turn camera off and on.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'Selected camera is unavailable. Connect it or select another camera.';
  if (name === 'NotReadableError' || name === 'AbortError') return 'Camera could not start. Close other camera apps, then turn camera off and on.';
  return error instanceof Error ? error.message : 'Camera failed. Turn camera off and on to retry.';
}

export function CameraLayer() {
  const [settings, setSettings] = useState<CameraSettings>(CAMERA_DEFAULTS);
  const latest = useRef(settings); latest.current = settings;
  const canvas = useRef<HTMLCanvasElement>(null);
  const trackingCanvas = useRef<HTMLCanvasElement>(null);
  const tracking = useRef<FaceTrackingSession | null>(null);
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
  useEffect(() => {
    if (!settings.tracking.enabled || !settings.enabled || !live) {
      releaseTrackingCanvas(trackingCanvas.current);
      window.cameraPresenter?.reportTracking?.({ state: 'off' });
      return;
    }
    try {
      tracking.current = new FaceTrackingSession(status => window.cameraPresenter?.reportTracking?.(status));
    } catch {
      window.cameraPresenter?.reportTracking?.({ state: 'error', message: 'Unable to start the face tracking worker. Turn tracking off and on to retry.' });
    }
    return () => { tracking.current?.dispose(); tracking.current = null; releaseTrackingCanvas(trackingCanvas.current); };
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
      releaseTrackingCanvas(trackingCanvas.current);
      cancelAnimationFrame(frame); owner.stop(); video.srcObject = null;
      effects?.dispose(); effects = null; report();
    };
    const contextLost = (event: Event) => { event.preventDefault(); fail(new Error('Camera graphics context was lost. Turn camera off and on to retry.')); };
    const element = canvas.current!;
    element.addEventListener('webglcontextlost', contextLost);
    navigator.mediaDevices?.addEventListener('devicechange', enumerate);
    const unload = () => { tracking.current?.dispose(); owner.stop(); };
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
          let lastDraw = 0;
          const draw = (time: number) => {
            if (disposed || !effects) return;
            try {
              if (latest.current.preset !== 'hidden' && time - lastDraw >= 1000 / 30) {
                effects.draw(video, latest.current); lastDraw = time - ((time - lastDraw) % (1000 / 30));
                // Tracking failure is isolated from camera capture and keying.
                try {
                  tracking.current?.sample(video, time);
                  drawTracking(trackingCanvas.current!, tracking.current?.pose(time) ?? null, latest.current.tracking,
                    latest.current.mirror, video.videoWidth, video.videoHeight);
                } catch {
                  tracking.current?.dispose(); tracking.current = null;
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
      releaseTrackingCanvas(trackingCanvas.current);
      video.pause(); video.srcObject = null; effects?.dispose();
      element.removeEventListener('webglcontextlost', contextLost);
      navigator.mediaDevices?.removeEventListener('devicechange', enumerate);
      window.removeEventListener('pagehide', unload);
    };
  }, [settings.enabled, settings.deviceId]);
  return <div className={`camera-layer camera-${settings.preset}`} data-camera-live={live} aria-hidden="true"
    style={{ visibility: live && settings.preset !== 'hidden' ? 'visible' : 'hidden' }}>
    <canvas ref={canvas} />
    <canvas ref={trackingCanvas} className="face-tracking-overlay" />
  </div>;
}
