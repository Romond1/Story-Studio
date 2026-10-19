import type {DashConfig} from './heroDash';
export function selectDashImages(order:string[],previous:string[],anchor:string|undefined,ref:string,toggle:boolean,range:boolean){
 const at=order.indexOf(ref),start=anchor?order.indexOf(anchor):-1;let refs:string[];
 if(range&&start>=0){const span=order.slice(Math.min(at,start),Math.max(at,start)+1);refs=toggle?[...new Set([...previous,...span])]:span;}
 else if(toggle)refs=previous.includes(ref)?previous.filter(r=>r!==ref):[...previous,ref];else refs=[ref];
 return {refs:order.filter(r=>refs.includes(r)),anchor:range&&anchor?anchor:ref};
}
export function prepareDashImages(config:DashConfig,refs:string[],id:()=>string):DashConfig {
 if(config.cards.length+refs.length>500)throw Error('A review supports up to 500 prepared questions.');
 return {...config,cards:[...config.cards,...refs.map(image=>({id:id(),image,text:'',note:'',reward:1}))],importedImages:[...new Set([...(config.importedImages??[]),...refs])]};
}
