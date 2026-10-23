import { restoreEditorSelection } from './editorSelection';
import { isImageAppearance } from './imageAppearance';
import { projectScene, parseScenePlan } from './projection';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLesson, insertScene, addText, addCard, reorderEntry, duplicateEntry } from './commands';
import { LESSON_LIMITS } from './limits';
import { addSection, moveEntryToSection, insertBreak, renameSection, timelineGroups, removeTimelineGroup, addReviewMedia, insertSectionMedia, moveSection } from './sections';
import { copyCardSnapshot, pasteCard, moveCardToScene } from './cardClipboard';
import { parseLessonProject } from './validation';

test('legacy labels migrate to stable sequence sections and roundtrip', () => {
  const a = insertScene(createLesson(), 'story'); a.project.sequences.story[0].section = 'Warmup';
  const p = parseLessonProject(a.project);
  assert.equal(p.sections?.[0].name, 'Warmup');
  assert.equal(p.sequences.story[0].sectionId, p.sections?.[0].id);
  assert.deepEqual(parseLessonProject(p), p);
});
test('migration preserves disjoint group order and scene audio without adding section audio', () => {
  let p = createLesson();
  for (const label of ['A', '', 'A']) { const added = insertScene(p, 'story'); p = added.project; p.sequences.story[p.sequences.story.length - 1].section = label; }
  const order = p.sequences.story.map(e => e.id), scenes = JSON.stringify(p.scenes);
  const migrated = parseLessonProject(p);
  assert.deepEqual(migrated.sequences.story.map(e => e.id), order);
  assert.equal(JSON.stringify(migrated.scenes), scenes);
  assert.equal(migrated.sections!.length, 2);
  assert.notEqual(migrated.sequences.story[0].sectionId, migrated.sequences.story[2].sectionId);
});
test('empty sections, membership ordering, rename and editable Breaks', () => {
  const a = insertScene(createLesson(), 'story'), b = insertScene(a.project, 'story');
  const section = addSection(b.project, 'story', 'Practice');
  let p = moveEntryToSection(section.project, 'story', b.entryId, section.sectionId);
  p = moveEntryToSection(p, 'story', a.entryId, section.sectionId, b.entryId);
  assert.deepEqual(p.sequences.story.map(e => e.id), [a.entryId, b.entryId]);
  p = renameSection(p, section.sectionId, 'Together');
  const pause = insertBreak(p, 'story', undefined, section.sectionId);
  p = addText(pause.project, pause.project.sequences.story.find(e => e.id === pause.entryId)!.sceneId, 'bubble').project;
  assert.equal(p.sequences.story.find(e => e.id === pause.entryId)!.kind, 'break');
  p = moveEntryToSection(p, 'story', a.entryId, undefined);
  assert.equal(p.sequences.story.find(e => e.id === a.entryId)!.sectionId, undefined);
  assert.equal(parseLessonProject(p).sections?.[0].name, 'Together');
});
test('cross phase paste snapshots content and placement independently; move only deletes after success', () => {
  const a = insertScene(createLesson(), 'story'), b = insertScene(a.project, 'activation');
  const source = a.project.sequences.story[0].sceneId, destination = b.project.sequences.activation[0].sceneId;
  const added = addCard(b.project, source), snapshot = copyCardSnapshot(added.project, source, added.objectId)!;
  const result = pasteCard(added.project, { sequence: 'activation', entryId: b.entryId }, snapshot);
  const placed = result.project.scenes[destination].objects[0];
  assert.equal(result.project.scenes[source].objects.length, 1);
  assert.ok(placed.kind === 'card' && placed.cardId !== snapshot.card.id);
  if (placed.kind === 'card') {
    result.project.cards[placed.cardId].faces[0].text = 'Edited destination';
    assert.notEqual(result.project.cards[snapshot.card.id].faces[0].text, 'Edited destination');
  }
  assert.equal(result.selection.entryId, b.entryId);
  assert.deepEqual(placed.box, snapshot.object.box);
  assert.throws(() => moveCardToScene(added.project, source, added.objectId, { sequence: 'activation', entryId: 'missing' }));
  assert.equal(added.project.scenes[source].objects.length, 1);
  const moved = moveCardToScene(added.project, source, added.objectId, { sequence: 'activation', entryId: b.entryId });
  assert.equal(moved.project.scenes[source].objects.length, 0);
  assert.equal(moved.project.scenes[destination].objects.length, 1);
});

test('moving later at a section boundary preserves section membership', () => {
  const a = insertScene(createLesson(), 'story'), b = insertScene(a.project, 'story'), c = insertScene(b.project, 'story');
  const group = addSection(c.project, 'story', 'A'), other = addSection(group.project, 'story', 'B');
  let p = moveEntryToSection(other.project, 'story', a.entryId, group.sectionId);
  p = moveEntryToSection(p, 'story', b.entryId, group.sectionId);
  p = moveEntryToSection(p, 'story', c.entryId, other.sectionId);
  p = reorderEntry(p, 'story', a.entryId, c.entryId);
  assert.deepEqual(p.sequences.story.map(e => e.id), [b.entryId, a.entryId, c.entryId]);
  assert.equal(p.sequences.story[1].sectionId, group.sectionId);
});

test('Break template has editable content and duplication preserves entry metadata', () => {
  const group = addSection(createLesson(), 'story', 'Practice');
  const pause = insertBreak(group.project, 'story', undefined, group.sectionId);
  const original = pause.project.sequences.story[0];
  assert.ok(pause.project.scenes[original.sceneId].objects.some(o => o.kind === 'text' && o.text.includes('Review')));
  const copied = duplicateEntry(pause.project, 'story', pause.entryId, 'story', false);
  const copy = copied.project.sequences.story.find(e => e.id === copied.entryId)!;
  assert.equal(copy.kind, 'break');
  assert.equal(copy.sectionId, undefined);
  assert.notEqual(copy.sceneId, original.sceneId);
  const linked = duplicateEntry(copied.project, 'story', pause.entryId, 'activation', true);
  assert.equal(linked.project.sequences.activation[0].kind, 'break');
  assert.equal(linked.project.sequences.activation[0].sectionId, undefined);
  assert.equal(linked.project.sequences.activation[0].sceneId, original.sceneId);
});

test('maximum legacy labels roundtrip, section creation and validation share the same ceiling', () => {
  const base = insertScene(createLesson(), 'story'), sceneId = base.project.sequences.story[0].sceneId;
  const p = { ...base.project, sequences: {
    story: Array.from({ length: LESSON_LIMITS.entriesPerSequence }, (_, i) => ({ id: `story-${i}`, sceneId, section: `Section ${i}` })),
    activation: Array.from({ length: LESSON_LIMITS.entriesPerSequence }, (_, i) => ({ id: `activation-${i}`, sceneId, section: `Section ${i}` })),
  } };
  const migrated = parseLessonProject(p);
  assert.equal(migrated.sections!.length, 2 * LESSON_LIMITS.entriesPerSequence);
  assert.deepEqual(parseLessonProject(migrated), migrated);
  assert.throws(() => addSection(migrated, 'story'), /section/i);
  assert.throws(() => parseLessonProject({ ...migrated, sections: [...migrated.sections!, { id: 'extra', name: 'Extra', sequence: 'story' }] }), /sections/i);
});



test('breaks are standalone top-level groups, including legacy nested entries', () => {
  const group = addSection(createLesson(), 'story', 'A');
  const media = insertScene(group.project, 'story');
  const p = moveEntryToSection(media.project, 'story', media.entryId, group.sectionId);
  const pause = insertBreak(p, 'story', undefined, group.sectionId);
  const entry = pause.project.sequences.story.find(e => e.id === pause.entryId)!;
  assert.equal(entry.sectionId, undefined);
  assert.equal(entry.section, '');
  const legacy = { ...pause.project, sequences: { ...pause.project.sequences, story: pause.project.sequences.story.map(e => e.id === entry.id ? {...e,sectionId:group.sectionId,section:'A'} : e) } };
  const loaded = parseLessonProject(legacy);
  assert.equal(loaded.sequences.story.find(e=>e.id===entry.id)!.sectionId, undefined);
  assert.deepEqual(loaded.sequences.story.map(e=>e.id),legacy.sequences.story.map(e=>e.id));
  assert.deepEqual(loaded.scenes, legacy.scenes);
});


test('breaks separate sections, cannot join a section on move, and survive empty section placement', () => {
  const a = addSection(createLesson(), 'story', 'A'), b = addSection(a.project, 'story', 'B');
  const scene = insertSectionMedia(b.project, 'story', [], b.sectionId);
  const pause = insertBreak(scene.project, 'story', undefined, a.sectionId);
  const groups = timelineGroups(pause.project, 'story');
  assert.deepEqual(groups.map(g=>g.kind), ['section','break','section','ungrouped']);
  assert.equal(groups[0].sectionId,a.sectionId);
  const loaded = parseLessonProject(pause.project);
  assert.deepEqual(timelineGroups(loaded,'story').map(g=>g.key),groups.map(g=>g.key));
  const moved = moveEntryToSection(loaded,'story',pause.entryId,b.sectionId,scene.entryIds[0]);
  assert.equal(moved.sequences.story.find(e=>e.id===pause.entryId)!.sectionId,undefined);
  assert.equal(moved.sequences.story[0].id,pause.entryId);
});

test('section removal can keep scenes or remove occurrences, without deleting breaks or linked content', () => {
  const group = addSection(createLesson(),'story','A');
  const scene = insertSectionMedia(group.project,'story',[],group.sectionId);
  const pause = insertBreak(scene.project,'story',undefined,group.sectionId);
  const kept = removeTimelineGroup(pause.project,'story',group.sectionId,true);
  assert.equal(kept.sections?.length,0);
  assert.equal(kept.sequences.story.length,2);
  assert.ok(kept.sequences.story.every(e=>!e.sectionId));
  const removed = removeTimelineGroup(pause.project,'story',group.sectionId);
  assert.deepEqual(removed.sequences.story.map(e=>e.id),[pause.entryId]);
  assert.equal(removed.scenes,pause.project.scenes);
  assert.equal(removed.assets,pause.project.assets);
  assert.deepEqual(removeTimelineGroup(kept,'story').sequences.story.map(e=>e.id),[pause.entryId]);
});

test('review board media, captions and video plans validate and preserve stable references', () => {
  const pause = insertBreak(createLesson(),'story'), sceneId = pause.project.sequences.story[0].sceneId;
  const image = {id:'image',mediaType:'image' as const,filename:'image.png',originalName:'Image',relativePath:'assets/image.png',sizeBytes:1,importedAt:''};
  const video = {...image,id:'video',mediaType:'video' as const,filename:'video.webm',relativePath:'assets/video.webm'};
  let scene = addReviewMedia(pause.project.scenes[sceneId],image,'Remember this door');
  scene = addReviewMedia(scene,video,'What happened next?');
  const project = {...pause.project,assets:[image,video],scenes:{...pause.project.scenes,[sceneId]:scene}};
  const loaded = parseLessonProject(project);
  assert.deepEqual(loaded.scenes[sceneId],scene);
  assert.equal(scene.objects.filter(o=>o.kind==='video').length,1);
  const plan = projectScene(loaded,sceneId,undefined,id=>'media://assets/'+id);
  assert.deepEqual(parseScenePlan(plan),plan);
  assert.equal(plan.objects.filter(o=>o.kind==='video').length,1);
  const media = scene.objects.find(o=>o.kind==='image')!, caption = scene.objects.find(o=>o.kind==='text'&&o.text==='Remember this door')!;
  assert.ok(caption.box.y >= media.box.y+media.box.height);
  assert.throws(()=>addReviewMedia(scene,{...image,mediaType:'audio'},''));
  assert.equal(parseScenePlan({...plan,objects:[{id:'bad',kind:'video',box:media.box,src:'https://example.invalid/video'}]}),null);
});


test('moving empty sections recomputes break anchors in both directions', () => {
  const a = addSection(createLesson(),'story','A');
  const pause = insertBreak(a.project,'story',undefined,a.sectionId);
  const z = addSection(pause.project,'story','Z');
  const moved = moveSection(z.project,'story',a.sectionId);
  assert.deepEqual(timelineGroups(moved,'story').filter(g=>g.kind!=='ungrouped').map(g=>g.sectionId??'break'), ['break',z.sectionId,a.sectionId]);
  const earlier = moveSection(z.project,'story',z.sectionId,a.sectionId);
  assert.deepEqual(timelineGroups(earlier,'story').filter(g=>g.kind!=='ungrouped').map(g=>g.sectionId??'break'), [z.sectionId,a.sectionId,'break']);
});


test('dragging a break past the final section respects its trailing boundary', () => {
  const a = addSection(createLesson(),'story','A'), z = addSection(a.project,'story','Z');
  const first = insertSectionMedia(z.project,'story',[],a.sectionId);
  const last = insertSectionMedia(first.project,'story',[],z.sectionId);
  const b1 = insertBreak(last.project,'story',undefined,a.sectionId);
  const b2 = insertBreak(b1.project,'story',undefined,a.sectionId);
  const moved = moveEntryToSection(b2.project,'story',b1.entryId,z.sectionId);
  assert.equal(moved.sequences.story[moved.sequences.story.length-1]!.id,b1.entryId);
  assert.equal(moved.sequences.story[moved.sequences.story.length-1]!.sectionId,undefined);
});


test('break image effects and audio shortcuts validate, project and duplicate independently', () => {
  const pause = insertBreak(createLesson(),'story'), sceneId = pause.project.sequences.story[0].sceneId;
  const image = {id:'image',mediaType:'image' as const,filename:'image.png',originalName:'Image',relativePath:'assets/image.png',sizeBytes:1,importedAt:''};
  const sound = {...image,id:'audio',mediaType:'audio' as const,filename:'audio.wav',relativePath:'assets/audio.wav'};
  const appearance = {scale:1.2,blur:8,feather:25,opacity:.6,background:'#112233',border:1};
  const scene = addReviewMedia(pause.project.scenes[sceneId],image,'Review');
  scene.background = {color:'#182331',assetId:'image',imageAppearance:appearance};
  const picture = scene.objects.find(o=>o.kind==='image')!;
  assert.ok(picture.kind==='image' && picture.appearance?.border===1);
  if(picture.kind==='image') picture.appearance={...appearance};
  scene.audio=[{id:'track',assetId:'audio',volume:.8,loop:false,autoplay:false,shortcut:'2'}];
  const p={...pause.project,assets:[image,sound],scenes:{...pause.project.scenes,[sceneId]:scene}};
  assert.deepEqual(parseLessonProject(p),JSON.parse(JSON.stringify(p)));
  const plan=projectScene(p,sceneId,undefined,id=>'media://assets/'+id);
  assert.deepEqual(parseScenePlan(plan),plan);
  assert.deepEqual(plan.background.imageAppearance,appearance);
  const copy=duplicateEntry(p,'story',pause.entryId,'story');
  assert.equal(copy.project.sequences.story[1].id,copy.entryId);
  const cloned=copy.project.scenes[copy.project.sequences.story.find(e=>e.id===copy.entryId)!.sceneId];
  cloned.audio[0].volume=.2;
  const copiedImage=cloned.objects.find(o=>o.kind==='image')!;if(copiedImage.kind==='image')copiedImage.appearance!.blur=20;
  assert.equal(scene.audio[0].volume,.8);assert.ok(picture.kind==='image'&&picture.appearance!.blur===8);
  assert.equal(isImageAppearance({blur:NaN}),false);assert.equal(isImageAppearance({scale:30}),false);assert.equal(isImageAppearance({background:'url(https://example.invalid)'}),false);
  assert.throws(()=>parseLessonProject({...p,scenes:{[sceneId]:{...scene,background:{...scene.background,imageAppearance:{blur:-1}}}}}));
  assert.equal(parseScenePlan({...plan,background:{...plan.background,imageAppearance:{opacity:5}}}),null);
});


test('undoing a Discovery link restores a visible editor location without losing Adventure', () => {
  const original=insertScene(createLesson(),'story');
  const linked=duplicateEntry(original.project,'story',original.entryId,'activation',true);
  assert.equal(original.project.sequences.story.length,1);
  assert.deepEqual(linked.project.sequences.story,original.project.sequences.story);
  const restored=restoreEditorSelection(original.project,{sequence:'activation',entryId:linked.entryId,objectId:null});
  assert.deepEqual(restored,{sequence:'story',entryId:original.entryId,objectId:null});
});
