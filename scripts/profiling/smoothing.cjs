// Same-input numerical replay of the production exponential filter for the nose.
// Roughness includes genuine head acceleration: it is NOT ground-truth jitter.
const fs=require('node:fs');const raw=JSON.parse(fs.readFileSync('docs/performance-evidence/E-20Hz.json')).presenter.poses;
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
const distance=(a,b)=>Math.hypot((a.x-b.x)*1280,(a.y-b.y)*720);
const results=[0,45,90].map(tau=>{
 let old=null;const poses=raw.map(p=>{const dt=old?p.t-old.t:Infinity,alpha=!old||dt>350||!tau?1:1-Math.exp(-dt/tau);const s={t:p.t,x:old?old.x+(p.x-old.x)*alpha:p.x,y:old?old.y+(p.y-old.y)*alpha:p.y};old=s;return s;});
 const offset=poses.map((p,i)=>distance(p,raw[i])),changes=[];
 for(let i=2;i<poses.length;i++){const a=poses[i-2],b=poses[i-1],c=poses[i],d1=b.t-a.t,d2=c.t-b.t;if(d1>200||d2>200)continue;changes.push(Math.hypot(((c.x-b.x)/d2-(b.x-a.x)/d1)*1280,((c.y-b.y)/d2-(b.y-a.y)/d1)*720));}
 return {tauMs:tau,samples:poses.length,meanOffsetPixels:mean(offset),maxOffsetPixels:Math.max(...offset),rmsVelocityChangePixelsPerMs:Math.sqrt(mean(changes.map(v=>v*v)))};
});
fs.writeFileSync('docs/performance-evidence/smoothing-replay.json',JSON.stringify({source:'E-20Hz actual 14.81Hz physical observations',note:'Derived same-input replay. Offset is to noisy raw observations, not truth. Roughness includes desired head acceleration. No screen interpolation was implemented.',results},null,2));console.table(results);
