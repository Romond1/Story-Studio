import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { CAMERA_DEFAULTS, parseCameraSettings, type CameraSettings } from '../shared/cameraProtocol';

/** Camera configuration survives restart; acquisition always requires a new explicit request. */
export function createCameraPreferencesStore(file: string) {
  return {
    load(): CameraSettings {
      try {
        const settings = parseCameraSettings(JSON.parse(readFileSync(file, 'utf8')));
        if (settings) return { ...settings, enabled: false };
      } catch { /* Missing or invalid preferences use safe defaults. */ }
      return JSON.parse(JSON.stringify(CAMERA_DEFAULTS));
    },
    save(value: CameraSettings): void {
      const settings = parseCameraSettings(value);
      if (!settings) throw new Error('Invalid camera preferences.');
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(`${file}.tmp`, JSON.stringify({ ...settings, enabled: false }), 'utf8');
      renameSync(`${file}.tmp`, file);
    },
  };
}
