import test from 'node:test';
import assert from 'node:assert/strict';
import {hasSpeech,validCaption} from './translation';
test('silence and short noise never launch recognition',()=>{
 assert.equal(hasSpeech(new Float32Array(16000)),false);
 const noise=Array(16000).fill(0);noise[100]=1;assert.equal(hasSpeech(noise),false);
 assert.equal(hasSpeech(Array(320001).fill(.1)),false);
 assert.equal(hasSpeech(Array(16000).fill(NaN)),false);
 assert.equal(hasSpeech(Array.from({length:16000},(_,i)=>.2*Math.sin(i/10))),true);
});
test('caption boundary rejects unsupported languages, invalid sizes and oversized content',()=>{
 const caption={language:'ja',mode:'furigana',tokens:[{text:'勇者',reading:'ゆうしゃ'}],fontSize:36,position:'top'};
 assert.equal(validCaption(caption),true);
 for(const patch of [{language:'en'},{mode:'html'},{fontSize:NaN},{fontSize:100},{position:'any'},{tokens:[{text:3}]},{tokens:[{text:'x'.repeat(6001)}]}])assert.equal(validCaption({...caption,...patch}),false);
});
