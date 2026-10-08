import { toMediaUrl } from './mediaUrls';
import type { ProjectData } from '../shared/types';
import type { PresentationSession, PresentationTarget } from '../shared/presentationSession';
import type { ActivityScene, BoardVisual } from '../shared/activityScene';
import type { CardBinding } from './useCardRuntime';
import { visualMediaUrl, visualMediaBackground } from '../shared/visualMedia';

/** Shared passive scene composition for Control and Present. No selection effects. */
export function composeActivityScene(data: ProjectData|null, session: PresentationSession, target: PresentationTarget,
  bind: (ref:string,instances:import('../shared/types').BCardInstance[])=>CardBinding,
  timer: {isRunning:boolean;startTime:number;accumulated:number}, scope:string, runtime:boolean): ActivityScene {
  const boards:BoardVisual[]=[];
  const add=(id:string,key:string)=>{
    const card=data?.aCardLibrary?.[id]; if(!card)return;
    const state=bind(key,card.bCardInstances??[]).state;
    boards.push({key,card:runtime?{...card,bCardInstances:state.instances}:card,states:state.states,startedAt:state.startedAt,movement:state.movement});
  };
  const host=target.section?.type==='break'?target.section:target.slide;
  if(target.kind==='board' && target.board) add(target.board.id,session.mode==='boost'&&session.boostTab==='language'&&target.item?target.item.id:'board');
  else if(session.mode==='story') host?.storyReferences?.forEach(ref=>add(ref.aCardId,ref.id));
  const instances=(session.mode==='story'?host?.bCardInstances:target.item?.bCardInstances)??[];
  const overlay=bind('overlays',instances).state;
  const section=target.section?.type==='break'?target.section:null;
  return {boards,cards:data?.bCardLibrary??{},images:Object.fromEntries((data?.assets??[]).filter(a=>a.mediaType==='image').map(a=>[a.id,visualMediaUrl(toMediaUrl(a.relativePath),scope)])),
    overlays:{instances:runtime?overlay.instances:instances,states:overlay.states},
    ...(section?{break:{title:section.name,questions:section.questions,background:section.background?visualMediaBackground(section.background,scope):undefined,bgTransform:section.bgTransform,
      font:section.font,fontSize:section.fontSize,titleFontSize:section.titleFontSize,timerSize:section.timerSize,isBold:section.isBold,isItalic:section.isItalic,align:section.align,position:section.position,
      textColor:(section as any).textColor,timer:section.timer,timerMode:section.timerMode,timerDuration:section.timerDuration,anchor:timer,
      thumbnails:(section.breakMedia??[]).flatMap(m=>{
        const slide=data?.slides.find(s=>s.id===m.slideId);const asset=slide&&data?.assets.find(a=>a.id===slide.assetId);
        return asset?[{id:m.id,src:visualMediaUrl(toMediaUrl(asset.relativePath),scope),width:section.thumbnailSize??200,x:m.x??0,y:m.y??0,scale:m.scale??1,fit:m.fit}]:[];
      })}}:{})};
}
