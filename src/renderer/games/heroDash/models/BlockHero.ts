// Reused from Blocky World/src/characters/BlockHero.ts (2026-10-17). Original project is unchanged.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Code-built Yuki, facing +Z. Simulation owns position, facing and the collider. */
export function createBlockHero(kind: 'yuki' | 'mia') {
  const mia = kind === 'mia';
  const root = new THREE.Group(); root.name = mia ? 'MiaRoot' : 'YukiRoot';
  const body = new THREE.Group(); body.name = 'BodyRoot'; root.add(body);
  const standard = (color: number, metalness = 0, roughness = 0.7) => new THREE.MeshStandardMaterial({ color, metalness, roughness });
  const m = {
    skin: standard(0xe9b78c), hair: standard(0x090c13), hairEdge: standard(0x151b27),
    suit: standard(0x121f30), silver: standard(0xc6e8ff, 0.72, 0.24), steel: standard(0x709fc8, 0.62, 0.32),
    blue: standard(0x193d70, 0.35), leather: standard(0x55331e), white: standard(0xe8efe3), green: standard(0x539044),
    cyan: new THREE.MeshStandardMaterial({color:0x64eeff,emissive:0x17cfe9,emissiveIntensity:0.65,roughness:0.4}),
  };
  if (mia) {
    m.hair.color.setHex(0x512719); m.hairEdge.color.setHex(0x703920);
    m.green.color.setHex(0x96552a);
    m.silver.color.setHex(0xe84329); m.steel.color.setHex(0xa81c19);
    m.blue.color.setHex(0x65101b);
    m.cyan.color.setHex(0xffca42);m.cyan.emissive.setHex(0xe97805);m.cyan.emissiveIntensity=0.4;
  }
  const flame = mia ? new THREE.MeshStandardMaterial({color:0xff4b09,emissive:0xff3504,emissiveIntensity:0.9,roughness:0.7}) : m.cyan;
  // Tiny procedural reflection map belongs only to Yuki's metal, not scene lighting.
  const reflectionPixels = new Uint8Array(128 * 64 * 4);
  for (let y=0;y<64;y++) for(let x=0;x<128;x++) {
    const panel = (x>18 && x<29 || x>78 && x<96) && y>12 && y<42;
    const value = panel ? 245 : 55 + Math.round(65 * (1-y/64));
    const i=(y*128+x)*4; reflectionPixels[i]=value*.8;reflectionPixels[i+1]=value*.92;reflectionPixels[i+2]=value;reflectionPixels[i+3]=255;
  }
  const reflection = new THREE.DataTexture(reflectionPixels,128,64);
  reflection.mapping=THREE.EquirectangularReflectionMapping;reflection.colorSpace=THREE.SRGBColorSpace;reflection.needsUpdate=true;
  for(const material of [m.silver,m.steel,m.blue]) { material.envMap=reflection;material.envMapIntensity=1.15; }
  const unit = new THREE.BoxGeometry(1,1,1);
  function pivot(parent: THREE.Group, name: string, x: number, y: number, z = 0) {
    const group = new THREE.Group(); group.name=name; group.position.set(x,y,z); parent.add(group); return group;
  }
  function box(parent: THREE.Group, material: THREE.Material, x: number,y: number,z: number,w: number,h: number,d: number, angle=0) {
    const mesh=new THREE.Mesh(unit,material); mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.rotation.z=angle;parent.add(mesh);return mesh;
  }
  function silhouette(parent: THREE.Group, material: THREE.Material, points: number[][], z: number, scale: number) {
    const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x*scale,y*scale):shape.moveTo(x*scale,y*scale));shape.closePath();
    const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),material);mesh.position.z=z;parent.add(mesh);return mesh;
  }
  function wolf(parent: THREE.Group, x: number,y: number,z: number,scale: number) {
    const emblem=pivot(parent,'WolfEmblem',x,y,z);
    silhouette(emblem,m.cyan,[[-.5,.05],[-.42,.48],[-.18,.28],[.18,.28],[.42,.48],[.5,.05],[.22,-.15],[.12,-.5],[-.12,-.5],[-.22,-.15]],0,scale);
    for(const side of [-1,1])box(emblem,m.blue,side*scale*.22,scale*.06,.004,scale*.15,scale*.09,.008,side*.25);
    box(emblem,m.white,0,-scale*.16,.006,scale*.06,scale*.21,.008);
  }
  function rune(parent: THREE.Group,x:number,y:number,z:number,size=.07) {
    box(parent,m.cyan,x,y,z,size*.24,size,.014);
    box(parent,m.cyan,x+size*.2,y+size*.22,z,size*.48,size*.2,.014);
    box(parent,m.cyan,x+size*.24,y-size*.1,z,size*.22,size*.45,.014);
  }
  const torso=pivot(body,'Torso',0,1.13);
  box(torso,m.suit,0,0,0,.43,.49,.29);
  box(torso,m.steel,0,.055,0,.49,.35,.34);
  box(torso,m.silver,0,.10,.185,.38,.25,.055);
  box(torso,m.silver,0,-.075,.17,.30,.13,.055);
  box(torso,m.blue,0,.035,.22,.29,.27,.035);
  if (!mia) wolf(torso,0,.055,.245,.25);
  else {
    for(const side of [-1,1]) {
      box(torso,m.cyan,side*.065,.055,.245,.028,.19,.014,side*.65);
      box(torso,m.cyan,side*.068,.09,.245,.12,.021,.014,side*-.45);
      box(torso,m.cyan,side*.06,-.035,.245,.13,.023,.014,side*.55);
    }
    box(torso,m.cyan,0,.055,.247,.025,.24,.015);
  }
  for(const side of [-1,1]) {
    for(let i=0;i<3;i++) box(torso,m.silver,side*(.19-i*.025),.11-i*.085,.205,.06,.075,.045,side*-.18);
    for(let i=0;i<2;i++) {box(torso,m.steel,side*.18,-.13-i*.05,.18,.095,.035,.045);rune(torso,side*.18-.01,-.13-i*.05,.21,.025);}
  }
  const back=pivot(torso,'BackArmor',0,.05,-.18);back.rotation.y=Math.PI;
  box(back,m.silver,0,0,0,.38,.3,.05);box(back,m.steel,0,0,.04,.29,.26,.035);
  for(const x of [-.1,0,.1])rune(back,x,0,.065,.07);
  for(const x of [-.16,.16])for(let i=0;i<3;i++)box(back,m.silver,x,.09-i*.075,.06,.04,.06,.035);
  box(back,m.silver,0,0,.075,.027,.27,.018);
  const waist=pivot(torso,'Waist',0,-.25);
  box(waist,m.leather,0,0,0,.46,.09,.34);box(waist,m.silver,0,0,.19,.12,.105,.045);rune(waist,-.012,0,.22,.065);
  const neck=pivot(body,'Neck',0,1.415);
  box(neck,m.suit,0,0,0,.23,.105,.23);box(neck,m.steel,0,-.02,0,.31,.07,.29);
  for(const x of [-.10,0,.10])box(neck,m.cyan,x,-.017,.15,.032,.04,.012);
  const head=pivot(neck,'Head',0,.23);
  box(head,m.skin,0,0,0,.46,.43,.40);
  for(const side of [-1,1]) {
    box(head,m.skin,side*.245,-.055,0,.065,.13,.13);
    box(head,m.white,side*.105,-.005,.205,.106,.078,.017);
    box(head,m.green,side*.095,-.009,.216,.055,.071,.012);
    box(head,m.hair,side*.093,-.007,.224,.022,.053,.009);
    box(head,m.white,side*.102,.014,.23,.014,.016,.006);
    box(head,m.hair,side*.105,.051,.226,.12,.025,.019,side*.16);
  }
  box(head,m.skin,0,-.065,.227,.055,.046,.043);
  box(head,m.skin,0,-.15,.206,.19,.06,.016);
  box(head,m.leather,0,-.14,.22,.074,.008,.008);
  box(head,m.leather,.041,-.135,.22,.018,.008,.008,.3);
  for(const side of [-1,1]) box(head,m.skin,side*.14,-.07,.208,.075,.045,.018);
  const hair=pivot(head,'Hair',0,.15,-.015);
  box(hair,m.hair,0,.09,-.018,.50,.21,.43);box(hair,m.hair,0,-.08,-.19,.47,.33,.11);
  if (mia) {
    // Shoulder-length chestnut bob, swept away from the eyes, with curled block tips.
    box(hair,m.hair,0,-.17,-.19,.48,.38,.14);
    for(const side of [-1,1])for(let i=0;i<5;i++) {
      box(hair,i%2?m.hair:m.hairEdge,side*(.22+Math.sin(i)*.022),.06-i*.065,-.065,.105,.13,.30,side*(i>2?.2:-.12));
      box(hair,m.hair,side*(.09+i*.027),.145-i*.024,.17,.12,.11,.12,side*-.3);
    }
    for(const side of [-1,1]) {
      box(hair,m.hair,side*.245,-.205,-.065,.15,.18,.30,side*.18);
      box(hair,m.hairEdge,side*.24,-.28,-.10,.13,.065,.24,side*-.2);
    }
    for(let i=0;i<5;i++)box(hair,m.hairEdge,(i-2)*.085,.19,-.025,.10,.05,.35);
  } else {
  // Asymmetric layered locks and a stepped, swept silhouette rather than a cube cap.
  for(let i=0;i<9;i++) {
    const x=(i-4)*.058, y=.07+Math.sin(i*2.2)*.035;
    box(hair,i%3?m.hair:m.hairEdge,x,y,.195,.09,.19+(i%3)*.025,.09,-.32+(i%3)*.13);
    box(hair,m.hair,x+.025,y+.10,-.015,.09,.14,.32,-.55);
  }
  for(const side of [-1,1]) for(let i=0;i<4;i++) {
    box(hair,i%2?m.hair:m.hairEdge,side*(.225+i%2*.02),.07-i*.065,-.055-i*.025,.11,.17,.22,side*-.32);
    box(hair,m.hair,side*(.09+i*.04),.18-i*.06,-.21,.13,.18,.12,side*.5);
  }
  }
  function arm(side:number) {
    const shoulder=pivot(body,side<0?'RightShoulderPivot':'LeftShoulderPivot',side*.325,1.32);
    const upper=pivot(shoulder,'UpperArm',0,0);
    box(upper,m.suit,0,-.13,0,.16,.29,.18);
    box(upper,m.steel,0,-.01,0,.28,.20,.29);box(upper,m.silver,0,.045,0,.23,.12,.25);
    box(upper,m.silver,0,-.105,.025,.28,.035,.29);rune(upper,-.03,.015,.151,.065);
    for(let i=0;i<3;i++) {
      box(upper,m.silver,side*(.045+i*.037),.105-i*.038,0,.09,.045,.23-i*.025);
      box(upper,m.steel,0,-.135-i*.035,.02,.24-i*.015,.022,.25-i*.012);
    }
    if(mia) {
      box(upper,m.cyan,0,-.10,.17,.28,.018,.014);
      for(const x of [-.10,.10])box(upper,m.cyan,x,.012,.15,.018,.12,.018);
    }
    for(const x of [-.09,.09])box(upper,m.silver,x,-.04,.154,.025,.025,.018);
    box(upper,m.leather,0,-.23,0,.19,.055,.21);
    const elbow=pivot(upper,'ElbowPivot',0,-.285);
    const forearm=pivot(elbow,'Forearm',0,0);
    box(forearm,m.suit,0,-.12,0,.16,.25,.18);box(forearm,m.steel,0,-.115,.015,.215,.21,.23);
    box(forearm,m.silver,0,-.11,.14,.15,.18,.035);rune(forearm,-.025,-.10,.164,.09);
    if(mia) for(const x of [-.075,.075])box(forearm,m.cyan,x,-.11,.173,.015,.18,.014);
    for(const x of [-.085,.085])box(forearm,m.silver,x,-.115,.135,.025,.22,.055);
    for(const y of [-.035,-.19])box(forearm,m.silver,0,y,.16,.18,.025,.035);
    box(forearm,m.leather,0,-.23,0,.22,.04,.24);
    const hand=pivot(forearm,'Hand',0,-.29);
    box(hand,m.leather,0,0,.015,.19,.13,.20);box(hand,m.silver,0,.018,.12,.18,.10,.04);rune(hand,-.015,.02,.145,.05);
    for(let i=0;i<3;i++)box(hand,m.silver,-.055+i*.055,-.035,.125,.037,.045,.045);
    return {shoulder,elbow,hand,forearm};
  }
  const left=arm(1),right=arm(-1);
  function leg(side:number) {
    const hip=pivot(body,side<0?'RightHipPivot':'LeftHipPivot',side*.135,.86);
    const upper=pivot(hip,'UpperLeg',0,0);box(upper,m.suit,0,-.155,0,.20,.31,.24);
    for(let i=0;i<2;i++){box(upper,m.steel,side*.065,-.035-i*.105,.12,.20,.095,.075);rune(upper,side*.065-.018,-.03-i*.105,.165,.05);}
    const knee=pivot(upper,'KneePivot',0,-.33);
    const lower=pivot(knee,'LowerLeg',0,0);
    box(lower,m.suit,0,-.16,0,.17,.32,.20);box(lower,m.silver,0,-.015,.13,.20,.14,.09);
    box(lower,m.steel,0,-.18,.08,.21,.23,.20);box(lower,m.silver,0,-.19,.19,.13,.22,.04);
    box(lower,m.cyan,0,-.18,.214,.028,.16,.013);box(lower,m.leather,0,-.08,-.015,.18,.04,.21);
    for(const x of [-.075,.075]) box(lower,m.silver,x,-.18,.18,.025,.22,.07);
    box(lower,m.steel,0,-.014,.183,.14,.085,.032);
    box(lower,m.cyan,0,-.014,.203,.055,.035,.01);
    const foot=pivot(lower,'Foot',0,-.43,.045);
    box(foot,m.suit,0,-.045,.02,.24,.11,.36);box(foot,m.steel,0,.005,.035,.24,.10,.32);
    box(foot,m.silver,0,-.007,.17,.23,.065,.075);
    for(let i=0;i<3;i++)box(foot,m.silver,0,.068-i*.018,.025+i*.055,.19,.025,.045);
    return {hip,knee,foot};
  }
  const leftLeg=leg(1),rightLeg=leg(-1);
  const shield = mia ? pivot(waist,'FlamingSwordAttachment',-.29,-.04,-.13) : pivot(left.forearm,'ShieldAttachment',.22,-.12,.11);
  if (!mia) {
shield.rotation.y=.3;
  const outline=[[-.27,.24],[0,.42],[.27,.24],[.27,-.16],[.18,-.35],[0,-.52],[-.18,-.35],[-.27,-.16]];
  silhouette(shield,m.silver,outline,0,1);
  silhouette(shield,m.blue,outline,.014,.86);
  const reverse=pivot(shield,'ShieldBack',0,0,-.015);reverse.rotation.y=Math.PI;silhouette(reverse,m.steel,outline,0,.96);
  box(shield,m.leather,0,.08,-.025,.34,.06,.055);box(shield,m.leather,0,-.12,-.025,.34,.055,.055);
  wolf(shield,0,-.015,.029,.34);
  for(const y of [-.39,.29])box(shield,m.cyan,0,y,.022,.035,.04,.015);
  for(const side of [-1,1]) for(let i=0;i<5;i++) {
    box(shield,m.silver,side*(.244-Math.max(0,i-2)*.055),.18-i*.12,.025,.025,.05,.02,side*-.3);
  }
  } else {
    // Rigid cape: geometry is fixed to the torso, no cloth simulation or flap animation.
    const cape=pivot(torso,'RigidCape',0,.20,-.205);
    for(let i=0;i<5;i++) {
      const x=(i-2)*.09, length=.60+(.12*Math.cos(i*1.7));
      const strip=box(cape,m.blue,x,-length/2,-.045,.105,length,.035);
      strip.rotation.x=.20;
      box(cape,m.steel,x,-length-.015,-.13,.08,.07,.03);
    }
    box(neck,m.steel,0,-.015,0,.35,.14,.32);
    box(neck,m.silver,0,-.06,.16,.30,.075,.045);
    for(const side of [-1,1]) {
      for(let i=0;i<3;i++)box(waist,m.steel,side*(.145+i*.018),-.10-i*.08,.12,.17,.075,.10,side*.08);
      for(let i=0;i<3;i++)box(waist,m.cyan,side*(.145+i*.018),-.13-i*.08,.175,.17,.018,.012);
    }
    box(waist,m.steel,0,-.21,.17,.16,.33,.04);
    for(const side of [-1,1])box(waist,m.cyan,side*.07,-.21,.197,.016,.30,.01);
    // Keep the flaming blade along the rear hip, trailing behind rather than widening her silhouette.
    shield.rotation.x=.72;shield.rotation.z=-.08;
    box(shield,m.leather,0,-.06,0,.055,.18,.06);
    box(shield,m.cyan,0,.025,0,.085,.07,.08);
    box(shield,m.silver,0,-.18,0,.30,.055,.10);
    box(shield,m.steel,0,-.53,0,.13,.65,.06);
    box(shield,m.silver,0,-.53,.038,.075,.64,.022);
    box(shield,m.cyan,-.055,-.53,.042,.018,.65,.013);
    for(let i=0;i<10;i++) {
      const side=i%2?1:-1, y=-.24-i*.063;
      box(shield,m.silver,side*(.08+Math.sin(i*1.8)*.03),y,.015,.065,.12,.065,side*-.3);
      box(shield,m.cyan,side*.073,y,.055,.035,.07,.025,side*-.3);
    }
    box(shield,m.silver,0,-.90,0,.07,.10,.055);
    // Two stepped tongues curl around the blade, with hot gold cores and orange tips.
    for(const side of [-1,1])for(let i=0;i<8;i++) {
      const x=side*(.10+Math.sin(i*.8)*.085), y=-.27-i*.07;
      box(shield,flame,x,y,.055,.06,.08,.045,side*.35);
      if(i%2===0)box(shield,m.cyan,x-side*.022,y-.012,.085,.029,.055,.017);
    }
    for(let i=0;i<3;i++)box(shield,flame,(i%2?1:-1)*.22,-.3-i*.20,.03,.025,.035,.028);
  }
  // Merge static pieces per material within each articulated group: joints remain independent.
  let triangles=0,drawCalls=0;
  root.traverse(object=>{
    if(!(object instanceof THREE.Group))return;
    const buckets=new Map<THREE.Material,THREE.BufferGeometry[]>();
    for(const child of [...object.children])if(child instanceof THREE.Mesh){
      child.updateMatrix();const geometry=child.geometry.clone().applyMatrix4(child.matrix);
      const mat=child.material as THREE.Material;const list=buckets.get(mat)??[];list.push(geometry);buckets.set(mat,list);object.remove(child);
      if(child.geometry!==unit)child.geometry.dispose();
    }
    for(const [material,geometries]of buckets){
      const geometry=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());
      const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;object.add(mesh);
      triangles+=(geometry.index?.count??geometry.getAttribute('position').count)/3;drawCalls++;
    }
  });unit.dispose();
  let phase=0,time=0,blend=0,carryBlend=0;
  function update(dt:number,speed:number,carrying:boolean,pose:{heavy?:boolean;action?:string;progress?:number}={}) {
    time+=dt;blend=THREE.MathUtils.damp(blend,Math.min(speed/3.5,1),12,dt);phase+=speed*dt*3.5;
    const stride=Math.sin(phase)*blend;
    body.position.y=.008*Math.sin(time*2)*(1-blend)+.018*(1-Math.cos(phase*2))*blend;
    const run=Math.max(0,Math.min(1,speed/3.5-1));
    torso.rotation.x=blend*(.025+run*.055);head.rotation.y=Math.sin(time*.55)*.035*(1-blend);
    leftLeg.hip.rotation.x=stride*.48;rightLeg.hip.rotation.x=-stride*.48;
    leftLeg.knee.rotation.x=Math.max(0,-stride)*.50;rightLeg.knee.rotation.x=Math.max(0,stride)*.50;
    leftLeg.foot.rotation.x=-leftLeg.hip.rotation.x*.3;rightLeg.foot.rotation.x=-rightLeg.hip.rotation.x*.3;
    left.shoulder.rotation.x=-stride*(.14+run*.10)+Math.sin(time*2)*.015;
    right.shoulder.rotation.x=mia ? stride*(.10+run*.14) : stride*.32;
    right.elbow.rotation.x=mia ? -.12 : -.10-Math.max(0,-stride)*.15;
    left.elbow.rotation.x=-.16;
    carryBlend=THREE.MathUtils.damp(carryBlend,carrying||pose.action==='HEAVY_LIFT'?1:0,18,dt);
    for(const arm of [left,right]){
      arm.shoulder.rotation.x=THREE.MathUtils.lerp(arm.shoulder.rotation.x,-1.0,carryBlend);
      arm.elbow.rotation.x=THREE.MathUtils.lerp(arm.elbow.rotation.x,-.6,carryBlend);
    }
    if(pose.heavy)torso.rotation.x=THREE.MathUtils.lerp(torso.rotation.x,-.035,carryBlend);
    // Yuki frees his shield hand while holding cargo. Mia's sword is already on her hip.
    if(!mia){
      if(carrying||pose.action==='HEAVY_LIFT'){body.add(shield);shield.position.set(0,1.12,-.29);shield.rotation.set(0,Math.PI,0);}
      else if(carryBlend<.02){left.forearm.add(shield);shield.position.set(.22,-.12,.11);shield.rotation.set(0,.3,0);}
    }
    if(pose.action==='HEAVY_STRUGGLE'||pose.action==='HEAVY_DROP'){
      const strain=pose.action==='HEAVY_DROP'?1-(pose.progress??0):1;
      torso.rotation.x=.22*strain;body.position.y-=.07*strain;
      left.shoulder.rotation.x=right.shoulder.rotation.x=-.9*strain+Math.sin(time*35)*.025;
      left.elbow.rotation.x=right.elbow.rotation.x=-.5*strain;
      leftLeg.knee.rotation.x=rightLeg.knee.rotation.x=.18*strain;
    }else if(pose.action==='HEAVY_LIFT'){
      const p=pose.progress??0;torso.rotation.x=.18*(1-p);body.position.y-=.10*Math.sin(p*Math.PI);
    }
  }
  return {root,update,stats:{triangles,drawCalls,materials:Object.keys(m).length+(mia?1:0)},joints:{body,head,left,right,leftLeg,rightLeg,shield}};
}
