import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeLessonMediaImport } from './mediaImport';
import type { AssetItem, ImportResult, MediaBin } from '../types';

const asset = (id: string, binId?: string) => ({ id, binId } as AssetItem);
const project: { assets: AssetItem[]; mediaBins: MediaBin[] } = { assets: [asset('existing')], mediaBins: [{ id: 'active', name: 'Active' }] };
const result = (assets: AssetItem[], bins: ImportResult['importedBins'] = []): ImportResult => ({ importedAssets: assets, importedBins: bins, createdSlides: [] });

test('file and drop imports go directly into the active bin without moving existing assets', () => {
  const next = mergeLessonMediaImport(project, result([asset('new')]), 'active');
  assert.equal(next.assets[1].binId, 'active');
  assert.equal(next.assets[0].binId, undefined);
  assert.equal(project.assets.length, 1);
});
test('folder imports attach roots to the active bin and preserve nested ownership', () => {
  const next = mergeLessonMediaImport(project, result([asset('loose'), asset('image', 'child')], [{ id: 'folder', name: 'Folder' }, { id: 'child', name: 'Child', parentId: 'folder' }]), 'active');
  assert.equal(next.mediaBins[1].parentId, 'active');
  assert.equal(next.mediaBins[2].parentId, 'folder');
  assert.equal(next.assets[1].binId, 'active');
  assert.equal(next.assets[2].binId, 'child');
});
test('root and deleted destinations use the general pool', () => {
  for (const destination of [undefined, 'deleted']) {
    const next = mergeLessonMediaImport(project, result([asset('new')], [{ id: 'folder', name: 'Folder' }]), destination);
    assert.equal(next.assets[1].binId, undefined);
    assert.equal(next.mediaBins[1].parentId, undefined);
  }
});
