export class AudioRouting {
    private outputNode: HTMLAudioElement;
    private monitorNode: HTMLAudioElement;

    constructor() {
        this.outputNode = new Audio();
        this.outputNode.autoplay = true;

        this.monitorNode = new Audio();
        this.monitorNode.autoplay = true;
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
            console.log(`[AudioRouting] Set monitor sink ID to: ${deviceId}`);
        } catch (e) {
            console.error(`[AudioRouting] Failed to set monitor sink ID to ${deviceId}, falling back to master.`, e);
            try {
                // @ts-ignore - Fallback to current master sinkId
                await this.monitorNode.setSinkId(this.outputNode.sinkId || "");
            } catch (fallbackErr) {
                console.error("[AudioRouting] Fallback also failed", fallbackErr);
            }
        }
    }

    public setSourceStream(stream: MediaStream) {
        this.outputNode.srcObject = stream;
    }

    public setMonitorStream(stream: MediaStream) {
        this.monitorNode.srcObject = stream;
    }
}

export const audioRouting = new AudioRouting();
