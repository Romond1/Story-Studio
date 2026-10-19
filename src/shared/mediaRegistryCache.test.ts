import test from 'node:test';
import assert from 'node:assert/strict';
import { MediaRegistryCache } from './mediaRegistryCache';
import type { MediaRegistryApi, MediaManifestRequest } from './mediaRegistryProtocol';
const asset = { id: 'one', filename: 'one.png', originalName: 'one.png', relativePath: 'assets/one.png', importedAt: '', sizeBytes: 1, mediaType: 'image' as const };
test('cache returns only current grants and ignores resolution finishing after project switch', async () => {
  let finish!: () => void;
  const delayed = new Promise<void>(resolve => { finish = resolve; });
  const api: MediaRegistryApi = {
    getLease: async folder => ({ id: folder }), register: async () => ({ ok: true, diagnostics: [] }),
    resolve: async request => { if (request.leaseId === 'old') await delayed; return { ok: true, url: `media://scoped/${request.leaseId}/grant` }; },
  };
  const cache = new MediaRegistryCache(api);
  const old = cache.refresh('old', [asset], []);
  await new Promise(resolve => setImmediate(resolve));
  const current = await cache.refresh('new', [asset], []);
  finish();
  assert.equal(await old, null);
  assert.equal(current?.byId.get('one'), 'media://scoped/new/grant');
  assert.equal(current?.byPath.get('assets/one.png'), 'media://scoped/new/grant');
});
test('cache revisions increase and resolution failures are explicit', async () => {
  const requests: MediaManifestRequest[] = [];
  const cache = new MediaRegistryCache({ getLease: async () => ({ id: 'lease' }), register: async request => { requests.push(request); return { ok: true, diagnostics: [] }; }, resolve: async () => ({ ok: false, code: 'missing' }) });
  assert.equal((await cache.refresh('folder', [asset], []))?.diagnostics[0].code, 'missing');
  const result = await cache.refresh('folder', [asset], []);
  assert.ok(requests[1].revision > requests[0].revision);
  assert.equal(result?.byId.size, 0);
});

test('cache resumes revisions after a renderer reload', async () => {
  let registered = 0;
  const cache = new MediaRegistryCache({ getLease: async () => ({ id: 'lease', revision: 9000 }), register: async request => { registered = request.revision; return { ok: true, diagnostics: [] }; }, resolve: async () => ({ ok: false, code: 'missing' }) });
  await cache.refresh('folder', [], []);
  assert.ok(registered > 9000);
});
