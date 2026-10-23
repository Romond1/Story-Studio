import { TRACKING_DEFAULTS, parseTrackingSettings, type TrackingSettings, type TrackingStatus } from './faceTrackingProtocol';
import type {RemovalStatus} from './personRemoval';
export type CameraPreset = 'full' | 'lower-left' | 'lower-right' | 'hidden';
export type CameraLayout = { x: number; y: number; width: number; height: number };
export type CameraCorner = 'nw'|'ne'|'sw'|'se';
const cameraClamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
/** Positions may cross any edge; retain a small visible strip and a bounded canvas. */
export function transformCameraLayout(layout:CameraLayout,mode:CameraCorner|'move',dx:number,dy:number):CameraLayout {
  if(!Number.isFinite(dx)||!Number.isFinite(dy))return layout;
  let {x,y,width,height}=layout;
  if(mode==='move'){x+=dx;y+=dy;}
  else {
    width=cameraClamp(layout.width+(mode.includes('w')?-dx:dx),.03,4);
    height=cameraClamp(layout.height+(mode.includes('n')?-dy:dy),.03,4);
    if(mode.includes('w'))x=layout.x+layout.width-width;
    if(mode.includes('n'))y=layout.y+layout.height-height;
  }
  return {x:cameraClamp(x,-width+.015,.985),y:cameraClamp(y,-height+.015,.985),width,height};
}
export function validCameraLayout(value: unknown): value is CameraLayout {
  if (!value || typeof value !== 'object') return false;
  const v = value as CameraLayout;
  return [v.x,v.y,v.width,v.height].every(Number.isFinite)
    && v.width >= .03 && v.height >= .03 && v.width <= 4 && v.height <= 4
    && v.x <= .985001 && v.y <= .985001 && v.x + v.width >= .014999 && v.y + v.height >= .014999;
}
export interface CameraSettings {
  personRemoval?:boolean;
  layout?: CameraLayout; editLayout?: boolean;
  enabled: boolean; deviceId: string; preset: CameraPreset; chromaKey: boolean;
  tolerance: number; softness: number; brightness: number; contrast: number; mirror: boolean;
  tracking: TrackingSettings;
}
export const CAMERA_DEFAULTS: CameraSettings = {
  enabled: false, deviceId: '', preset: 'lower-right', chromaKey: false,
  tolerance: 0.28, softness: 0.12, brightness: 0, contrast: 1, mirror: true,
  tracking: TRACKING_DEFAULTS,
};
export interface CameraStatus {
  state: 'off' | 'starting' | 'live' | 'error';
  message?: string;
  devices: { deviceId: string; label: string }[];
}
export interface CameraState { settings: CameraSettings; status: CameraStatus; trackingStatus?: TrackingStatus; removalStatus?:RemovalStatus; preferencesSaved?: boolean }
export interface CameraControlApi {
  get(): Promise<CameraState>;
  set(settings: CameraSettings): Promise<CameraState>;
  subscribe(listener: (state: CameraState) => void): () => void;
}
export interface CameraPresenterApi {
  reportRemoval?(status:RemovalStatus):void;
  setLayout?(layout: CameraLayout): void;
  get(): Promise<CameraSettings>;
  subscribe(listener: (settings: CameraSettings) => void): () => void;
  report(status: CameraStatus): void;
  reportTracking(status: TrackingStatus): void;
}
export function parseCameraSettings(value: unknown): CameraSettings | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as CameraSettings;
  if(v.personRemoval!==undefined&&typeof v.personRemoval!=='boolean')return null;
  if (v.layout !== undefined && !validCameraLayout(v.layout) || v.editLayout !== undefined && typeof v.editLayout !== 'boolean') return null;
  const tracking = parseTrackingSettings(v.tracking ?? TRACKING_DEFAULTS);
  if (!tracking) return null;
  if (typeof v.enabled !== 'boolean' || typeof v.chromaKey !== 'boolean' || typeof v.mirror !== 'boolean'
    || typeof v.deviceId !== 'string' || v.deviceId.length > 1024
    || !['full', 'lower-left', 'lower-right', 'hidden'].includes(v.preset)) return null;
  for (const [key, min, max] of [['tolerance', 0, 1], ['softness', 0.001, 0.5], ['brightness', -1, 1], ['contrast', 0, 2]] as const) {
    if (typeof v[key] !== 'number' || !Number.isFinite(v[key]) || v[key] < min || v[key] > max) return null;
  }
  return { enabled: v.enabled, deviceId: v.deviceId, preset: v.preset, chromaKey: v.chromaKey,
    tolerance: v.tolerance, softness: v.softness, brightness: v.brightness, contrast: v.contrast, mirror: v.mirror, tracking,
    ...(v.personRemoval!==undefined?{personRemoval:v.personRemoval}:{}), ...(v.layout ? {layout:{x:v.layout.x,y:v.layout.y,width:v.layout.width,height:v.layout.height}} : {}), ...(v.editLayout !== undefined ? {editLayout:v.editLayout} : {}) };
}
export function parseCameraStatus(value: unknown): CameraStatus | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as CameraStatus;
  if (!['off', 'starting', 'live', 'error'].includes(v.state) || !Array.isArray(v.devices) || v.devices.length > 64
    || (v.message !== undefined && typeof v.message !== 'string')) return null;
  if (!v.devices.every(d => d && typeof d.deviceId === 'string' && d.deviceId.length <= 1024 && typeof d.label === 'string')) return null;
  return { state: v.state, message: v.message?.slice(0, 512), devices: v.devices.map(d => ({ deviceId: d.deviceId, label: d.label.slice(0, 256) })) };
}
