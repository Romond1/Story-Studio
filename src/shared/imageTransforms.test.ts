import test from 'node:test';
import assert from 'node:assert/strict';
import { transformImagePixels, validateImageTransform, imageTransformLayout } from './content/imageTransforms';
const source={width:2,height:2,data:new Uint8ClampedArray([255,0,0,255, 0,255,0,255, 0,0,255,128, 255,255,255,0])};
test('pixel transform neutral identity and flip-before-clockwise rotation preserve alpha',()=>{
 const neutral=transformImagePixels(source,{version:1},{fit:'contain'});assert.deepEqual(neutral,source);
 const result=transformImagePixels(source,{version:1,flipX:true,rotation:90},{fit:'contain'});
 assert.deepEqual(Array.from(result.data),[255,255,255,0,0,255,0,255,0,0,255,128,255,0,0,255]);
 assert.equal(source.data[0],255);
});
test('crop geometry, non-square rotation, cover focal and contain transparent padding',()=>{
 const pixels={width:4,height:1,data:new Uint8ClampedArray([10,0,0,255,20,0,0,255,30,0,0,255,40,0,0,255])};
 const crop=transformImagePixels(pixels,{version:1,crop:{x:.25,y:0,width:.5,height:1},rotation:90},{fit:'contain'});
 assert.equal(crop.width,1);assert.equal(crop.height,2);assert.deepEqual(Array.from(crop.data),[20,0,0,255,30,0,0,255]);
 const contain=transformImagePixels(pixels,{version:1},{fit:'contain',aspectRatio:1});assert.equal(contain.height,4);assert.equal(contain.data[3],0);
 const cover=transformImagePixels(pixels,{version:1},{fit:'cover',aspectRatio:1,focalX:1});assert.equal(cover.data[0],40);
 assert.equal(imageTransformLayout(4,1,{version:1,rotation:90},{fit:'contain'}).output.height,4);
});
test('finite normalized transforms reject unsupported values; color math is deterministic',()=>{
 for(const transform of [{version:2},{version:1,crop:{x:.8,y:0,width:.5,height:1}},{version:1,brightness:Infinity},{version:1,rotation:45}])assert.throws(()=>validateImageTransform(transform));
 const color=transformImagePixels(source,{version:1,brightness:0},{fit:'contain'});assert.deepEqual(Array.from(color.data.slice(0,4)),[0,0,0,255]);
 assert.throws(()=>imageTransformLayout(5000,5000,{version:1},{fit:'contain'}),/limit/);
 const gray=transformImagePixels(source,{version:1,saturation:0},{fit:'contain'});assert.deepEqual(Array.from(gray.data.slice(0,4)),[54,54,54,255]);
 const midpoint=transformImagePixels(source,{version:1,contrast:0},{fit:'contain'});assert.deepEqual(Array.from(midpoint.data.slice(0,4)),[128,128,128,255]);
 const reverse=transformImagePixels(source,{version:1,rotation:180},{fit:'contain'});assert.deepEqual(Array.from(reverse.data.slice(0,4)),[255,255,255,0]);
 const left=transformImagePixels(source,{version:1,rotation:270},{fit:'contain'});assert.deepEqual(Array.from(left.data.slice(0,4)),[0,255,0,255]);
});
