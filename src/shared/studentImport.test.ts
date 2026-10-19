import test from 'node:test';
import assert from 'node:assert/strict';
import { previewLegacyProfiles } from './studentImport';
test('legacy preview preserves distinct source IDs with identical names and strips private extras', () => {
  assert.deepEqual(previewLegacyProfiles(JSON.stringify({studentRoster:[{id:'a',name:'Same',history:'private'},{id:'b',name:'Same'}]})),[{id:'a',name:'Same'},{id:'b',name:'Same'}]);
});
test('legacy preview rejects ambiguous IDs, missing identity and oversized input', () => {
  for (const value of ['[{"id":"a","name":"A"},{"id":"a","name":"B"}]','[{"name":"A"}]','{}','x'.repeat(1_000_001)]) assert.throws(() => previewLegacyProfiles(value));
});
