
export class AudioEngine {
    private static instance: AudioEngine;
    private activeSounds: Set<{ audio: HTMLAudioElement, handle: SoundHandle }> = new Set();
    private bgmAudio: HTMLAudioElement | null = null; // Dedicated slot for BGM if needed, or just track all.

    private constructor() { }

    public static getInstance(): AudioEngine {
        if (!AudioEngine.instance) {
            AudioEngine.instance = new AudioEngine();
        }
        return AudioEngine.instance;
    }

    public play(url: string, options?: { loop?: boolean; volume?: number }): SoundHandle {
        const audio = new Audio(url);
        audio.volume = options?.volume ?? 1;
        audio.loop = options?.loop ?? false;

        const handle: SoundHandle = {
            stop: () => {
                audio.pause();
                audio.currentTime = 0;
                this.activeSounds.delete(record);
            },
            element: audio,
            onEnded: undefined
        };

        const record = { audio, handle };
        this.activeSounds.add(record);

        // Cleanup on end (if not looping)
        audio.onended = () => {
            if (!audio.loop) {
                this.activeSounds.delete(record);
                if (handle.onEnded) handle.onEnded();
            }
        };

        audio.play().catch(e => {
            console.error("AudioEngine: Play failed", e);
            // We could trigger onEnded or error?
        });

        return handle;
    }

    public stopAll() {
        this.activeSounds.forEach(({ audio }) => {
            audio.pause();
            audio.currentTime = 0;
        });
        this.activeSounds.clear();
    }
}

export interface SoundHandle {
    element: HTMLAudioElement;
    stop: () => void;
    onEnded?: () => void;
}

export const audioEngine = AudioEngine.getInstance();
