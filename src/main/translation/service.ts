import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { hasSpeech, type JapaneseMode, type ReadingToken, type TranslationRequest, type TranslationResult, type SpeechBackend, type TranslationSettings, type TranslationEngineState } from '../../shared/translation';

type NativeSession = {
  alive:boolean; backend:SpeechBackend; metrics:Record<string,number>;
  start(prepared:unknown):Promise<{backend:SpeechBackend;metrics:Record<string,number>}>;
  transcribe(audio:number[]):Promise<{text:string;metrics:Record<string,number>}>;
  cancel():Promise<void>; stop():Promise<void>;
};

/** Independent lifetimes: one resident recognizer, one target-specific Mozilla worker. */
export class TranslationService {
  private worker:Worker|null=null;
  private workerTarget='';
  private native:NativeSession|null=null;
  private nativeKey='';
  private disposal:Promise<void>=Promise.resolve();
  private pending:{resolve:(value:any)=>void;reject:(error:Error)=>void;timer:NodeJS.Timeout}|null=null;
  private serial=0;
  private revision=0;
  private busy=false;
  private state:TranslationEngineState={phase:'off'};
  constructor(private cache:string,private status:(message:string)=>void,private workerFile=path.join(__dirname,'inference.cjs'),private stateChanged:(state:TranslationEngineState)=>void=()=>{}){}

  getState(){return this.state;}
  private setState(state:TranslationEngineState){this.state=state;this.stateChanged(state);}
  private check(revision:number){if(revision!==this.revision)throw new Error('Cancelled');}
  private validate(settings:TranslationSettings){
    if(!settings||!['ja','it','ro'].includes(settings.target)||!['base.en','small.en'].includes(settings.model)||settings.execution!==undefined&&!['auto','gpu','cpu'].includes(settings.execution))throw new Error('Invalid translation settings');
  }
  private disposeWorker(error=new Error('Cancelled')){
    const worker=this.worker;this.worker=null;this.workerTarget='';
    if(this.pending){clearTimeout(this.pending.timer);this.pending.reject(error);this.pending=null;}
    const previous=this.disposal;
    this.disposal=Promise.all([previous,worker?.terminate().catch(()=>{})]).then(()=>{});
    return this.disposal;
  }
  private stopNative(){
    const native=this.native;this.native=null;this.nativeKey='';
    this.disposal=Promise.all([this.disposal,native?.stop()]).then(()=>{});
    return this.disposal;
  }
  async cancelCurrent(unload=false){
    const revision=++this.revision;this.busy=false;
    if(unload){
      this.setState({phase:'off'});
      this.disposeWorker();await this.stopNative();return;
    }
    if(this.pending)this.disposeWorker();
    if(this.native&&!this.native.alive)await this.stopNative();
    else this.disposal=Promise.all([this.disposal,this.native?.cancel()]).then(()=>{});
    await this.disposal;
    if(revision!==this.revision)return;
    if(this.native?.alive&&this.workerTarget)this.setState({...this.state,phase:'ready',message:undefined});
    else if(this.state.phase!=='off')this.setState({...this.state,phase:'error',message:'Preparation cancelled. Prepare translation again.'});
  }
  cancel(){return this.cancelCurrent(true);}

  private async call(payload:Record<string,unknown>):Promise<any>{
    const revision=this.revision;await this.disposal;this.check(revision);
    if(this.pending)throw new Error('Translation is busy');
    if(!this.worker){
      const worker=new Worker(this.workerFile,{workerData:{cache:this.cache}});this.worker=worker;
      const fail=(error:Error)=>{
        if(worker!==this.worker)return;
        void this.disposeWorker(error);
        if(!this.busy&&this.state.phase==='ready')this.setState({...this.state,phase:'error',message:error.message});
      };
      worker.on('message',message=>{
        if(worker!==this.worker)return;
        if(message.status){this.status(message.status);return;}
        if(message.id!==this.serial||!this.pending)return;
        if(message.error){fail(new Error(message.error));return;}
        const pending=this.pending;this.pending=null;clearTimeout(pending.timer);pending.resolve(message);
      });
      worker.on('error',fail);worker.on('exit',code=>fail(new Error(`Local translation worker exited (${code}). Prepare translation again.`)));
    }
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{void this.disposeWorker(new Error('Local model operation timed out; retry when ready.'));},360000);
      this.pending={resolve,reject,timer};this.worker!.postMessage({...payload,id:++this.serial});
    });
  }
  private async translator(target:string,revision:number){
    if(this.workerTarget===target)return 0;
    if(this.workerTarget){await this.disposeWorker();this.check(revision);}
    const result=await this.call({kind:'prepare',target});this.check(revision);
    this.workerTarget=target;return result.result.loadMs as number;
  }
  private async recognizer(settings:TranslationSettings,revision:number,forceCpuReason?:string){
    const key=`${settings.model}:${settings.execution??'auto'}`;
    if(!forceCpuReason&&this.native?.alive&&this.nativeKey===key)return;
    await this.stopNative();this.check(revision);
    let reason=forceCpuReason,device:string|undefined;
    const execution=settings.execution??'auto';
    if(execution!=='cpu'&&!reason){
      const probe=await require('./whisper.cjs').probeNvidia();this.check(revision);device=probe.device;reason=probe.reason;
      if(!device&&execution==='gpu')throw new Error(`${reason} Select CPU or Auto, or install a compatible NVIDIA driver.`);
    }
    const start=async(backend:'cpu'|'cuda')=>{
      this.status(`Preparing Whisper ${settings.model} (${backend==='cuda'?'NVIDIA CUDA':'CPU'})…`);
      const prepared=await this.call({kind:'speech',model:settings.model,backend});this.check(revision);
      const {WhisperSession}=require('./whisper-session.cjs');
      const native:NativeSession=new WhisperSession((error:Error)=>{
        if(this.native===native)this.setState({...this.state,phase:'error',message:`${error.message} Prepare translation again.`});
      });
      this.native=native;
      try{await native.start(prepared.result);this.check(revision);this.nativeKey=key;}
      catch(error){if(this.native===native){this.native=null;this.nativeKey='';}await native.stop();throw error;}
      return native;
    };
    let native:NativeSession|undefined;
    if(device){
      try{native=await start('cuda');}
      catch(error){this.check(revision);reason=error instanceof Error?error.message:String(error);if(execution==='gpu')throw new Error(`GPU preparation failed: ${reason} Select CPU or Auto, or update your NVIDIA driver.`);this.status(`GPU unavailable; preparing CPU. ${reason}`);}
    }
    if(!native){native=await start('cpu');if(reason)native.backend={...native.backend,reason};}
    this.check(revision);
  }
  private async ensure(settings:TranslationSettings,revision:number){
    await this.disposal;this.check(revision);
    settings={target:settings.target,model:settings.model,execution:settings.execution??'auto'};
    if(this.native?.alive&&this.nativeKey===`${settings.model}:${settings.execution??'auto'}`&&this.workerTarget===settings.target){
      this.setState({...this.state,phase:'ready',settings,backend:this.native.backend,message:undefined});return;
    }
    this.setState({phase:'preparing',settings,message:'Preparing local recognition and translation…'});
    const started=performance.now();
    await this.recognizer(settings,revision);this.check(revision);
    const translationLoadMs=await this.translator(settings.target,revision);this.check(revision);
    this.setState({phase:'ready',settings,backend:this.native!.backend,metrics:{...this.native!.metrics,translationLoadMs,prepareTotalMs:performance.now()-started}});
  }
  async prepare(settings:TranslationSettings){
    this.validate(settings);if(this.busy)throw new Error('Finish or cancel the current request first.');
    this.busy=true;const revision=this.revision;
    try{await this.ensure(settings,revision);return this.state;}
    catch(error){if(revision===this.revision)this.setState({...this.state,phase:'error',message:error instanceof Error?error.message:String(error)});throw error;}
    finally{if(revision===this.revision)this.busy=false;}
  }
  async run(request:TranslationRequest):Promise<TranslationResult>{
    this.validate(request);if(this.busy)throw new Error('Finish or cancel the current utterance first.');
    if(request.audio!==undefined&&(!Array.isArray(request.audio)||!hasSpeech(request.audio)))throw new Error('No clear speech detected. Speak closer to the microphone and try again.');
    if(request.audio===undefined&&(typeof request.text!=='string'||!request.text.trim()||request.text.length>2000))throw new Error('Enter 1–2000 English characters.');
    this.busy=true;const revision=this.revision,started=performance.now();
    const metrics:Record<string,number>={};let speechBackend:SpeechBackend|undefined;
    try{
      let transcript=request.text?.trim()??'';
      if(request.audio){
        await this.ensure(request,revision);this.check(revision);
        this.status(`Transcribing locally (${this.native!.backend.backend==='cuda'?'NVIDIA CUDA':'CPU'})…`);
        let speech;
        try{speech=await this.native!.transcribe(request.audio);}
        catch(error){
          this.check(revision);
          if((request.execution??'auto')!=='auto'||this.native?.backend.backend!=='cuda')throw error;
          const reason=error instanceof Error?error.message:String(error);
          this.setState({...this.state,phase:'preparing',message:'Recovering speech recognition on CPU…'});
          await this.recognizer(request,revision,reason);this.check(revision);
          speech=await this.native!.transcribe(request.audio);
          this.setState({...this.state,phase:'ready',backend:this.native!.backend,metrics:this.native!.metrics,message:undefined});
        }
        this.check(revision);transcript=speech.text;speechBackend=this.native!.backend;Object.assign(metrics,speech.metrics);
      }
      if(!transcript.trim())throw new Error('No speech recognized. Try again.');
      await this.translator(request.target,revision);this.check(revision);
      const translated=await this.call({kind:'translate',text:transcript,target:request.target});this.check(revision);
      Object.assign(metrics,translated.metrics,{translationMs:translated.result.translationMs,translationLoadMs:translated.result.loadMs,totalMs:performance.now()-started});
      return {transcript,translation:translated.result.text,metrics,...(speechBackend?{speechBackend}:{})};
    }catch(error){
      if(revision===this.revision&&(!this.native?.alive||!this.workerTarget)&&this.state.phase!=='off')this.setState({...this.state,phase:'error',message:error instanceof Error?error.message:String(error)});
      throw error;
    }finally{if(revision===this.revision)this.busy=false;}
  }
  async format(text:string,mode:JapaneseMode):Promise<ReadingToken[]>{
    if(typeof text!=='string'||text.length>2000||!['standard','kana','furigana'].includes(mode))throw new Error('Invalid Japanese text');
    if(this.busy)throw new Error('Wait for translation to finish.');
    this.busy=true;const revision=this.revision;
    try{const result=await this.call({kind:'format',text,mode});this.check(revision);return result.result;}
    finally{if(revision===this.revision)this.busy=false;}
  }
}
