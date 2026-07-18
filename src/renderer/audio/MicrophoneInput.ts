import { audioController } from "./AudioController";

export class MicrophoneInput {
  enableMic(deviceId?: string): Promise<void> {
    return audioController.enableMic(deviceId);
  }

  disableMic(): void {
    audioController.disableMic();
  }

  isEnabled(): boolean {
    return audioController.isMicEnabled();
  }
}

export const micInput = new MicrophoneInput();
