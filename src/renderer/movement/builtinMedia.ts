import color from '../../../assets/touch_color.gif';
import run from '../../../assets/run.gif';
import mia from '../../../assets/hero_pose_mia.gif';
import yuki from '../../../assets/hero_pose_yuki.gif';
import head from '../../../assets/touch_head.gif';
import nose from '../../../assets/touch_nose.gif';
import jingle from '../../../assets/jingle.mp3';
import { compatibilityMediaUrl } from '../../shared/content/mediaResolution';
import type { MediaPathResolver } from '../../shared/content/mediaRenderResolution';
const gifs: Record<string, string> = { 'assets/touch_color.gif': color, 'assets/run.gif': run, 'assets/hero_pose_mia.gif': mia, 'assets/hero_pose_yuki.gif': yuki, 'assets/touch_head.gif': head, 'assets/touch_nose.gif': nose };
export const builtinMovementJingle = jingle;
export function movementMediaUrl(path: string, eventId = '', resolve: MediaPathResolver = compatibilityMediaUrl): string {
 path = path.replace(/\\/g, '/');
 const builtin = path === 'assets/jingle.mp3' ? jingle : gifs[path];
 if (builtin) return builtin;
 const url = resolve(path); return url ? `${url}${url.includes('?') ? '&' : '?'}movement=${encodeURIComponent(eventId)}` : '';
}
