const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {pathToFileURL,fileURLToPath} = require('node:url');
const {modelFile} = require('./cache.cjs');
const records = require('./models.json');
/** Provider interface: translate(text, target), dispose(). One worker, one language. */
class MozillaProvider {
  constructor(cache,status){ this.cache=cache; this.status=status; }
  async load(target) {
    if(this.target===target) return;
    if(this.engine) throw new Error('Switch language by replacing the inference worker');
    const started=performance.now();
    const files={};
    for(const record of records.filter(r=>r.targetLanguage===target)) files[record.fileType]=await modelFile(this.cache,record,this.status);
    this.status('Loading local translation model…');
    const root=path.dirname(require.resolve('@browsermt/bergamot-translator/package.json'));
    const workerDir=path.join(root,'worker');
    // Upstream ships a browser worker in an ESM package with CommonJS Node shims.
    // Adapt only its local file/worker surface; all inference stays in this thread.
    global.self={
      location:pathToFileURL(path.join(workerDir,'translator-worker.js')),
      fetch:async url=>new Response(await fs.promises.readFile(fileURLToPath(url)),{headers:{'Content-Type':'application/wasm'}}),
      addEventListener(){}, postMessage(){},
      importScripts:(name)=>vm.runInThisContext(fs.readFileSync(path.join(workerDir,name),'utf8'),{filename:name}),
    };
    global.require=require; global.__dirname=workerDir;
    const source=fs.readFileSync(path.join(workerDir,'translator-worker.js'),'utf8');
    this.engine=new Function(source+';return worker;')();
    // Emscripten glue accesses the worker's Module through global scope.
    Object.defineProperty(global,'Module',{configurable:true,get:()=>global.self.Module});
    await this.engine.initialize({cacheSize:0,useNativeIntGemm:false});
    this.engine.loadTranslationModel({from:'en',to:target},{
      model:files.model,shortlist:files.lex,
      vocabs:files.vocab?[files.vocab]:[files.srcvocab,files.trgvocab],
    });
    this.target=target; this.loadMs=performance.now()-started;
  }
  async translate(text,target) {
    const cold=this.target!==target;
    await this.load(target);
    this.status('Translating locally…');
    const started=performance.now();
    const [result]=this.engine.translate({models:[{from:'en',to:target}],texts:[{text,html:false,qualityScores:false}]});
    return {text:result.target.text,loadMs:cold?this.loadMs:0,translationMs:performance.now()-started};
  }
  dispose(){ if(this.target)this.engine.freeTranslationModel({from:'en',to:this.target}); }
}
module.exports={MozillaProvider};
