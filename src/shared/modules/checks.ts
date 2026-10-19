export type Validator=(value:unknown,path:string)=>void;
export const fail=(path:string):never=>{throw new Error(`Invalid module ${path}`);};
export const obj=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export const str:Validator=(v,p)=>{if(typeof v!=='string'||v.length>100000)fail(p);};
export const identity:Validator=(v,p)=>{if(typeof v!=='string'||!v||v.length>200||['__proto__','constructor','prototype'].includes(v))fail(p);};
export const num=(min=0,max=1000000,integer=false):Validator=>(v,p)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||(integer&&!Number.isInteger(v)))fail(p);};
export const bool:Validator=(v,p)=>{if(typeof v!=='boolean')fail(p);};
export const one=(values:readonly string[]):Validator=>(v,p)=>{if(typeof v!=='string'||!values.includes(v))fail(p);};
export const arr=(item:Validator,min=0,max=2000):Validator=>(v,p)=>{if(!Array.isArray(v)||v.length<min||v.length>max)fail(p);(v as unknown[]).forEach((x,i)=>item(x,`${p}/${i}`));};
export const shape=(required:Record<string,Validator>,optional:Record<string,Validator>={}):Validator=>(v,p)=>{
 if(!obj(v))fail(p);const o=v as Record<string,unknown>;
 for(const key of Object.keys(o)){const check=required[key]??optional[key];if(!Object.hasOwnProperty.call(required,key)&&!Object.hasOwnProperty.call(optional,key))fail(`${p}/${key}`);check(o[key],`${p}/${key}`);}
 for(const key of Object.keys(required))if(!Object.hasOwnProperty.call(o,key))fail(`${p}/${key}`);
};
export const record=(item:Validator,keyCheck:Validator=identity,max=2000):Validator=>(v,p)=>{if(!obj(v)||Object.keys(v).length>max)fail(p);for(const [key,value] of Object.entries(v as object)){keyCheck(key,`${p}/key`);item(value,`${p}/${key}`);}};
export const unique=(items:readonly string[],p:string)=>{if(new Set(items).size!==items.length)fail(p);};
export const media:Validator=(v,p)=>{str(v,p);if(v!==''&&!(typeof v==='string'&&(/^asset:[^\s/\\:?#]{1,200}$/.test(v)||/^builtin:(language-snake|final-boss-hero|activation-cards)\/[a-zA-Z0-9_./-]+$/.test(v)&&!v.split('/').includes('..'))))fail(p);};
export const color:Validator=(v,p)=>{str(v,p);if(typeof v!=='string'||!(/^(#[\da-fA-F]{3,8}|[a-zA-Z]+|(?:rgb|hsl)a?\([\d.,%\s+-]+\))$/.test(v)))fail(p);};
export const background:Validator=(v,p)=>{try{media(v,p);return;}catch{}try{color(v,p);return;}catch{}if(typeof v!=='string'||! /^(linear|radial)-gradient\([#\da-zA-Z.,%()\s+-]+\)$/.test(v)||/url|expression/i.test(v))fail(p);};
export const icon:Validator=(v,p)=>{try{media(v,p);return;}catch{}if(typeof v!=='string'||v.length>40||/[/:\\.]|url\(/i.test(v))fail(p);};
