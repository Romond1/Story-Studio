export type BubbleTail = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
export interface BubbleOptions { bubbleTail?: BubbleTail; appearDelayMs?: number; disappearAtMs?: number; }
export const BUBBLE_TAILS: BubbleTail[] = ['bottom-left','bottom-right','top-left','top-right'];
export const SCENE_BUBBLE_STYLES = [
  {id:'BD_CLASSIC',name:'Classic speech',shape:'speech',tail:true},
  {id:'BD_THOUGHT',name:'Thought',shape:'thought',tail:true},
  {id:'BD_SHOUT',name:'Shout',shape:'shout',tail:false},
  {id:'BD_OVAL',name:'Oval speech',shape:'oval',tail:true},
  {id:'BD_RECTANGLE',name:'Plain box (no tail)',shape:'box',tail:false},
] as const;
export function validBubbleOptions(value: {bubbleTail?: unknown;appearDelayMs?: unknown;disappearAtMs?: unknown}): boolean {
  return (value.bubbleTail===undefined||BUBBLE_TAILS.includes(value.bubbleTail as BubbleTail))
    &&(value.appearDelayMs===undefined||(typeof value.appearDelayMs==='number'&&Number.isFinite(value.appearDelayMs)&&value.appearDelayMs>=0&&value.appearDelayMs<=3600000))
    &&(value.disappearAtMs===undefined||(typeof value.disappearAtMs==='number'&&Number.isFinite(value.disappearAtMs)&&value.disappearAtMs>Number(value.appearDelayMs??0)&&value.disappearAtMs<=3600000));
}
export function bubbleVisibleAt(value: BubbleOptions, timeMs: number): boolean {
  return timeMs >= (value.appearDelayMs??0) && (value.disappearAtMs===undefined || timeMs < value.disappearAtMs);
}
export function bubbleLayout(id?:string,tail:BubbleTail='bottom-left') {
  const style=SCENE_BUBBLE_STYLES.find(item=>item.id===id)??SCENE_BUBBLE_STYLES[0];
  const rect=style.shape==='box'?{x:.08,y:.1,width:.84,height:.8}:style.shape==='shout'?{x:.23,y:.25,width:.54,height:.5}:style.shape==='thought'?{x:.15,y:.15,width:.7,height:.5}:style.shape==='oval'?{x:.17,y:.15,width:.66,height:.5}:{x:.1,y:.1,width:.8,height:.6};
  const flipX=style.tail&&tail.endsWith('right'),flipY=style.tail&&tail.startsWith('top');
  return {style,rect:{...rect,x:flipX?1-rect.x-rect.width:rect.x,y:flipY?1-rect.y-rect.height:rect.y},transform:`translate(${flipX?100:0} ${flipY?100:0}) scale(${flipX?-1:1} ${flipY?-1:1})`};
}
