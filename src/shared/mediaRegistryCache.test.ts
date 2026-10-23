import test from 'node:test';
import assert from 'node:assert/strict';
import { MediaRegistryCache } from './mediaRegistryCache';
import type { MediaRegistryApi, MediaManifestRequest } from './mediaRegistryProtocol';
const asset = { id: 'one', filename: 'one.png', originalName: 'one.png', relativePath: 'assets/one.png', importedAt: '', sizeBytes: 1, mediaType: 'image' as const };
test('access cache publishes checked batches early, prioritizes current scene and keeps prior snapshots immutable',async()=>{
  let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});const calls:string[]=[],views:any[]=[];
  const assets=Array.from({length:65},(_,i)=>({...asset,id:`asset${i}`,relativePath:`assets/${i}.png`}));
  const cache=new MediaRegistryCache({getLease:async()=>({id:'lease'}),register:async()=>({ok:true,diagnostics:[]}),resolve:async request=>{calls.push(request.assetId!);if(calls.length>32)await gate;return {ok:true,url:`media://scoped/lease/${request.assetId}`};}});
  const pending=cache.refresh('folder',assets,[],{priorityIds:['asset64'],onProgress:view=>views.push(view)});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(views.length,1);assert.equal(views[0].byId.size,32);assert.equal(calls[0],'asset64');assert.ok(views[0].byId.has('asset64'));
  release();const result=await pending;assert.equal(result?.byId.size,65);assert.equal(views[0].byId.size,32);
});
test('cache returns only current grants and ignores resolution finishing after project switch', async () => {
  let finish!: () => void;
  const delayed = new Promise<void>(resolve => { finish = resolve; });
  const api: MediaRegistryApi = {
    getLease: async folder => ({ id: folder }), register: async () => ({ ok: true, diagnostics: [] }),
    resolve: async request => { if (request.leaseId === 'old') await delayed; return { ok: true, url: `media://scoped/${request.leaseId}/grant` }; },
  };
  const cache = new MediaRegistryCache(api);
  const progress:unknown[]=[];
  const old = cache.refresh('old', [asset], [],{onProgress:view=>progress.push(view)});
  await new Promise(resolve => setImmediate(resolve));
  const current = await cache.refresh('new', [asset], []);
  finish();
  assert.equal(await old, null);
  assert.equal(progress.length,0);
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
