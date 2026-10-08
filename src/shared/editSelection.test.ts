import test from 'node:test';
import assert from 'node:assert/strict';
import { createPresentationSession, reducePresentationSession, resolvePresentationTarget, applyPresentationDrawing, presentationToken } from './presentationSession';
import { createEditSelection, editSessionView, selectEdit, showEditInPresent, runNavigationAudio } from './editSelection';
import { ProjectHistory } from './projectHistory';
import type { ProjectData } from './types';

const data: ProjectData = { version: 4, createdAt: '', updatedAt: '', assets: [], sections: [{id:'one',name:'One'}, {id:'two',name:'Two'}], slides: [
  {id:'12',assetId:'a',sectionId:'one',transition:'none'}, {id:'15',assetId:'b',sectionId:'two',transition:'none'}] };
const live = reducePresentationSession(createPresentationSession('live'), {type:'project',projectId:'p',slideId:'12',sectionId:'one'});

test('Slide 15 and another section in Edit leave Live on Slide 12', () => {
  const edit = selectEdit(createEditSelection(data), {storySlideId:'15',sectionId:'two'});
  assert.equal(resolvePresentationTarget(data, editSessionView(edit, live)).contentId,'15');
  assert.equal(resolvePresentationTarget(data, live).contentId,'12');
  assert.equal(live.sectionId,'one');
});
test('only explicit Show in Present hands selectors to Core, including leaving a booster', () => {
  const edit = selectEdit(createEditSelection(data), {storySlideId:'15',sectionId:'two'});
  const boost = reducePresentationSession(live,{type:'select',changes:{mode:'boost',boostItemId:'activity'}});
  const shown = showEditInPresent(edit, boost);
  assert.equal(resolvePresentationTarget(data, shown).contentId,'15');
  assert.equal(shown.sessionId,live.sessionId);
  assert.ok(shown.targetRevision > boost.targetRevision);
});
test('Edit browsing never invokes live audio stops; live navigation still does', () => {
  const calls: string[] = [];
  const audio = {stopSlideAudio:()=>calls.push('slide'),stopSectionMusic:()=>calls.push('section')};
  runNavigationAudio('edit',true,audio);
  assert.deepEqual(calls,[]);
  runNavigationAudio('teach',false,audio);
  runNavigationAudio('teach',true,audio);
  assert.deepEqual(calls,['slide','slide','section']);
});
test('authored edits target Edit, survive history/serialization, and serialize no cursor', () => {
  const edit = selectEdit(createEditSelection(data),{storySlideId:'15',sectionId:'two'});
  const view = editSessionView(edit,live); const target = resolvePresentationTarget(data,view);
  const history = new ProjectHistory<ProjectData>(); history.reset(data);
  const changed = applyPresentationDrawing(data,view,presentationToken(view,target),[{id:'ink',color:'#000',size:2,opacity:1,rainbow:false,points:[]}]);
  history.record(changed);
  const reopened = JSON.parse(JSON.stringify(changed)) as ProjectData;
  assert.equal(reopened.slides[0].markerStrokes,undefined);
  assert.equal(reopened.slides[1].markerStrokes?.[0].id,'ink');
  assert.equal('editSelection' in reopened,false);
  assert.equal(history.undo(),data); assert.equal(history.redo(),changed);
});
test('mode switches resolve independent valid cursors without copying selection', () => {
  const edit = selectEdit(createEditSelection(data),{storySlideId:'15',sectionId:'two'});
  for (const mode of ['edit','teach','edit']) {
    assert.equal(resolvePresentationTarget(data,mode==='edit'?editSessionView(edit,live):live).contentId,mode==='edit'?'15':'12');
  }
});
