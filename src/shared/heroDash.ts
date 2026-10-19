const validDashLength=(n:number)=>Number.isInteger(n)&&([6,8].includes(n)||n>=10&&n<=30);
export interface DashCard { id:string; image:string; text:string; note:string; reward:number }
/** Reserved events require an explicit future teacher action; no automatic handicaps. */
export interface DashBonusEvent {kind:'speed-boost'|'shortcut'|'double-movement'|'catch-up'|'obstacle-challenge'|'teamwork-gate';racer:0|1;movement:number}
export type DashCourse='forest'|'mountains'|'coast';
export interface DashConfig { title:string; names:[string,string]; checkpoints:number; showText:boolean; cards:DashCard[]; importedImages?:string[]; courses?:DashCourse[] }
export interface DashTurn {positions:[number,number]; scores:[number,number]; active:0|1; camera:0|1|'both'|'side'|'orbit'; status:'ready'|'playing'|'paused'|'finished'; questionIndex:number; questionVisible:boolean; questionPinned:boolean; selectedImage?:string; orbitTarget?:0|1|'both'; orbitYaw:number; orbitPitch:number; zoom:number; level:number; feedback:string; effect:number}
export interface DashState extends DashTurn {config:DashConfig; history:DashTurn[]}
export interface DashView extends DashTurn {names:[string,string]; title:string; checkpoints:number; question?:{image:string;text:string};course:DashCourse;levelCount:number}
export type DashAction = {type:'start'|'pause'|'resume'|'reset'|'undo'|'show'|'hide'|'next'|'previous'|'incorrect'|'pin'|'next-level'}|{type:'select';racer:0|1}|{type:'camera';camera:0|1|'both'|'side'|'orbit'}|{type:'move';amount:number}|{type:'set-position';position:number}|{type:'image';image:string}|{type:'orbit';yaw:number;pitch:number}|{type:'zoom';zoom:number};
export const defaultDashConfig = ():DashConfig=>({title:'Enchanted Forest',names:['Mia','Yuki'],checkpoints:20,showText:true,cards:[]});
export function parseDashConfig(value:unknown):DashConfig {
 const v=value as DashConfig;
 if(!v||typeof v!=='object'||Object.keys(v).some(k=>!['title','names','checkpoints','showText','cards','importedImages','courses'].includes(k))||typeof v.title!=='string'||v.title.length>200||!Array.isArray(v.names)||v.names.length!==2||v.names.some(n=>typeof n!=='string'||n.length>80)||!validDashLength(v.checkpoints)||typeof v.showText!=='boolean'||!Array.isArray(v.cards)||v.cards.length>500) throw Error('Invalid Hero Dash configuration');
 if(v.importedImages!==undefined&&(!Array.isArray(v.importedImages)||v.importedImages.length>500||v.importedImages.some(ref=>typeof ref!=='string'||!/^(asset|dash):[a-zA-Z0-9-]{1,200}$/.test(ref))))throw Error('Invalid imported image references');
 if(v.courses!==undefined&&(!Array.isArray(v.courses)||v.courses.length<1||v.courses.length>6||v.courses.some(c=>!['forest','mountains','coast'].includes(c))))throw Error('Choose one to six level courses.');
 const ids=new Set<string>();
 for(const c of v.cards){if(!c||Object.keys(c).some(k=>!['id','image','text','note','reward'].includes(k))||typeof c.id!=='string'||!c.id||c.id.length>200||ids.has(c.id)||typeof c.image!=='string'||!/^(asset|dash):[^\s/\\:?#]{1,200}$/.test(c.image)||typeof c.text!=='string'||c.text.length>2000||typeof c.note!=='string'||c.note.length>4000||!Number.isInteger(c.reward)||c.reward<0||c.reward>10)throw Error('Invalid Hero Dash question');ids.add(c.id);}
 return JSON.parse(JSON.stringify(v));
}
export function createDash(config=defaultDashConfig()):DashState {return {config:parseDashConfig(config),positions:[0,0],scores:[0,0],active:0,camera:0,orbitTarget:0,status:'ready',questionIndex:0,questionVisible:false,questionPinned:false,orbitYaw:0,orbitPitch:.45,zoom:1,level:0,feedback:'Ready for an adventure?',effect:0,history:[]};}
export function mergeSavedDashConfig(current:DashState,expected:DashConfig,saved:DashConfig):DashState {return current.config===expected?{...current,config:saved}:current;}
export function removeDashCard(s:DashState,id:string):DashState {const cards=s.config.cards.filter(c=>c.id!==id);return {...s,questionVisible:false,questionIndex:Math.max(0,Math.min(s.questionIndex,cards.length-1)),config:{...s.config,cards}};}
const turn=(s:DashState):DashTurn=>({positions:[...s.positions],scores:[...s.scores],active:s.active,camera:s.camera,orbitTarget:s.orbitTarget??(typeof s.camera==='number'?s.camera:s.active),status:s.status,questionIndex:s.questionIndex,questionVisible:s.questionVisible,questionPinned:s.questionPinned,orbitYaw:s.orbitYaw,orbitPitch:s.orbitPitch,zoom:s.zoom,level:s.level,selectedImage:s.selectedImage,feedback:s.feedback,effect:s.effect});
export function dashAction(s:DashState,a:DashAction):DashState {
 if(a.type==='undo'){const previous=s.history[s.history.length-1];return previous?{...s,...previous,history:s.history.slice(0,-1)}:s;}
 if(a.type==='move'&&(s.status!=='playing'||!Number.isInteger(a.amount)||a.amount<0||a.amount>10))return s;
 if(a.type==='set-position'&&(!Number.isInteger(a.position)||a.position<0||a.position>s.config.checkpoints+1))return s;
 const n:DashState={...s,...turn(s),history:[...s.history.slice(-99),turn(s)]};
 switch(a.type){
 case 'zoom':if(!Number.isFinite(a.zoom))return s;n.zoom=Math.max(.65,Math.min(1.8,a.zoom));break;
 case 'next-level':if(s.status!=='finished'||s.level+1>=(s.config.courses?.length??1))return s;return {...createDash(s.config),scores:[...s.scores],level:s.level+1,zoom:s.zoom,history:n.history,feedback:'Next course — ready when you are!'};
 case 'reset':return {...createDash(s.config),history:n.history};
 case 'start':if(s.status!=='ready')return s;n.status='playing';n.feedback='Let’s go, heroes!';break;
 case 'pause':if(s.status!=='playing')return s;n.status='paused';break;
 case 'resume':if(s.status!=='paused')return s;n.status='playing';break;
 case 'select':n.active=a.racer;if(typeof s.camera==='number'){n.camera=a.racer;n.orbitTarget=a.racer;}break;
 case 'camera':if(a.camera!=='orbit')n.orbitTarget=typeof a.camera==='number'?a.camera:'both';n.camera=a.camera;break;
 case 'orbit':if(!Number.isFinite(a.yaw)||!Number.isFinite(a.pitch))return s;n.camera='orbit';n.orbitYaw=a.yaw;n.orbitPitch=Math.max(.2,Math.min(1.05,a.pitch));break;
 case 'move':n.questionVisible=s.questionPinned&&s.questionVisible;n.positions[s.active]=Math.min(s.config.checkpoints+1,s.positions[s.active]+a.amount);n.scores[s.active]+=a.amount;n.effect++;n.feedback=a.amount?`Great work, ${s.config.names[s.active]}!`:'Good effort — try another!';if(n.positions[s.active]===s.config.checkpoints+1){n.status='finished';n.feedback=`${s.config.names[s.active]} reaches the finish!`;}break;
 case 'set-position':n.positions[s.active]=a.position;n.questionVisible=false;n.feedback='Teacher position adjustment';n.status=n.positions.some(p=>p===s.config.checkpoints+1)?'finished':s.status==='finished'?'playing':s.status;break;
 case 'incorrect':n.feedback='Try again — take your time';n.effect++;break;
 case 'show':n.questionVisible=!!s.selectedImage||!!s.config.cards.length;break;
 case 'pin':n.questionPinned=!s.questionPinned;break;
 case 'image':if(!/^(asset|dash):[a-zA-Z0-9_-]{1,200}$/.test(a.image))return s;n.selectedImage=a.image;break;
 case 'hide':n.questionVisible=false;break;
 case 'next':delete n.selectedImage;n.questionIndex=Math.max(0,Math.min(s.config.cards.length-1,s.questionIndex+1));break;
 case 'previous':delete n.selectedImage;n.questionIndex=Math.max(0,s.questionIndex-1);break;
 }return n;
}
export function dashProjection(s:DashState,resolve:(id:string)=>string|undefined):DashView {
 const c=s.selectedImage?undefined:s.config.cards[s.questionIndex],ref=s.selectedImage??c?.image,image=ref?.startsWith('dash:')?'media://hero-dash/'+ref.slice(5):ref?resolve(ref.slice(6)):undefined;
 return {...turn(s),title:s.config.title,names:[...s.config.names],checkpoints:s.config.checkpoints,course:s.config.courses?.[s.level]??'forest',levelCount:s.config.courses?.length??1,...(s.questionVisible&&image?{question:{image,text:s.config.showText?(c?.text??''):''}}:{})};
}
/** Rebuild a student-only snapshot, rejecting executable or temporary media references. */
export function parseDashView(value:unknown):DashView|null {
 const v=value as DashView;
 if(!v||typeof v!=='object'||!Array.isArray(v.names)||v.names.length!==2||v.names.some(n=>typeof n!=='string'||n.length>80)||typeof v.title!=='string'||v.title.length>200||!validDashLength(v.checkpoints)||![0,1].includes(v.active)||![0,1,'both','side','orbit'].includes(v.camera)||!['ready','playing','paused','finished'].includes(v.status)||typeof v.questionVisible!=='boolean'||!Number.isSafeInteger(v.effect)||v.effect<0||!Number.isSafeInteger(v.questionIndex)||v.questionIndex<0||typeof v.feedback!=='string'||v.feedback.length>500)return null;
 for(const key of ['positions','scores'] as const)if(!Array.isArray(v[key])||v[key].length!==2||v[key].some(x=>!Number.isSafeInteger(x)||x<0||x>(key==='positions'?v.checkpoints+1:1000000)))return null;
 if(v.question&&(typeof v.question.image!=='string'||!v.question.image.startsWith('media://')||v.question.image.length>32768||typeof v.question.text!=='string'||v.question.text.length>2000))return null;
 return {orbitTarget:[0,1,'both'].includes(v.orbitTarget as any)?v.orbitTarget:typeof v.camera==='number'?v.camera:v.active,title:v.title,names:[...v.names],checkpoints:v.checkpoints,positions:[...v.positions],scores:[...v.scores],active:v.active,camera:v.camera,status:v.status,questionIndex:v.questionIndex,questionVisible:v.questionVisible,questionPinned:v.questionPinned===true,zoom:Number.isFinite(v.zoom)?Math.max(.65,Math.min(1.8,v.zoom)):1,level:Number.isInteger(v.level)&&v.level>=0&&v.level<6?v.level:0,course:['forest','mountains','coast'].includes(v.course)?v.course:'forest',levelCount:Number.isInteger(v.levelCount)&&v.levelCount>=1&&v.levelCount<=6?v.levelCount:1,orbitYaw:Number.isFinite(v.orbitYaw)?v.orbitYaw:0,orbitPitch:Number.isFinite(v.orbitPitch)?Math.max(.2,Math.min(1.05,v.orbitPitch)):.45,feedback:v.feedback,effect:v.effect,...(v.question?{question:{image:v.question.image,text:v.question.text}}:{})};
}











