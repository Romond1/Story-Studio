/** Serial acquisition, including unabortable permission requests. No media/audio globals. */
export class CameraSession<T> {
  private generation = 0;
  private current: T | null = null;
  private pending: Promise<unknown> = Promise.resolve();
  constructor(private acquire: (deviceId: string) => Promise<T>, private release: (stream: T) => void) {}
  stop(): void {
    this.generation++;
    if (this.current) { this.release(this.current); this.current = null; }
  }
  start(deviceId: string): Promise<T | null> {
    this.stop();
    const generation = this.generation;
    const next = this.pending.catch(() => {}).then(async () => {
      if (generation !== this.generation) return null;
      const stream = await this.acquire(deviceId);
      if (generation !== this.generation) { this.release(stream); return null; }
      this.current = stream;
      return stream;
    });
    this.pending = next;
    return next;
  }
}
