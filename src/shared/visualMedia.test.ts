import test from 'node:test';
import assert from 'node:assert/strict';
import { visualMediaUrl, visualMediaBackground } from './visualMedia';

test('same media filename changes render identity across projects and reopen without changing authored reference', () => {
  const authored = 'media://assets/lesson%20image.png';
  const first = visualMediaUrl(authored, 'project-a:1');
  assert.notEqual(first, visualMediaUrl(authored, 'project-b:1'));
  assert.notEqual(first, visualMediaUrl(authored, 'project-a:2'));
  assert.equal(visualMediaUrl(first, 'project-a:1'), first);
  assert.equal(authored, 'media://assets/lesson%20image.png');
  assert.equal(first.split('?')[0], authored);
});

test('visual namespace preserves other query values and only changes local lesson media', () => {
  assert.equal(visualMediaUrl('/assets/run-hash.gif', 'scope'), '/assets/run-hash.gif');
  assert.equal(visualMediaUrl('media://a.png?fit=contain#part', 'new'), 'media://a.png?fit=contain&sceneScope=new#part');
  assert.equal(visualMediaUrl('media://a.png?sceneScope=old&fit=contain', 'new'), 'media://a.png?sceneScope=new&fit=contain');
});

test('CSS background image gets the same namespace while colors and gradients remain intact', () => {
  assert.equal(visualMediaBackground("url('media://a.png')", 'new'), 'url("media://a.png?sceneScope=new")');
  assert.equal(visualMediaBackground('linear-gradient(red, blue)', 'new'), 'linear-gradient(red, blue)');
});
