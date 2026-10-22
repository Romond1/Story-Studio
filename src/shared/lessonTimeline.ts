export function timelineZoom(value:number){return Math.max(.45,Math.min(2.6,value));}
export function zoomScroll(scroll:number,pointer:number,oldWidth:number,newWidth:number){return Math.max(0,(scroll+pointer)*newWidth/oldWidth-pointer);}
export function timelineDensity(zoom:number){return zoom<.75?'overview':zoom<1.25?'normal':zoom<1.9?'detail':'frame';}
import { mediaDisplayTitle } from './mediaDisplayName';
import type { AssetItem } from './types';
import type { LessonScene } from './lesson/model';

export function timelineSceneTitle(scene?: Pick<LessonScene, 'title'>, asset?: Readonly<AssetItem>): string {
  if (!scene) return 'Missing scene';
  const title = scene.title;
  return asset && (!title || title === asset.originalName || title === asset.filename) ? mediaDisplayTitle(asset) : title || 'Untitled scene';
}
