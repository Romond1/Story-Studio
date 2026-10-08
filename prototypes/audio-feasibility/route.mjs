// Isolated feasibility harness. No imports from production AudioController.
export class AudioRoute {
  constructor(platform = {
    context: () => new AudioContext(),
    audio: () => new Audio(),
    microphone: constraints => navigator.mediaDevices.getUserMedia(constraints),
  }) {
    this.platform = platform;
    this.session = null;
    this.status = 'Stopped';
  }

  async start(sinkId) {
    if (this.session) throw Error('Stop the current route before starting another.');
    const ctx = this.platform.context();
    const audio = this.platform.audio();
    const session = { ctx, audio, sources: new Map(), clipRequests: new Map(), micId: '', sinkId, micRequest: 0 };
    this.session = session;
    this.status = 'Starting';
    try {
      if (typeof audio.setSinkId !== 'function') throw Error('This browser does not support setSinkId. Use desktop Chrome or Edge on localhost.');
      session.mix = ctx.createGain();
      session.mix.gain.value = 0.5;
      session.meter = ctx.createAnalyser();
      session.destination = ctx.createMediaStreamDestination();
      session.mix.connect(session.meter);
      session.meter.connect(session.destination);
      audio.srcObject = session.destination.stream;
      await audio.setSinkId(sinkId);
      if (this.session !== session) return;
      await ctx.resume();
      if (this.session !== session) return;
      await audio.play();
      if (this.session !== session) { audio.pause(); return; }
      this.status = 'Running — downstream reception unverified';
    } catch (error) {
      if (this.session === session) await this.stop();
      this.status = `Route error: ${error.message}`;
      throw error;
    }
  }

  active() {
    if (!this.session || this.session.ctx.state !== 'running') throw Error('Start the output route first.');
    return this.session;
  }

  stopSource(name) {
    const session = this.session;
    session?.clipRequests.set(name, (session.clipRequests.get(name) || 0) + 1);
    if (name === 'mic' && session) { session.micRequest++; session.micId = ''; }
    const source = session?.sources.get(name);
    if (!source) return;
    source.node.onended = null;
    source.node.stop?.();
    source.node.disconnect();
    source.meter?.disconnect();
    source.gain?.disconnect();
    source.stream?.getTracks().forEach(track => track.stop());
    session.sources.delete(name);
  }

  async microphone(deviceId) {
    const session = this.active();
    this.stopSource('mic');
    const request = ++session.micRequest;
    const stream = await this.platform.microphone({ audio: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      echoCancellation: false, noiseSuppression: false, autoGainControl: false,
    } });
    if (this.session !== session || request !== session.micRequest) {
      stream.getTracks().forEach(track => track.stop()); return;
    }
    const node = session.ctx.createMediaStreamSource(stream);
    const meter = session.ctx.createAnalyser();
    node.connect(meter); meter.connect(session.mix);
    session.sources.set('mic', { node, meter, stream });
    session.micId = deviceId || 'default';
  }

  tone() {
    const session = this.active(); this.stopSource('tone');
    const node = session.ctx.createOscillator();
    node.frequency.value = 440;
    const gain = session.ctx.createGain(); gain.gain.value = 0.12;
    node.connect(gain); gain.connect(session.mix);
    session.sources.set('tone', { node, gain }); node.start();
  }

  async clip(name, bytes, loop = false) {
    const session = this.active();
    this.stopSource(name);
    const request = session.clipRequests.get(name);
    const buffer = await session.ctx.decodeAudioData(bytes);
    if (this.session !== session || session.clipRequests.get(name) !== request) return;
    const node = session.ctx.createBufferSource();
    const gain = session.ctx.createGain(); gain.gain.value = 0.4;
    node.buffer = buffer; node.loop = loop;
    node.connect(gain); gain.connect(session.mix);
    session.sources.set(name, { node, gain });
    node.onended = () => { if (this.session === session && session.sources.get(name)?.node === node) this.stopSource(name); };
    node.start();
  }

  async stop() {
    const session = this.session;
    if (!session) return;
    for (const name of [...session.sources.keys()]) this.stopSource(name);
    this.session = null; this.status = 'Stopped';
    session.audio.pause(); session.audio.srcObject = null;
    session.destination?.stream.getTracks().forEach(track => track.stop());
    session.mix?.disconnect(); session.meter?.disconnect();
    if (session.ctx.state !== 'closed') await session.ctx.close();
  }

  diagnostics() {
    const s = this.session;
    const level = meter => {
      if (!meter) return 0;
      const values = new Float32Array(meter.fftSize);
      meter.getFloatTimeDomainData(values);
      return Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length);
    };
    return { status: this.status, context: s?.ctx.state ?? 'closed', sampleRate: s?.ctx.sampleRate ?? null,
      output: s?.sinkId ?? null, microphone: s?.micId ?? null,
      sources: [...(s?.sources.keys() ?? [])], microphoneRms: level(s?.sources.get('mic')?.meter), mixRms: level(s?.meter) };
  }
}
