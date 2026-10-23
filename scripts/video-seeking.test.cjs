const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText,filename);
const {PresentationMediaCore}=require('../src/shared/presentationMedia.ts');
function setup(){let refs=[],index=0,effects=[],runtime;const react={useRef:value=>refs[index++]??(refs[index-1]={current:value}),useState:value=>[value,()=>{}],useEffect:fn=>effects.push(fn)};
 const api={onPresentMediaRuntime:fn=>{runtime=fn;return()=>{}},getPresentMediaRuntime:()=>new Promise(()=>{}),onPresentMediaPacket:()=>()=>{},sendPresentMediaPacket(){}};
 const module={exports:{}};const code=ts.transpileModule(fs.readFileSync('src/renderer/usePresentationMedia.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,window:{appApi:api},require:name=>name==='react'?react:name.includes('shared/presentationMedia')?{PresentationMediaCore}:name.includes('AudioManager')?{audioManager:{getContext:()=>({resume:async()=>{}})}}:{ControlMediaReceiver:class{constructor(intent){this.link={intent}}update(intent){this.link.intent=intent}dispose(){}}}});
 const render=(id, autoplay=false)=>{index=0;effects=[];const result=module.exports.usePresentationMedia(id,{enabled:true,volume:1},undefined,true,0,false,autoplay);return result};
 render('video-one');effects.forEach(fn=>fn());runtime({generation:1,available:true});return {render,refs};}
test('rapid seeks from one rendered handler all reach the same video',async()=>{const{render,refs}=setup();const media=render('video-one');await media.command('seek',2);await media.command('seek',5);await media.command('seek',7);assert.equal(refs[0].current.intent.positionSec,7)});
test('callbacks from a previous scene cannot seek the new video',async()=>{const{render,refs}=setup();const stale=render('video-one');render('video-two');await stale.command('seek',8);assert.equal(refs[0].current.intent.positionSec,0)});

test('scene navigation stays paused when autoplay is off and plays when explicitly enabled',()=>{const{render,refs}=setup();render('video-two',false);assert.equal(refs[0].current.intent.playing,false);render('video-three',true);assert.equal(refs[0].current.intent.playing,true);});
