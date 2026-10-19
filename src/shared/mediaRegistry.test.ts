import test from 'node:test';
import assert from 'node:assert/strict';
import { createMediaRegistry } from './content/mediaRegistry';
import { createLesson, createScene } from './lesson/commands';
import type { AssetItem } from './types';
const asset = (id: string, relativePath = `assets/${id}.png`): AssetItem => ({ id, relativePath, filename: 'same.png', originalName: 'same.png', mediaType: 'image', sizeBytes: 1, importedAt: '' });
test('registry snapshots records, preserves unplaced cards and counts authored definitions once', () => {
  const data = createLesson('proof'); const scene = createScene('story', 'image'); scene.id = 'story'; data.scenes.story = scene;
  data.assets = [asset('image'), asset('other')]; data.sequences.story = [{id:'one',sceneId:'story',section:''},{id:'two',sceneId:'story',section:''}];
  data.cards.recall = {id:'recall', label:'Recall', tags:[], style:{preset:'classroom'}, faces:[{id:'face',label:'Face',layout:'image-only',imageAssetId:'image'}]};
  const before = JSON.stringify(data), registry = createMediaRegistry({format:'scene',data});
  assert.deepEqual(registry.usages('image').map(use => use.field).sort(), ['/cards/recall/faces/0/imageAssetId','/scenes/story/background/assetId']);
  assert.equal(registry.list().length, 2); assert.equal(registry.get('image'), registry.list()[0]); assert.equal(JSON.stringify(data), before);
  assert.ok(Object.isFrozen(registry.list())); assert.ok(Object.isFrozen(registry.get('image')));
  data.assets[0].filename = 'changed'; assert.equal(registry.get('image')?.filename, 'same.png');
});
test('duplicates, path aliases and broken bin ancestry never pick an arbitrary record', () => {
  const data = createLesson('proof'); data.assets = [asset('dup'), asset('dup'), asset('a','assets/shared.png'),asset('b','assets/shared.png')];
  data.mediaBins = [{id:'a',name:'A',parentId:'b'},{id:'b',name:'B',parentId:'a'},{id:'c',name:'C',parentId:'missing'}];
  const registry = createMediaRegistry({format:'scene',data});
  assert.equal(registry.get('dup'), undefined); assert.equal(registry.resolvePath('media://assets/shared.png').ok, false);
  for (const kind of ['duplicate-id','ambiguous-path','bin-cycle','missing-bin']) assert.ok(registry.diagnostics().some(issue => issue.kind === kind), kind);
});
test('path resolution is exact and reports type failures without conflating names', () => {
  const data = createLesson('proof'); data.assets=[asset('image','assets/a.png'),asset('other','assets/a.png.bak')];
  const registry=createMediaRegistry({format:'scene',data});
  assert.deepEqual(registry.resolvePath('media:///assets/a.png?render=2'),{ok:true,assetId:'image',mediaType:'image',url:'media://assets/a.png'});
  assert.deepEqual(registry.resolvePath('assets/a.png','audio'),{ok:false,code:'wrong-type',assetId:'image'});
  assert.deepEqual(registry.resolvePath('a.png'),{ok:false,code:'unregistered'});
});
