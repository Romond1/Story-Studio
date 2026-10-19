import * as T from 'three';
import {createBlockHero} from './models/BlockHero';
/** Adapter for the actual Blocky World articulated characters. Progression stays outside. */
export interface DashRacerVisual {group:T.Group;body:T.Group;limbs:T.Group[];cape:T.Object3D;animate:(dt:number,speed:number,cheer?:number)=>void}
export function createDashRacer(color:string,x:number,_material:(color:string)=>T.Material,_unit:T.BufferGeometry):DashRacerVisual {
 const kind=color==='#e26658'?'mia':'yuki',model=createBlockHero(kind);
 const group=new T.Group(),body=new T.Group();group.name=kind==='mia'?'Mia':'Yuki';group.position.x=x;group.add(body);body.add(model.root);model.root.rotation.y=Math.PI;
 model.root.traverse(object=>{const mesh=object as T.Mesh;if(mesh.isMesh){mesh.castShadow=true;mesh.receiveShadow=true;}});
 const shadow=new T.Mesh(new T.CircleGeometry(.65,18),new T.MeshBasicMaterial({color:'#284d42',transparent:true,opacity:.24}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.15;group.add(shadow);
 return {group,body,limbs:[],cape:new T.Object3D(),animate:(dt,speed,cheer=0)=>{model.update(dt,speed,false);if(cheer){for(const arm of [model.joints.left,model.joints.right]){arm.shoulder.rotation.x=-2.75;arm.elbow.rotation.x=-.2;}}}};
}
