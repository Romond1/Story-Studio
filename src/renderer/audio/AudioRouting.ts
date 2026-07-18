import { audioController } from "./AudioController";

export class AudioRouting {
  listDevices(): Promise<{ inputs: MediaDeviceInfo[]; outputs: MediaDeviceInfo[] }> {
    return audioController.listDevices();
  }

  setDevice(deviceId: string): Promise<void> {
    return audioController.setDevice(deviceId);
  }

  setMonitorDevice(deviceId: string): Promise<void> {
    return audioController.setMonitorDevice(deviceId);
  }

  setSourceStream(_stream: MediaStream): void {
    // Compatibility no-op: AudioController owns the Mix Output destination.
  }

  setMonitorStream(_stream: MediaStream): void {
    // Compatibility no-op: AudioController owns the Monitor Output destination.
  }
}

export const audioRouting = new AudioRouting();
