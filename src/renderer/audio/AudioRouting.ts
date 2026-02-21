export class AudioRouting {
    private outputNode: HTMLAudioElement;
    private monitorNode: HTMLAudioElement;

    constructor() {
        this.outputNode = new Audio();
        this.outputNode.autoplay = true;

        this.monitorNode = new Audio();
        this.monitorNode.autoplay = true;
    }

    private normalizeSinkId(sinkId: string | undefined): string {
        const normalized = (sinkId || "").trim();
        return normalized === "" || normalized === "default" ? "default" : normalized;
    }

    private sinksAreSame(): boolean {
        // @ts-ignore - sinkId is available at runtime where setSinkId is supported
        const outputSink = this.normalizeSinkId(this.outputNode.sinkId);
        // @ts-ignore - sinkId is available at runtime where setSinkId is supported
        const monitorSink = this.normalizeSinkId(this.monitorNode.sinkId);
        return outputSink === monitorSink;
    }

    private disableMonitorPlayback() {
        this.monitorNode.pause();
        this.monitorNode.srcObject = null;
        this.monitorNode.load();
    }

    public async listDevices(): Promise<{ inputs: MediaDeviceInfo[], outputs: MediaDeviceInfo[] }> {
        try {
            // Must request permission first to get labels on some browsers/platforms
            await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (e) {
            console.warn("Could not get user media for device labels", e);
        }
        const devices = await navigator.mediaDevices.enumerateDevices();
        return {
            inputs: devices.filter(d => d.kind === "audioinput"),
            outputs: devices.filter(d => d.kind === "audiooutput")
        };
    }

    public async setDevice(deviceId: string): Promise<void> {
        try {
            // @ts-ignore - setSinkId is not in standard TS DOM lib yet
            await this.outputNode.setSinkId(deviceId);
            await this.outputNode.play();
            if (this.sinksAreSame()) {
                this.disableMonitorPlayback();
            }
            console.log(`[AudioRouting] Set sink ID to: ${deviceId}`);
        } catch (e) {
            console.error(`[AudioRouting] Failed to set sink ID to ${deviceId}`, e);
            throw e;
        }
    }

    public async setMonitorDevice(deviceId: string): Promise<void> {
        try {
            // @ts-ignore
            await this.monitorNode.setSinkId(deviceId);
            if (this.sinksAreSame()) {
                this.disableMonitorPlayback();
            } else {
                await this.monitorNode.play();
            }
            console.log(`[AudioRouting] Set monitor sink ID to: ${deviceId}`);
        } catch (e) {
            console.error(`[AudioRouting] Failed to set monitor sink ID to ${deviceId}, falling back to master.`, e);
            try {
                // @ts-ignore - Fallback to current master sinkId
                await this.monitorNode.setSinkId(this.outputNode.sinkId || "");
                this.disableMonitorPlayback();
            } catch (fallbackErr) {
                console.error("[AudioRouting] Fallback also failed", fallbackErr);
            }
        }
    }

    public setSourceStream(stream: MediaStream) {
        if (this.outputNode.srcObject !== stream) {
            this.outputNode.srcObject = stream;
        }
        this.outputNode.play().catch((err) => {
            console.warn("[AudioRouting] Could not autoplay output node", err);
        });
    }

    public setMonitorStream(stream: MediaStream) {
        if (this.sinksAreSame()) {
            this.disableMonitorPlayback();
            return;
        }
        if (this.monitorNode.srcObject !== stream) {
            this.monitorNode.srcObject = stream;
        }
        this.monitorNode.play().catch((err) => {
            console.warn("[AudioRouting] Could not autoplay monitor node", err);
        });
    }
}

export const audioRouting = new AudioRouting();
