/** Records the existing clean microphone. This module never owns or stops its tracks. */
export function captureUtterance(stream: MediaStream, current: () => MediaStream | null, complete: (audio: number[]) => void, fail: (error: string) => void) {
  const tracks = stream.getAudioTracks();
  if (!tracks.length || tracks.some(t => t.readyState !== 'live')) throw new Error('Enable a microphone in Audio settings first.');
  const recorder = new MediaRecorder(new MediaStream(tracks));
  const chunks: Blob[] = [];
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout>;
  let watch: ReturnType<typeof setInterval>;
  const clean = () => { clearTimeout(timer); clearInterval(watch); tracks.forEach(t => t.removeEventListener('ended', disconnected)); };
  const cancel = () => { cancelled = true; clean(); if (recorder.state !== 'inactive') recorder.stop(); };
  const disconnected = () => { if (cancelled) return; cancel(); fail('Microphone changed or disconnected. Please record again.'); };
  const stop = () => { clean(); if (recorder.state !== 'inactive') recorder.stop(); };
  recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
  recorder.onerror = () => { if (cancelled) return; cancel(); fail('Microphone recording failed.'); };
  recorder.onstop = () => {
    clean();
    if (cancelled) return;
    void (async () => {
      let context: AudioContext | undefined;
      try {
        context = new AudioContext();
        const decoded = await context.decodeAudioData(await new Blob(chunks, { type: recorder.mimeType }).arrayBuffer());
        if (cancelled) return;
        const length = Math.min(320000, Math.ceil(decoded.duration * 16000));
        if (!length) throw new Error('No microphone audio recorded.');
        const offline = new OfflineAudioContext(1, length, 16000);
        const source = offline.createBufferSource(); source.buffer = decoded; source.connect(offline.destination); source.start();
        const rendered = await offline.startRendering();
        if (!cancelled) complete(Array.from(rendered.getChannelData(0)));
      } catch (error) { if (!cancelled) fail(error instanceof Error ? error.message : 'Unable to read microphone audio.'); }
      finally { await context?.close().catch(() => {}); }
    })();
  };
  tracks.forEach(t => t.addEventListener('ended', disconnected));
  try { recorder.start(); } catch (error) { cancel(); throw error; }
  timer = setTimeout(stop, 20000);
  watch = setInterval(() => { const latest = current()?.getAudioTracks() ?? []; if (tracks.some(t => !latest.includes(t) || t.readyState !== 'live')) disconnected(); }, 250);
  return { stop, cancel };
}
