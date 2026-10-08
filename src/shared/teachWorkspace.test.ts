import test from 'node:test';
import assert from 'node:assert/strict';
import { clientToLogical } from './teachingScene';
import { fitLogicalFrame } from './staticScene';
import { parsePresentViewport, fitPreviewViewport, previewPoint, clampTeachSplit, clampTeachNavigatorHeight, teachNavigatorRows, navigatorWheelDelta } from './teachWorkspace';

test('viewport accepts inner dimensions and rejects malformed reports', () => {
 assert.deepEqual(parsePresentViewport({width:1280,height:720}), {width:1280,height:720});
 for (const value of [null,{}, {width:0,height:2},{width:Infinity,height:2},{width:100,height:-1}]) assert.equal(parsePresentViewport(value),null);
});
test('Present controls shape, Control and divider only scale', () => {
 for(const viewport of [{width:1280,height:720},{width:500,height:1000},{width:2100,height:600}]) {
  for(const available of [{width:640,height:500},{width:400,height:650},{width:900,height:400}]) {
   const fit=fitPreviewViewport(viewport,available);
   assert.ok(Math.abs(fit.width/fit.height-viewport.width/viewport.height)<1e-10);
   assert.ok(fit.width<=available.width+1e-9 && fit.height<=available.height+1e-9);
   for(const [x,y] of [[0,0],[1,0],[0,1],[1,1],[0.5,0.5]]) {
    const point=previewPoint({x:fit.x+x*fit.width,y:fit.y+y*fit.height},fit);
    assert.ok(point && Math.abs(point.x-x)<1e-10 && Math.abs(point.y-y)<1e-10);
   }
   assert.equal(previewPoint({x:fit.x-1,y:fit.y},fit),null);
   assert.equal(previewPoint({x:fit.x,y:fit.y+fit.height+1},fit),null);
  }
 }
});
test('split preferences stay finite and within operational limits',()=>{
 assert.equal(clampTeachSplit(NaN),42); assert.equal(clampTeachSplit(0),30); assert.equal(clampTeachSplit(100),65); assert.equal(clampTeachSplit(45),45);
});

test('existing drawing and board coordinates survive Present resize, zoom and pan',()=>{
 const frame={width:1280,height:720};
 const stroke=[{x:0,y:0},{x:1,y:0},{x:0,y:1},{x:1,y:1},{x:.5,y:.5}];
 const before=JSON.stringify(stroke);
 for(const viewport of [{width:1280,height:720},{width:480,height:900},{width:1900,height:500}]) {
  const preview=fitPreviewViewport(viewport,{width:600,height:500});
  const scene=fitLogicalFrame(frame,{width:preview.width,height:preview.height});
  const rect={left:preview.x+scene.x,top:preview.y+scene.y,width:frame.width*scene.scale,height:frame.height*scene.scale};
  for(const zoom of [1,2,4]) for(const pan of [{x:0,y:0},{x:-120,y:35}]) for(const point of stroke) {
   const screen={x:rect.left+(point.x*frame.width*zoom+pan.x)*scene.scale,y:rect.top+(point.y*frame.height*zoom+pan.y)*scene.scale};
   const logical=clientToLogical(screen,rect,frame);
   assert.ok(Math.abs((logical.x-pan.x)/zoom/frame.width-point.x)<1e-10);
   assert.ok(Math.abs((logical.y-pan.y)/zoom/frame.height-point.y)<1e-10);
  }
 }
 assert.equal(JSON.stringify(stroke),before);
});


test('navigator height preference preserves usable upper workspace and adds readable rows as space grows', () => {
 assert.equal(clampTeachNavigatorHeight(NaN,768),176);
 assert.equal(clampTeachNavigatorHeight(80,768),176);
 assert.equal(clampTeachNavigatorHeight(400,768),400);
 assert.equal(clampTeachNavigatorHeight(900,768),400);
 assert.equal(clampTeachNavigatorHeight(400,500),270);
 assert.equal(teachNavigatorRows(110),1);
 assert.equal(teachNavigatorRows(220),2);
 assert.equal(teachNavigatorRows(330),3);
 assert.equal(teachNavigatorRows(1000),3);
});
test('navigator wheel supports vertical mouse, horizontal trackpad and line/page deltas', () => {
 assert.equal(navigatorWheelDelta(0,120,0,600),120);
 assert.equal(navigatorWheelDelta(-80,10,0,600),-80);
 assert.equal(navigatorWheelDelta(0,-3,1,600),-48);
 assert.equal(navigatorWheelDelta(0,1,2,600),600);
 assert.equal(navigatorWheelDelta(0,0,0,600),0);
});

