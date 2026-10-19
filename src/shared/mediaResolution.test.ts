import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalMediaPath, compatibilityMediaUrl } from './content/mediaResolution';
import { resolveAuthoredMediaUrl, resolveAuthoredBackground } from './content/mediaRenderResolution';
test('canonical media aliases decode once and retain exact path identity', () => {
  for (const value of ['media://assets/a%20日.png?render=1', 'media:///assets/a%20日.png', 'assets\\a 日.png']) assert.equal(canonicalMediaPath(value), 'assets/a 日.png');
  assert.equal(compatibilityMediaUrl('assets/a 日.png'), 'media://assets/a%20%E6%97%A5.png');
  for (const value of ['../x', '/absolute', 'C:\\x', 'assets/%2e%2e/x', 'assets/%252e%252e/x', 'https://x/a', 'assets/%2Fx', 'assets//x']) assert.equal(canonicalMediaPath(value), undefined, value);
});
test('render-only resolution scopes legacy URLs and CSS without rewriting authored values', () => {
  const authored = {url:'media://assets/a.png',background:'url("media:///assets/a.png")'};
  const before=JSON.stringify(authored);
  const resolve=(value:string)=>canonicalMediaPath(value)==='assets/a.png'?'media://scoped/lease/grant':undefined;
  assert.equal(resolveAuthoredMediaUrl(authored.url,resolve),'media://scoped/lease/grant');
  assert.equal(resolveAuthoredMediaUrl('assets/missing.png',resolve),'');
  assert.equal(resolveAuthoredBackground(authored.background,resolve),'url("media://scoped/lease/grant")');
  assert.equal(resolveAuthoredBackground('#111',resolve),'#111');
  assert.equal(resolveAuthoredBackground('url("assets/missing.png")',resolve),'none');
  assert.equal(JSON.stringify(authored),before);
});
