import { audioManager } from "./AudioManager";

export class MicrophoneInput {
    private mediaStream: MediaStream | null = null;
    private sourceNode: MediaStreamAudioSourceNode | null = null;
    private gainNode: GainNode | null = null;

    public async enableMic(deviceId?: string) {
        if (this.mediaStream) {
            this.disableMic(); // re-enable clean if switching
        }

        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: deviceId ? { deviceId: { exact: deviceId } } : true
            });
            const ctx = audioManager.getContext();

            // Safari requires context resume when using mic 
            if (ctx.state === "suspended") await ctx.resume();

            this.sourceNode = ctx.createMediaStreamSource(this.mediaStream);
            this.gainNode = ctx.createGain();
            this.gainNode.gain.value = 1.0;

            // Prevent local echo by ONLY sending this to the CableGain bus, 
            // preventing loops going straight to OS Default out
            this.sourceNode.connect(this.gainNode);
            this.gainNode.connect(audioManager.getCableGain());

            console.log("[Mic] Enabled and routed to MasterMix");
        } catch (e) {
            console.error("[Mic] Failed to enable microphone", e);
            throw e;
        }
    }

    public disableMic() {
        if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = null;
        }
        if (this.sourceNode) {
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach((t) => t.stop());
            this.mediaStream = null;
        }
        console.log("[Mic] Disabled");
    }

    public isEnabled(): boolean {
        return this.mediaStream !== null;
    }
}

export const micInput = new MicrophoneInput();
