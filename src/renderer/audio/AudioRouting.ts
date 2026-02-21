// src/renderer/audio/AudioRouting.ts
export class AudioRouting {
    private outputNode: HTMLAudioElement;
    private monitorNode: HTMLAudioElement;
    private monitorStream: MediaStream | null = null;
    private monitorDeviceChangeToken = 0;

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
    }

    private async safePlay(node: HTMLAudioElement, label: string) {
        try {
            await node.play();
        } catch (err) {
            console.warn(`[AudioRouting] Could not autoplay ${label}`, err);
        }
    }

    private ensureMonitorPlayback() {
        if (!this.monitorStream) {
            this.monitorNode.pause();
            return;
        }
        if (this.monitorNode.srcObject !== this.monitorStream) {
            this.monitorNode.srcObject = this.monitorStream;
        }
        this.safePlay(this.monitorNode, "monitor node");
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
            await this.safePlay(this.outputNode, "output node");
            if (this.sinksAreSame()) {
                this.disableMonitorPlayback();
            } else {
                this.ensureMonitorPlayback();
            }
            console.log(`[AudioRouting] Set sink ID to: ${deviceId}`);
        } catch (e) {
            console.error(`[AudioRouting] Failed to set sink ID to ${deviceId}`, e);
            throw e;
        }
    }

    public async setMonitorDevice(deviceId: string): Promise<void> {
        const token = ++this.monitorDeviceChangeToken;
        try {
            // @ts-ignore
            await this.monitorNode.setSinkId(deviceId);

            if (token !== this.monitorDeviceChangeToken) {
                return;
            }

            if (this.sinksAreSame()) {
                this.disableMonitorPlayback();
            } else {
                this.ensureMonitorPlayback();
            }
            console.log(`[AudioRouting] Set monitor sink ID to: ${deviceId}`);
        } catch (e) {
            console.error(`[AudioRouting] Failed to set monitor sink ID to ${deviceId}`, e);
            if (token !== this.monitorDeviceChangeToken) {
                return;
            }
            if (this.sinksAreSame()) {
                this.disableMonitorPlayback();
            } else {
                this.ensureMonitorPlayback();
            }
        }
    }

    public setSourceStream(stream: MediaStream) {
        if (this.outputNode.srcObject !== stream) {
            this.outputNode.srcObject = stream;
        }
        this.safePlay(this.outputNode, "output node");
    }

    public setMonitorStream(stream: MediaStream) {
        this.monitorStream = stream;
        if (this.sinksAreSame()) {
            this.disableMonitorPlayback();
            return;
        }
        this.ensureMonitorPlayback();
    }
}

export const audioRouting = new AudioRouting();
