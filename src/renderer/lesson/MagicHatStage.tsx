import { useId, useLayoutEffect, useRef } from 'react';
import type { GameReveal } from '../../shared/lesson/gameStage';
import './magicHatStage.css';

/** A passive, epoch-seekable stage: animation never controls the lesson outcome. */
export function MagicHatStage({ reveal, phase }: { reveal?: GameReveal; phase: string }) {
 const uid = useId().replace(/:/g, ''), paint = (name: string) => `url(#${uid}-${name})`;
 const hat = useRef<SVGGElement>(null), magic = useRef<SVGGElement>(null), object = useRef<SVGGElement>(null);
 useLayoutEffect(() => {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0, disposed = false;
  const draw = () => {
   if (disposed) return;
   const duration = Math.max(1, reveal?.durationMs || 2600);
   const p = reveal ? preference.matches ? 1 : Math.min(1, Math.max(0, (Date.now() - reveal.startedAt) / duration)) : 0;
   const variant = ((reveal?.variant ?? 0) % 3 + 3) % 3;
   const swell = Math.sin(Math.PI * Math.min(1, p / .56));
   const shake = p < .52 ? Math.sin(p * Math.PI * 26) * swell : 0;
   const emerge = Math.min(1, Math.max(0, (p - .38) / .4));
   const ease = 1 - Math.pow(1 - emerge, 3);
   const lift = variant === 2 ? -28 * swell : variant === 0 ? -16 * Math.abs(shake) : 0;
   const sx = variant === 0 ? 1 + .045 * swell : 1;
   const sy = variant === 0 ? 1 - .065 * swell : 1;
   hat.current?.setAttribute('transform', `translate(360 ${440 + lift}) rotate(${variant === 1 ? shake * 6 : shake * 2}) scale(${sx} ${sy}) translate(-360 -440)`);
   magic.current?.setAttribute('opacity', String(reveal ? .18 + .64 * Math.sin(Math.PI * p) + .14 * ease : 0));
   object.current?.setAttribute('opacity', String(ease));
   object.current?.setAttribute('transform', `translate(0 ${85 * (1 - ease) - 110 * ease}) rotate(${(1 - ease) * -22} 360 220)`);
   if (reveal && p < 1 && !preference.matches) frame = requestAnimationFrame(draw);
  };
  const changed = () => { cancelAnimationFrame(frame); draw(); };
  preference.addEventListener('change', changed); draw();
  return () => { disposed = true; cancelAnimationFrame(frame); preference.removeEventListener('change', changed); };
 }, [reveal?.id, reveal?.startedAt, reveal?.durationMs, reveal?.variant]);
 return <svg className="magic-hat-stage" viewBox="0 0 720 620" role="img" aria-label={reveal ? 'A mysterious enchanted jewel rises above a wizard hat' : 'An enchanted wizard hat rests on a gilded pedestal'} data-phase={phase}>
  <defs>
   <linearGradient id={`${uid}-cloth`} x1="0" y1="0" x2="1" y2=".7"><stop stopColor="#a088d4"/><stop offset=".28" stopColor="#58428a"/><stop offset=".6" stopColor="#302a61"/><stop offset="1" stopColor="#171c3e"/></linearGradient>
   <linearGradient id={`${uid}-brim`} x1="0" y1="0" x2=".4" y2="1"><stop stopColor="#655087"/><stop offset=".45" stopColor="#392b61"/><stop offset="1" stopColor="#161a35"/></linearGradient>
   <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#fff0b4"/><stop offset=".3" stopColor="#dcb36b"/><stop offset=".6" stopColor="#8b592f"/><stop offset=".8" stopColor="#ebc786"/><stop offset="1" stopColor="#aa773a"/></linearGradient>
   <radialGradient id={`${uid}-halo`}><stop stopColor="#ac8ef2" stopOpacity=".3"/><stop offset=".65" stopColor="#7e70cc" stopOpacity=".09"/><stop offset="1" stopColor="#7e70cc" stopOpacity="0"/></radialGradient>
   <linearGradient id={`${uid}-gem`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#d9fff2"/><stop offset=".4" stopColor="#79ddda"/><stop offset="1" stopColor="#37609d"/></linearGradient>
  </defs>
  <ellipse cx="360" cy="330" rx="290" ry="258" fill={paint('halo')}/>
  <g className="hat-orbit" fill="none" stroke="#b6a1df" strokeOpacity=".15"><ellipse cx="360" cy="345" rx="273" ry="205"/><path d="M106 380 Q360 180 614 380 M145 212 Q360 495 575 212"/><circle cx="360" cy="345" r="244" strokeDasharray="2 20"/></g>
  <g fill="#e8d5a1" opacity=".7">{[[142,237],[582,217],[128,413],[595,398],[220,129],[511,131]].map(([x,y],i)=><path key={i} d={`M${x} ${y-6} l2 4 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2Z`}/>)}</g>
  <ellipse cx="360" cy="548" rx="226" ry="25" fill="#070c1e" opacity=".65"/>
  <path d="M176 490 L188 529 Q360 578 532 529 L544 490Z" fill={paint('brim')} stroke="#94734c" strokeWidth="2"/>
  <ellipse cx="360" cy="489" rx="185" ry="43" fill="#20263f" stroke={paint('gold')} strokeWidth="5"/>
  <ellipse cx="360" cy="486" rx="166" ry="31" fill="#30314d" stroke="#b79662" strokeOpacity=".65"/>
  <path d="M208 531 Q360 568 512 531" fill="none" stroke={paint('gold')} strokeWidth="3"/>
  <g ref={magic} opacity="0" fill="none" strokeLinecap="round">
   <path d="M309 411 C213 336 385 319 308 226 C274 185 314 160 334 149 M407 414 C489 327 354 300 418 243 C465 199 410 174 405 159" stroke="#b0d8ef" strokeWidth="18" opacity=".13"/>
   <path d="M310 409 C248 335 386 315 324 238 M409 405 C466 335 358 297 418 244" stroke="#d4c5fb" strokeWidth="3" opacity=".55"/>
   <path d="M280 399 L253 280 M440 400 L477 270 M348 373 L351 160" stroke="#f7df9e" strokeWidth="2" opacity=".32"/>
   {[[-84,32],[-61,-46],[83,-24],[111,53],[-104,98],[53,109]].map(([x,y],i)=><path key={i} d={`M${360+x} ${225+y-8} v16 M${352+x} ${225+y} h16`} stroke="#fff0bf" strokeWidth="2"/>) }
  </g>
  <g ref={object} opacity="0">
   <circle cx="360" cy="217" r="56" fill={paint('halo')}/>
   <path d="M360 164 L394 192 L384 237 L360 259 L336 237 L326 192Z" fill={paint('gem')} stroke="#f5e6b5" strokeWidth="3"/>
   <path d="M360 164 L346 201 L360 259 L375 201Z" fill="#c1fff1" opacity=".65"/><path d="M326 192 L346 201 L375 201 L394 192 M336 237 L346 201 M384 237 L375 201" stroke="#24798d" fill="none" opacity=".65"/>
   <path d="M359 146 v-14 M410 183 l10 -7 M309 183 l-10 -7" stroke="#f2d393" strokeWidth="2" strokeLinecap="round"/>
  </g>
  <g ref={hat}>
   <ellipse cx="360" cy="449" rx="202" ry="42" fill="#080e23" opacity=".5"/>
   <path d="M155 427 C183 395 244 403 282 393 L433 388 C474 396 550 388 568 423 C583 457 473 483 365 481 C255 484 131 461 155 427Z" fill={paint('brim')} stroke="#8a76ad" strokeWidth="2"/>
   <path d="M164 439 C245 477 486 477 560 432" fill="none" stroke="#b49ac6" strokeOpacity=".42" strokeWidth="3"/>
   <path d="M249 421 C268 350 278 288 303 230 C321 186 344 156 381 143 C411 131 445 145 461 126 C459 167 421 181 402 185 C386 228 409 277 428 328 L464 421 C419 449 296 451 249 421Z" fill={paint('cloth')} stroke="#9b84b6" strokeWidth="2"/>
   <path d="M302 385 C317 301 321 236 355 185 C369 165 395 154 420 151 C367 184 368 235 368 268 C367 315 387 370 394 410" fill="#bc91ca" opacity=".12"/>
   <path d="M402 185 Q373 189 361 204 M291 300 Q308 313 319 315 M420 323 Q403 327 393 338" stroke="#161b3f" strokeWidth="4" fill="none" opacity=".42"/>
   <path d="M260 383 Q358 417 451 381 L464 418 Q358 457 249 421Z" fill="#44283f" stroke="#b6925a" strokeWidth="2"/>
   <path d="M257 394 Q355 429 457 393" stroke="#d5ac69" strokeOpacity=".65" strokeWidth="2" fill="none"/>
   <path d="M347 395 L385 399 L384 435 L345 431Z" fill={paint('gold')} stroke="#fff0bd" strokeWidth="1.5"/>
   <path d="M355 404 L377 406 L376 426 L354 424Z" fill="#242a50"/><path d="M365 407 L372 416 L364 424 L358 415Z" fill={paint('gem')}/>
   <g fill={paint('gold')} stroke="#e9c98c" strokeWidth=".7"><path d="M336 242 A24 24 0 1 0 358 277 A21 21 0 0 1 336 242Z"/><path d="M383 304 l5 12 13 2 -10 8 2 13 -11 -7 -11 6 3 -13 -10 -9 14 -1Z"/><path d="M319 337 l3 7 8 2 -6 5 1 8 -7 -4 -7 3 2 -8 -5 -5 8 -1Z"/><path d="M392 213 l2 5 6 1 -5 4 1 6 -5 -3 -5 3 1 -6 -4 -4 6 -1Z"/></g>
   <path d="M286 357 Q304 354 312 366 M410 359 Q421 355 428 366" fill="none" stroke="#b9a0d0" strokeOpacity=".4" strokeWidth="2"/>
  </g>
 </svg>;
}

