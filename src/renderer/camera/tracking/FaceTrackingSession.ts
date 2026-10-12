import { FacePoseFilter, FrameGate, type FaceObservation, type FacePose } from '../../../shared/faceTracking';
import type { TrackingStatus } from '../../../shared/faceTrackingProtocol';

/** Owns inference only. Never owns, acquires or stops a MediaStream. */
export class FaceTrackingSession {
  private worker: Worker;
  private disposed = false;
  private ready = false;
  private gate = new FrameGate();
  private filter = new FacePoseFilter();
  private watchdog: ReturnType<typeof setTimeout>;
  private status = '';
  constructor(private report: (status: TrackingStatus) => void) {
    const baseUrl = new URL('face-tracking/', document.baseURI).href;
    this.worker = new Worker(new URL('face.worker.js', baseUrl));
    this.emit({ state: 'initializing' });
    this.watchdog = setTimeout(() => this.fail('Face tracker initialization timed out. Turn tracking off and on to retry.'), 20000);
    this.worker.onerror = event => { event.preventDefault(); this.fail('Face tracking worker failed. Turn tracking off and on to retry.'); };
    this.worker.onmessageerror = () => this.fail('Face tracking message could not be read. Restart tracking.');
    this.worker.onmessage = ({ data }: MessageEvent<{ type: string; message?: string; timestamp: number; observation: FaceObservation | null }>) => {
      if (this.disposed) return;
      if (data.type === 'error') { this.fail(`Face tracking failed: ${data.message ?? 'unknown error'}`); return; }
      clearTimeout(this.watchdog);
      if (data.type === 'ready') { this.ready = true; this.emit({ state: 'face-lost', message: 'Looking for a face…' }); return; }
      if (data.type === 'result') {
        const now = performance.now();
        const pose = this.filter.update(this.gate.finish(data.timestamp, now) ? data.observation : null, now);
        this.emit({ state: pose ? 'tracking' : 'face-lost' });
      }
    };
    this.worker.postMessage({ type: 'init', baseUrl });
  }
  private emit(status: TrackingStatus) {
    const key = JSON.stringify(status);
    if (key !== this.status) { this.status = key; this.report(status); }
  }
  private fail(message: string) {
    if (this.disposed) return;
    this.dispose(); this.emit({ state: 'error', message });
  }
  sample(video: HTMLVideoElement, now: number): void {
    if (this.disposed || !this.ready || video.readyState < 2 || !video.videoWidth || !this.gate.begin(now)) return;
    this.watchdog = setTimeout(() => this.fail('Face tracking stopped responding. Turn tracking off and on to retry.'), 3000);
    const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
    void createImageBitmap(video, { resizeWidth: Math.max(1, Math.round(video.videoWidth * scale)), resizeHeight: Math.max(1, Math.round(video.videoHeight * scale)), resizeQuality: 'low' }).then(bitmap => {
      if (this.disposed) { bitmap.close(); return; }
      try { this.worker.postMessage({ type: 'frame', timestamp: now, bitmap }, [bitmap]); }
      catch (error) { bitmap.close(); this.fail(error instanceof Error ? error.message : 'Unable to send camera frame to tracker.'); }
    }).catch(() => this.fail('Unable to prepare a camera frame for tracking. Turn tracking off and on to retry.'));
  }
  pose(now: number): FacePose | null {
    const pose = this.filter.current(now);
    if (!pose && this.ready && !this.disposed && this.status === '{"state":"tracking"}') this.emit({ state: 'face-lost' });
    return this.disposed ? null : pose;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; clearTimeout(this.watchdog);
    this.worker.onmessage = null; this.worker.onerror = null; this.worker.onmessageerror = null;
    this.worker.terminate(); this.filter.update(null, performance.now());
  }
}
