import {positiveDashReward,cheerPose} from '../../../shared/heroDashRewards';
import {createDashRacer} from './racer';
import {coursePalettes,courseOffset,courseTexture,ribbonGeometry} from './courses';
import * as T from 'three';
import type { DashView } from '../../../shared/heroDash';

/** Disposable visual adapter. Logical positions and teacher decisions never live in meshes. */
export function createDashScene(host:HTMLElement, initial:DashView) {
 let view=initial, disposed=false, frame=0, last=0, phase=0, finishNotified=false;
 const palette=coursePalettes[initial.course],scene=new T.Scene();scene.fog=new T.Fog(palette.sky,75,520);
 const sky=document.createElement('canvas');sky.width=2;sky.height=256;const skyContext=sky.getContext('2d')!,skyGradient=skyContext.createLinearGradient(0,0,0,256);skyGradient.addColorStop(0,palette.skyTop);skyGradient.addColorStop(1,palette.sky);skyContext.fillStyle=skyGradient;skyContext.fillRect(0,0,2,256);const skyTexture=new T.CanvasTexture(sky);skyTexture.colorSpace=T.SRGBColorSpace;scene.background=skyTexture;
 const renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;host.appendChild(renderer.domElement);
 const camera=new T.PerspectiveCamera(48,1,.1,650);camera.position.set(0,9,15);
 scene.add(new T.HemisphereLight(palette.sun,'#405367',.85));const sun=new T.DirectionalLight(palette.sun,3.3);sun.position.set(-22,30,14);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-26,right:26,top:26,bottom:-26,near:1,far:110});sun.shadow.camera.updateProjectionMatrix();sun.shadow.bias=-.0004;sun.shadow.normalBias=.035;scene.add(sun,sun.target);const fill=new T.DirectionalLight('#b9dbf0',.3);fill.position.set(10,8,-12);scene.add(fill);
 const world=new T.Group();scene.add(world);
 const materials=new Map<string,T.MeshLambertMaterial>();
 const geometries=new Map<string,T.BufferGeometry>();
 const geometry=(key:string,make:()=>T.BufferGeometry)=>{if(!geometries.has(key))geometries.set(key,make());return geometries.get(key)!;};
 const mat=(color:string)=>{if(!materials.has(color))materials.set(color,new T.MeshLambertMaterial({color,flatShading:true}));return materials.get(color)!;};
 const box=(parent:T.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>{const mesh=new T.Mesh(geometry('box',()=>new T.BoxGeometry(1,1,1)),mat(color));mesh.scale.set(w,h,d);mesh.position.set(x,y,z);parent.add(mesh);return mesh;};
 const cone=(parent:T.Object3D,x:number,y:number,z:number,r:number,h:number,color:string)=>{const mesh=new T.Mesh(geometry(`cone-${r}-${h}`,()=>new T.ConeGeometry(r,h,5)),mat(color));mesh.position.set(x,y,z);parent.add(mesh);return mesh;};
 const sphere=(parent:T.Object3D,x:number,y:number,z:number,r:number,color:string)=>{const mesh=new T.Mesh(geometry(`sphere-${r}`,()=>new T.IcosahedronGeometry(r,0)),mat(color));mesh.position.set(x,y,z);parent.add(mesh);return mesh;};
 const label=(text:string,x:number,y:number,z:number)=>{
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=96;const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#173d3b';ctx.fillRect(0,0,256,96);ctx.fillStyle='#fff7d7';ctx.font='bold 42px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,128,50);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;const sprite=new T.Sprite(new T.SpriteMaterial({map:texture}));sprite.position.set(x,y,z);sprite.scale.set(3.1,1.16,1);world.add(sprite);
 };
 const length=(view.checkpoints+1)*9;
 const offset=(z:number)=>courseOffset(view.course,z,length),slope=(z:number)=>(offset(z+.1)-offset(z-.1))/.2;
 const ground=box(world,0,-.8,-length/2+2,view.course==='coast'?42:60,1.5,length+50,palette.ground),terrainTexture=courseTexture('terrain',view.course);terrainTexture.repeat.set(12,(length+50)/5);(ground.material as T.MeshLambertMaterial).map=terrainTexture;
 const trackTexture=courseTexture('track',view.course);
 for(const [x,width,color]of [[0,9,palette.track],[-2.1,3.8,palette.laneA],[2.1,3.8,palette.laneB]] as const){const road=new T.Mesh(ribbonGeometry(length,x,width,view.course),new T.MeshLambertMaterial({color,map:trackTexture}));if(x)road.position.y=.015;world.add(road);}
 const dashCount=Math.ceil((length+10)/4),stripes=new T.InstancedMesh(geometry('box',()=>new T.BoxGeometry(1,1,1)),mat('#fff3c9'),dashCount),matrix=new T.Matrix4();
 for(let i=0;i<dashCount;i++){const z=4-i*4;matrix.compose(new T.Vector3(offset(z),.085,z),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.atan(slope(z))),new T.Vector3(.12,.05,1.4));stripes.setMatrixAt(i,matrix);}world.add(stripes);
 for(let side=-1;side<=1;side+=2){
  for(let i=0;i<20;i++){const z=8-i*(length+16)/19,x=offset(z)+side*4.8;box(world,x,.5,z,.18,1,.18,palette.bark);if(i<19){const nextZ=8-(i+1)*(length+16)/19,nextX=offset(nextZ)+side*4.8,rail=box(world,(x+nextX)/2,.65,(z+nextZ)/2,.13,.14,Math.hypot(nextX-x,nextZ-z),'#cab58c');rail.rotation.y=Math.atan2(nextX-x,nextZ-z);}}
  const trees=view.course==='coast'?14:24;
  for(let i=0;i<trees;i++){const z=8-i*(length+20)/(trees-1),x=offset(z)+side*(8+(i*7%6)),scale=.8+(i%5)*.13;
   box(world,x,.8*scale,z,.4,1.6*scale,.4,palette.bark);
   if(view.course==='coast'){box(world,x,1.8,z,.35,2.8,.35,palette.bark);for(let leaf=0;leaf<3;leaf++){const frond=box(world,x,3.1,z,3.5,.13,.6,palette.leaf[leaf]);frond.rotation.y=leaf*Math.PI/3;frond.rotation.z=(leaf%2?.1:-.1);}}
   else if(i%4===0&&view.course==='forest'){sphere(world,x,2.6*scale,z,1.5*scale,palette.leaf[i%3]);sphere(world,x+.7,3.2*scale,z-.2,.9*scale,palette.leaf[(i+1)%3]);}
   else {cone(world,x,2.4*scale,z,1.45*scale,3.1*scale,palette.leaf[i%3]);if(i%3===1)cone(world,x,3.3*scale,z,1.05*scale,2.6*scale,palette.leaf[(i+1)%3]);}
   if(i%3===0){const stone=sphere(world,offset(z)+side*6,.2,z-2,.55,palette.rock);stone.scale.set(1.2,.65,1);}
  }
  for(let i=0;i<5;i++){const z=-16-i*length/5,x=side*(24+i*5);if(view.course==='mountains'){cone(world,x,7,z,15,30,palette.rock);cone(world,x,18,z,4.1,8,'#f3f3e5');}else if(view.course!=='coast'||side<0)cone(world,x,view.course==='coast'?1:4,z,10,view.course==='coast'?8:15,i%2?palette.leaf[1]:palette.rock);}
 }
 if(view.course==='coast'){const sea=box(world,56,-.18,-length/2,70,.2,length+90,'#699ea7');(sea.material as T.MeshLambertMaterial).emissive.set('#14313b');for(let i=0;i<18;i++)box(world,30+(i%4)*3,-.1,-i*length/18,7,.03,.13,'#c2e4dc');}
 sphere(world,-23,28,-60,3.2,palette.sun);
 const gate=(z:number,text:string,finish=false)=>{
  const x=offset(z);box(world,x-4.2,2,z,.4,4,.4,'#f7e5b7');box(world,x+4.2,2,z,.4,4,.4,'#f7e5b7');box(world,x,4,z,9,.45,.5,finish?'#efba59':'#427e70');label(text,x,5,z);
  for(const side of [-1,1]){const flag=box(world,x+side*4.75,3,z,.95,.8,.06,side<0?'#dc655c':'#598dd1');flag.rotation.z=side*.13;}
 };
 gate(1,'START');
 for(let i=1;i<=view.checkpoints;i++){
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#f6edc9';ctx.fillRect(0,0,128,128);ctx.strokeStyle='#81a88b';ctx.lineWidth=7;ctx.strokeRect(5,5,118,118);ctx.fillStyle='#285c50';ctx.font='bold 78px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(i),64,69);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;const tileMaterial=new T.MeshBasicMaterial({map:texture});
  for(const lane of [-2.1,2.1]){const tile=new T.Mesh(geometry('tile',()=>new T.PlaneGeometry(2.6,2.6)),tileMaterial);tile.rotation.x=-Math.PI/2;tile.position.set(offset(-i*9)+lane,.13,-i*9);world.add(tile);}
  if(i%3===0)for(const lane of [-2.1,2.1]){const z=-i*9+4,x=offset(z)+lane;box(world,x,.25,z,2.6,.5,.45,'#94785f');box(world,x,.54,z,2.5,.06,.5,'#f1cf7e');}
 }
 gate(-length,'FINISH',true);
 for(let row=0;row<2;row++)for(let col=0;col<12;col++)box(world,-4+col*.7,.11,-length+row*.7,.7,.04,.7,(row+col)%2?'#f9edcf':'#354a48');
 const racers=[createDashRacer('#e26658',-2.1,mat,geometry('box',()=>new T.BoxGeometry(1,1,1))),createDashRacer('#4c8fd6',2.1,mat,geometry('box',()=>new T.BoxGeometry(1,1,1)))];racers.forEach((r,i)=>{scene.add(r.group);r.group.position.z=-view.positions[i]*9;r.group.position.x=offset(r.group.position.z)+(i===0?-2.1:2.1);});
 world.traverse(object=>{const mesh=object as T.Mesh;if(mesh.isMesh){mesh.receiveShadow=true;mesh.castShadow=mesh!==ground && !(mesh.geometry instanceof T.PlaneGeometry) && mesh.geometry.attributes.position.count<500;}});ground.castShadow=false;
 const bonusUntil=[0,0],runBlend=[0,0],pendingCheers=[0,0],cheerStarted=[-1,-1];let winnerIndex=-1,winnerStarted=-1,finishEligible=false;
 const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const dust=new T.Group();scene.add(dust);for(let i=0;i<12;i++)sphere(dust,0,-3,0,.06,'#ffebae');
 const look=new T.Vector3(0,1,-10),goal=new T.Vector3(),lookGoal=new T.Vector3();
 const resize=()=>{const w=host.clientWidth,h=host.clientHeight;if(w&&h){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}};
 const observer=new ResizeObserver(resize);observer.observe(host);resize();
 const animate=(now:number)=>{
  if(disposed)return;frame=requestAnimationFrame(animate);if(now-last<1000/30)return;
  const dt=Math.min((now-last)/1000,.08);last=now;const frozen=view.status==='paused'||view.questionVisible&&!view.questionPinned;
  if(!frozen)phase+=dt;
  host.dataset.dashCheerActive='false';
  racers.forEach((r,i)=>{
   const target=-view.positions[i]*9,delta=target-r.group.position.z,moving=!frozen&&Math.abs(delta)>.025;
   if(moving){r.group.position.z+=Math.sign(delta)*Math.min(Math.abs(delta),dt*9);r.group.rotation.y=Math.atan(slope(r.group.position.z))+(delta>0?Math.PI:0);}
   r.group.position.x=offset(r.group.position.z)+(i===0?-2.1:2.1);if(!moving&&!frozen&&pendingCheers[i]>0&&cheerStarted[i]<0)cheerStarted[i]=phase;
   const winElapsed=winnerStarted<0?11:now/1000-winnerStarted,winnerCheer=i===winnerIndex&&winElapsed<10;
   const cheer=cheerStarted[i]>=0?cheerPose(phase-cheerStarted[i],pendingCheers[i]):null;
   if(cheer?.done){pendingCheers[i]=0;cheerStarted[i]=-1;host.dataset.dashCheerJumps=String(cheer.jumps);}
   const cheering=winnerCheer||!!cheer&&!cheer.done;
   r.animate(frozen?0:dt,moving?7:0,cheering?1:0);
   if(cheering){host.dataset.dashCheerActive='true';host.dataset.dashCheerRacer=String(i);host.dataset.dashCheerJumps=String(cheer?.jumps??Math.floor(winElapsed/.65));} 
   const step=phase*14,obstacle=Math.round(-r.group.position.z/27)*27;
   const jump=moving&&obstacle>0?Math.max(0,1-Math.abs(r.group.position.z+obstacle-4)/1.6):0;
   runBlend[i]+=(Number(moving)-runBlend[i])*(1-Math.exp(-dt*9));
   const happyHeight=reducedMotion?0:winnerCheer?cheerPose(winElapsed,15).height:cheer&&!cheer.done&&!moving?cheer.height:0;
   r.body.position.y=happyHeight+(moving?Math.abs(Math.sin(step))*.07+Math.sin(jump*Math.PI/2)*.9:Math.sin(phase*2+i)*.025);
   r.limbs.forEach((limb,j)=>{limb.rotation.x=runBlend[i]*Math.sin(step+(j%2?Math.PI:0)+(j<2?Math.PI:0))*.65;});
   r.cape.rotation.x=-.17+(moving?Math.sin(step)*.12:0);
  });
  if(finishEligible&&!finishNotified&&view.status==='finished'){
   const winner=view.positions[view.active]===view.checkpoints+1?view.active:view.positions.findIndex(p=>p===view.checkpoints+1);
   if(winner>=0&&Math.abs(racers[winner].group.position.z+view.positions[winner]*9)<.03){finishNotified=true;winnerIndex=winner;winnerStarted=now/1000;host.dispatchEvent(new CustomEvent('dash-finish-arrived',{detail:winner}));}
  }
  const winnerCamera=winnerStarted>=0&&now/1000-winnerStarted<10&&view.status==='finished';host.dataset.dashWinnerCamera=String(winnerCamera);
  const a=racers[view.active].group.position,separation=Math.abs(racers[0].group.position.z-racers[1].group.position.z),mid=(racers[0].group.position.z+racers[1].group.position.z)/2;
  if(winnerCamera){const p=racers[winnerIndex].group.position,angle=reducedMotion?.18:Math.sin((now/1000-winnerStarted)*.4)*.35;goal.set(p.x+Math.sin(angle)*8,3.7,p.z-Math.cos(angle)*8);lookGoal.set(p.x,1.8,p.z);}
  else if(view.camera==='both'){const halfAngle=Math.min(camera.fov*Math.PI/360,Math.atan(Math.tan(camera.fov*Math.PI/360)*camera.aspect)),radius=Math.sqrt((separation/2+3)**2+9)+3,distance=Math.max(19,radius/Math.sin(halfAngle));goal.set(offset(mid)+distance*.68,3+distance*.55,mid+distance*.48);lookGoal.set(offset(mid),1,mid);}
  else if(view.camera==='side'){const distance=Math.max(17,separation*.95+10);goal.set(offset(mid)+distance,3+distance*.27,mid+5);lookGoal.set(offset(mid),1.1,mid);}
  else if(view.camera==='orbit'){const target=view.orbitTarget??view.active,focus=target==='both'?new T.Vector3((racers[0].group.position.x+racers[1].group.position.x)/2,0,mid):racers[target].group.position,halfAngle=Math.min(camera.fov*Math.PI/360,Math.atan(Math.tan(camera.fov*Math.PI/360)*camera.aspect)),radius=target==='both'?Math.max(17,(separation/2+5)/Math.sin(halfAngle)):17,pitch=view.orbitPitch;goal.set(focus.x+Math.sin(view.orbitYaw)*Math.cos(pitch)*radius,2+Math.sin(pitch)*radius,focus.z+Math.cos(view.orbitYaw)*Math.cos(pitch)*radius);lookGoal.set(focus.x,1.2,focus.z);}
  else {const p=racers[view.camera].group.position;goal.set(p.x,7.3,p.z+12);lookGoal.set(offset(p.z-12)+(view.camera===0?-1.2:1.2),1.2,p.z-12/view.zoom);}
  camera.position.lerp(goal,1-Math.exp(-dt*5));look.lerp(lookGoal,1-Math.exp(-dt*5));camera.lookAt(look);const targetZoom=winnerCamera?1:view.zoom;if(Math.abs(camera.zoom-targetZoom)>.001){camera.zoom+=(targetZoom-camera.zoom)*(1-Math.exp(-dt*5));camera.updateProjectionMatrix();}
  dust.children.forEach((p,i)=>{const r=racers[i%2].group.position,active=(Math.abs(r.z+view.positions[i%2]*9)>.1||bonusUntil[i%2]>phase)&&!frozen;const t=(phase*2+i/12)%1;p.position.set(r.x+Math.sin(i*5)*t*.7,active?.2+t*(bonusUntil[i%2]>phase?2:.6):-3,r.z+t*2);p.scale.setScalar(1-t);});
  const lightZ=racers[winnerCamera?winnerIndex:view.active].group.position.z,lightX=offset(lightZ);sun.position.set(lightX-22,30,lightZ+14);sun.target.position.set(lightX,0,lightZ);
  renderer.render(scene,camera);
 };
 frame=requestAnimationFrame(animate);
 const lost=(e:Event)=>{e.preventDefault();host.dispatchEvent(new CustomEvent('dash-render-error'));};renderer.domElement.addEventListener('webglcontextlost',lost);
 return {update(next:DashView){
 const reward=positiveDashReward(view,next),cancel=next.effect<view.effect||next.scores.some((s,i)=>s<view.scores[i])||next.positions.some((p,i)=>p<view.positions[i])||next.status==='ready';
 if(cancel){pendingCheers.fill(0);cheerStarted.fill(-1);winnerStarted=-1;winnerIndex=-1;finishEligible=false;delete host.dataset.dashCheerRacer;delete host.dataset.dashCheerJumps;}
 if(reward!==null){if(next.status==='finished')finishEligible=true;pendingCheers[reward]=3;cheerStarted[reward]=-1;if(next.positions[reward]-view.positions[reward]>=3)bonusUntil[reward]=phase+1.2;}
 view=next;if(next.status!=='finished'){finishNotified=false;winnerStarted=-1;winnerIndex=-1;finishEligible=false;}
 },dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();renderer.domElement.removeEventListener('webglcontextlost',lost);const disposedGeometries=new Set<T.BufferGeometry>(),disposedMaterials=new Set<T.Material>(),disposedTextures=new Set<T.Texture>();scene.traverse(o=>{const m=o as T.Mesh;if(m.geometry)disposedGeometries.add(m.geometry);for(const material of Array.isArray(m.material)?m.material:[m.material])if(material)disposedMaterials.add(material);});disposedMaterials.forEach(material=>{Object.values(material).forEach(value=>{if(value instanceof T.Texture)disposedTextures.add(value);});material.dispose();});disposedTextures.forEach(texture=>texture.dispose());disposedGeometries.forEach(g=>g.dispose());skyTexture.dispose();sun.shadow.map?.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();}};
}





