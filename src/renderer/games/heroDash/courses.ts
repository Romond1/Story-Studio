import * as T from 'three';
import type {DashCourse} from '../../../shared/heroDash';
export const coursePalettes={
 forest:{sky:'#c8e8db',skyTop:'#75b2b5',ground:'#699265',track:'#ddc59c',laneA:'#f4dbb1',laneB:'#c7d9b6',bark:'#725740',leaf:['#366e59','#79a165','#b5bf73'],rock:'#7e9690',sun:'#fff0c5'},
 mountains:{sky:'#dcebf0',skyTop:'#8eafc9',ground:'#9baa9a',track:'#b8beb4',laneA:'#e1d8c2',laneB:'#c2d6dc',bark:'#6c6054',leaf:['#405f61','#648179','#839c8b'],rock:'#81939f',sun:'#fff1d0'},
 coast:{sky:'#f4d7bc',skyTop:'#bb9cc3',ground:'#c4b77a',track:'#e5cb9c',laneA:'#ffe1b1',laneB:'#cde0d0',bark:'#8e6b4d',leaf:['#3c8572','#69a17a','#a5b577'],rock:'#a9a791',sun:'#ffcf85'}
} as const;
export function courseOffset(course:DashCourse,z:number,length:number){const t=Math.max(0,Math.min(1,-z/length));return Math.sin(t*Math.PI*2)*(course==='mountains'?5.5:course==='coast'?7:2);}
/** Small deterministic textures; no remote asset loads or per-frame texture work. */
export function courseTexture(kind:'track'|'terrain',course:DashCourse){
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const c=canvas.getContext('2d')!;let seed=5317;
 const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 c.fillStyle=kind==='track'?'#ede7d6':'#d8e2ce';c.fillRect(0,0,128,128);
 for(let i=0;i<1000;i++){const x=random()*128,y=random()*128;c.fillStyle=i%2?'rgba(58,64,46,.13)':'rgba(255,255,240,.28)';c.fillRect(x,y,kind==='terrain'?1:2,kind==='terrain'?3:1);}
 if(kind==='track'&&course==='mountains'){c.strokeStyle='rgba(76,89,88,.18)';c.lineWidth=1;for(let y=0;y<128;y+=32){c.beginPath();c.moveTo(0,y);c.lineTo(128,y);c.stroke();for(let x=(y%64?16:0);x<128;x+=42)c.strokeRect(x,y,42,32);}}
 if(kind==='track'&&course==='coast'){c.strokeStyle='rgba(172,134,86,.13)';for(let y=0;y<128;y+=16){c.beginPath();for(let x=0;x<=128;x+=4)c.lineTo(x,y+Math.sin(x*.07+y)*2);c.stroke();}}
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;return texture;
}
export function ribbonGeometry(length:number,offset:number,width:number,course:DashCourse){
 const positions:number[]=[],uv:number[]=[],indices:number[]=[];const segments=80;
 for(let i=0;i<=segments;i++){const z=7-(length+14)*i/segments,x=courseOffset(course,z,length)+offset;positions.push(x-width/2,.05,z,x+width/2,.05,z);uv.push(0,i*(length+14)/segments/2.5,1,i*(length+14)/segments/2.5);if(i<segments){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
