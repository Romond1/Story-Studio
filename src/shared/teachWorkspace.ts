import { fitLogicalFrame, type LogicalFrame } from './staticScene';
/** Runtime device geometry, never part of a lesson file. */
export function parsePresentViewport(value: unknown): LogicalFrame | null {
 if (!value || typeof value !== 'object') return null;
 const {width,height}=value as LogicalFrame;
 return typeof width==='number' && typeof height==='number' && Number.isFinite(width) && Number.isFinite(height) && width>0 && height>0 && width<=32768 && height<=32768 ? {width,height}:null;
}
export function fitPreviewViewport(viewport: LogicalFrame, available: LogicalFrame) {
 const fit=fitLogicalFrame(viewport,available);
 return {...fit,width:viewport.width*fit.scale,height:viewport.height*fit.scale};
}
export function previewPoint(point:{x:number;y:number},rect:{x:number;y:number;width:number;height:number}) {
 if(rect.width<=0||rect.height<=0||point.x<rect.x||point.y<rect.y||point.x>rect.x+rect.width||point.y>rect.y+rect.height)return null;
 return {x:(point.x-rect.x)/rect.width,y:(point.y-rect.y)/rect.height};
}
export function clampTeachSplit(value:number) {return Number.isFinite(value)?Math.max(30,Math.min(65,value)):42;}

/** Keep at least 220px above the 10px bottom divider on laptop displays. */
export function clampTeachNavigatorHeight(value: number, workspaceHeight: number, minimum = 176): number {
 const maximum = Math.max(minimum, Math.min(400, workspaceHeight - 230));
 return Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : minimum));
}
/** Fit readable 100px tiles with 7px gaps into the expanded navigator. */
export function teachNavigatorRows(availableHeight: number): number {
 return Number.isFinite(availableHeight) ? Math.max(1, Math.min(3, Math.floor((availableHeight + 7) / 107))) : 1;
}
export function navigatorWheelDelta(deltaX: number, deltaY: number, deltaMode: number, pageWidth: number): number {
 const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
 return delta * (deltaMode === 1 ? 16 : deltaMode === 2 ? pageWidth : 1);
}
