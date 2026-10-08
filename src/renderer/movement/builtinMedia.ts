import color from '../../../assets/touch_color.gif';
import run from '../../../assets/run.gif';
import mia from '../../../assets/hero_pose_mia.gif';
import yuki from '../../../assets/hero_pose_yuki.gif';
import head from '../../../assets/touch_head.gif';
import nose from '../../../assets/touch_nose.gif';
import jingle from '../../../assets/jingle.mp3';
const gifs: Record<string, string> = { 'assets/touch_color.gif': color, 'assets/run.gif': run, 'assets/hero_pose_mia.gif': mia, 'assets/hero_pose_yuki.gif': yuki, 'assets/touch_head.gif': head, 'assets/touch_nose.gif': nose };
export const builtinMovementJingle = jingle;
export function movementMediaUrl(path: string, eventId = ''): string {
 path = path.replace(/\\/g, '/');
 return (path === 'assets/jingle.mp3' ? jingle : gifs[path]) ?? `media://${path.split('/').map(encodeURIComponent).join('/')}?movement=${encodeURIComponent(eventId)}`;
}
