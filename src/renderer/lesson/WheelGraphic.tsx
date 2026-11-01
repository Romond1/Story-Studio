import { useId, type RefObject } from 'react';
import type { PublicWheelSegment } from '../../shared/lesson/wheelPresentation';

/** The same gilded astrolabe is used in Edit, Teach and Present. Geometry remains authoritative. */
export function WheelGraphic({ segments, selectedSegmentId = null, rotor, rotationDegrees, moving = false }: {
 rotor?: RefObject<SVGGElement>; rotationDegrees?: number; moving?: boolean;
 segments: (Pick<PublicWheelSegment,'id'|'label'> & Partial<Pick<PublicWheelSegment,'kind'>>)[]; selectedSegmentId?: string|null;
}) {
 const uid=useId().replace(/:/g,''), url=(name:string)=>`url(#${uid}-${name})`;
 const count=segments.length,selected=segments.findIndex(s=>s.id===selectedSegmentId);
 const rotation=rotationDegrees ?? (selected<0?0:-(selected+.5)*360/count);
 const point=(r:number,a:number)=>[360+r*Math.cos(a),380+r*Math.sin(a)];
 const palette=[['#338bae','#103b67'],['#9166ba','#3c216a'],['#47a88d','#12584b'],['#cb8b47','#783717'],['#657ccd','#273a7a'],['#bd668e','#642a56']];
 return <g className={`wheel-graphic${moving?' wheel-moving':''}`} data-selected-segment={selectedSegmentId ?? ''}>
  <defs>
   <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2=".7" y2="1"><stop stopColor="#fff1ba"/><stop offset=".22" stopColor="#e9b65d"/><stop offset=".46" stopColor="#855223"/><stop offset=".65" stopColor="#f9d785"/><stop offset="1" stopColor="#9d5e26"/></linearGradient>
   <radialGradient id={`${uid}-hub`} cx=".35" cy=".25"><stop stopColor="#a5f1f4"/><stop offset=".3" stopColor="#3aadc5"/><stop offset=".7" stopColor="#1e526d"/><stop offset="1" stopColor="#102237"/></radialGradient>
   <radialGradient id={`${uid}-halo`}><stop offset=".65" stopColor="#73a9ff" stopOpacity="0"/><stop offset=".88" stopColor="#9f78ed" stopOpacity=".16"/><stop offset="1" stopColor="#73a9ff" stopOpacity="0"/></radialGradient>
   {palette.map(([light,dark],i)=><linearGradient key={i} id={`${uid}-segment${i}`} x1=".15" y1="0" x2=".8" y2="1"><stop stopColor={light}/><stop offset="1" stopColor={dark}/></linearGradient>)}
  </defs>
  <ellipse cx="360" cy="664" rx="189" ry="22" fill="#050c20" opacity=".7"/>
  <path d="M315 604 L294 656 Q360 683 426 656 L405 604" fill={url('gold')} stroke="#523723" strokeWidth="3"/>
  <circle className="wheel-aura" cx="360" cy="380" r="283" fill={url('halo')}/>
  <circle cx="360" cy="389" r="260" fill="#080e23" opacity=".8"/>
  <circle cx="360" cy="380" r="261" fill={url('gold')} stroke="#ffe6a3" strokeWidth="2"/>
  <circle cx="360" cy="380" r="248" fill="#273050" stroke="#654828" strokeWidth="3"/>
  <circle cx="360" cy="380" r="241" fill="none" stroke="#c69b58" strokeWidth="2"/>
  {Array.from({length:32},(_,i)=>{const a=i*Math.PI/16,p=point(253,a);return <circle className="wheel-rim-light" key={i} cx={p[0]} cy={p[1]} r={i%4===0?4:2} fill={i%4===0?'#fff1b4':'#b9803d'}/>;})}
  {!count && <circle cx="360" cy="380" r="230" fill={url('segment0')}/>}
  <g className="wheel-rotor" ref={rotor} transform={`rotate(${rotation} 360 380)`}>
   {segments.map((segment,i)=>{
    const start=-Math.PI/2+i*2*Math.PI/count,end=start+2*Math.PI/count,middle=(start+end)/2;
    const a=point(230,start),b=point(230,end),degrees=middle*180/Math.PI,normalized=(degrees+rotation+360)%360;
    const p=point(count<=12?151:167,middle),chosen=!moving && segment.id===selectedSegmentId;
    return <g key={segment.id}><title>{segment.label}</title>
     {count===1?<circle cx="360" cy="380" r="230" fill={url('segment0')} stroke="#f6d998" strokeWidth="3"/>:<path d={`M360 380 L${a.join(' ')} A230 230 0 ${end-start>Math.PI?1:0} 1 ${b.join(' ')} Z`} fill={url(`segment${i%6}`)} stroke={chosen?'#fff1a7':'#d0b47b'} strokeWidth={chosen?7:count>60?.5:2.5}/>}
     {count<=24 && <text x={p[0]} y={p[1]} transform={`rotate(${degrees+(normalized>90&&normalized<270?180:0)} ${p.join(' ')})`} fill="#fff7e5" stroke="#12213e" strokeWidth=".65" paintOrder="stroke" textAnchor="middle" dominantBaseline="middle" fontSize={count<=12?20:17} fontWeight="600">{segment.label.length>14?`${segment.label.slice(0,13)}…`:segment.label}</text>}
     {(count<=12 || count>24 && i%Math.ceil(count/12)===0) && <text x={point(204,middle)[0]} y={point(204,middle)[1]} fill="#ffe6ad" textAnchor="middle" dominantBaseline="middle" fontSize="22">{segment.kind==='question'?'✦':segment.kind==='event'?'◆':'✧'}</text>}
    </g>;
   })}
   <circle cx="360" cy="380" r="229" fill="none" stroke="#fff4c2" strokeOpacity=".5" strokeWidth="3"/>
  </g>
  <circle cx="360" cy="385" r="62" fill="#050b18" opacity=".5"/>
  <circle cx="360" cy="380" r="61" fill={url('gold')} stroke="#ffe8b7" strokeWidth="2"/>
  <circle cx="360" cy="380" r="49" fill={url('hub')} stroke="#15394c" strokeWidth="3"/>
  <path d="M360 339 L369 369 L400 380 L369 390 L360 421 L350 390 L320 380 L350 369Z" fill="#ecfcff" stroke="#6addf3" strokeWidth="2"/>
  <path d="M360 356 L365 375 L384 380 L365 385 L360 404 L355 385 L336 380 L355 375Z" fill="#c4a15c"/>
  <circle cx="360" cy="380" r="8" fill="#fff6c9"/>
  <path className="wheel-pointer" d="M338 109 Q360 94 382 109 L371 143 L360 164 L349 143Z" fill={url('gold')} stroke="#fff2c2" strokeWidth="2"/>
  <path d="M353 114 L360 106 L367 114 L360 131Z" fill="#a4f3ed"/>
 </g>;
}
