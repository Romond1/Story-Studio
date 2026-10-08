import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

/** Exercise real App callbacks, with broadcast effects observed at the boundary. */
function harness(mode:'edit'|'teach') {
  const source=ts.createSourceFile('App.tsx',readFileSync('src/renderer/App.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const declarations:string[]=[];
  const visit=(node:ts.Node)=>{
    if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)){
      if(['removeSlideAudio','removeSectionBgm'].includes(node.name.text)||node.name.text==='handleKeyDown'&&node.getText(source).includes('NumpadAdd'))declarations.push(`const ${node.getText(source)};`);
    }ts.forEachChild(node,visit);
  };visit(source);
  const clip={url:'media://assets/shared.mp3',volume:.5};
  const slide={id:'edit-slide',bgm:clip},section={id:'edit-section',bgm:[clip]};
  const calls:string[]=[];
  const context:any={appMode:mode,project:{data:{slides:[slide],sections:[section]}},currentSlide:slide,selectedSection:section,
    audioManager:{stopClip:()=>calls.push('stopClip'),stopSectionMusic:()=>calls.push('stopSectionMusic'),setVolume:()=>calls.push('setVolume')},
    setProject:(p:any)=>{context.latest=p;},setIsDirty:()=>{},updateSection:(_id:string,value:any)=>{context.sectionUpdate=value;},
    isPlainTeacherKey:()=>true,claimTeacherKey:()=>{},activeOverlayId:null};
  vm.createContext(context);
  const code=ts.transpileModule(declarations.join('\n')+'\nglobalThis.commands={removeSlideAudio,removeSectionBgm,handleKeyDown};',{compilerOptions:{target:ts.ScriptTarget.ES2021}}).outputText;
  vm.runInContext(code,context);return {context,calls,commands:context.commands};
}
test('removing Edit slide/section audio changes authored content without stopping Live',()=>{
  const {commands,calls,context}=harness('edit');commands.removeSlideAudio('bgm');commands.removeSectionBgm(0);
  assert.equal(context.latest.data.slides[0].bgm,undefined);assert.equal(context.sectionUpdate.bgm.length,0);
  assert.deepEqual(calls,[]);
});
test('Edit section volume shortcuts update authored volume without changing broadcast volume',()=>{
  const {commands,calls,context}=harness('edit');commands.handleKeyDown({code:'NumpadAdd',key:'+'});
  assert.equal(context.sectionUpdate.bgm[0].volume,.55);assert.deepEqual(calls,[]);
});
test('Teach explicit audio removal still stops playback',()=>{
  const {commands,calls}=harness('teach');commands.removeSlideAudio('bgm');commands.removeSectionBgm(0);
  assert.deepEqual(calls,['stopClip','stopClip','stopSectionMusic']);
});
