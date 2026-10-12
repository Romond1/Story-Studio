const {parentPort,workerData}=require('node:worker_threads');
const {MozillaProvider}=require('./bergamot.cjs');
const status=value=>parentPort.postMessage({status:value});
const provider=new MozillaProvider(workerData.cache,status);
let tokenizer;
async function format(text,mode){
  if(mode==='standard')return [{text}];
  status('Analyzing Japanese readings…');
  tokenizer ??= await new Promise((resolve,reject)=>require('kuromoji').builder({dicPath:require('node:path').join(require('node:path').dirname(require.resolve('kuromoji/package.json')),'dict')}).build((err,t)=>err?reject(err):resolve(t)));
  return tokenizer.tokenize(text).map(t=>{
    const original=t.surface_form;
    const reading=t.reading?.replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
    if(!/[\u3400-\u9fff々]/.test(original)||!reading)return {text:original};
    return mode==='kana'?{text:reading}:{text:original,reading};
  });
}
let busy=false;
const speechPrepared=new Map();
async function speech(model,backend){
  const key=`${backend}:${model}`;
  if(!speechPrepared.has(key))speechPrepared.set(key,await require('./whisper.cjs').prepareResidentSpeech(workerData.cache,model,status,backend));
  return speechPrepared.get(key);
}
parentPort.on('message',async ({id,kind,text,target,mode,model,backend})=>{
  if(busy){parentPort.postMessage({id,error:'Inference busy'});return;}
  busy=true;
  const cpu=process.cpuUsage(),start=performance.now(),ram=process.memoryUsage().rss;
  try{
    const result=kind==='speech'?await speech(model,backend):kind==='prepare'?(await provider.load(target),{loadMs:provider.loadMs}):kind==='format'?await format(text,mode):await provider.translate(text,target);
    const used=process.cpuUsage(cpu);
    parentPort.postMessage({id,result,metrics:{workerWallMs:performance.now()-start,cpuMs:(used.user+used.system)/1000,rssMB:process.memoryUsage().rss/1048576,rssDeltaMB:(process.memoryUsage().rss-ram)/1048576}});
  }catch(error){parentPort.postMessage({id,error:error.message});}
  finally{busy=false;}
});
