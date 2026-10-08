import assert from 'node:assert/strict';
import {readFileSync,promises as fs} from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import ts from 'typescript';

// Reuse the existing real-main IPC harness, without registering its test suite.
const source=ts.createSourceFile('test.ts',readFileSync('src/shared/projectPersistence.test.ts','utf8'),ts.ScriptTarget.Latest,true);
const declaration=source.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='mainHarness');
assert.ok(declaration);
const code=ts.transpileModule(declaration.getText(source),{compilerOptions:{target:ts.ScriptTarget.ES2021}}).outputText;
const api=new Function('ts','readFileSync','createRequire','path','vm',`${code};return mainHarness();`)(ts,readFileSync,createRequire,path,vm);
const inventory=readFileSync('docs/card-v2-research/episode-inventory.md','utf8');
const paths=[...inventory.matchAll(/^\| ([1-6]) \| `([^`]+project\.json)`/gm)];
assert.equal(paths.length,6);
const results=[];
for(const [,episode,file] of paths){
  const before=createHash('sha256').update(await fs.readFile(file)).digest('hex');
  // This handler only reads and normalizes in memory. Never activate or save.
  const opened=await api.call('project:open-path',path.dirname(file));
  const after=createHash('sha256').update(await fs.readFile(file)).digest('hex');
  assert.equal(after,before);assert.ok(opened.data.slides.length>0);
  results.push({episode:Number(episode),slides:opened.data.slides.length,sections:opened.data.sections.length,sha256Before:before,sha256After:after,unchanged:true});
}
await fs.writeFile('docs/media-pool-evidence/episode-readonly-open.json',JSON.stringify(results,null,2));
console.log('PASS: Episodes 1–6 opened through real main loader; all source hashes unchanged.');
