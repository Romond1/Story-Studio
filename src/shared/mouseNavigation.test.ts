import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blocksMouseNavigation } from './mouseNavigation';

test('active lesson blocks only mouse/browser navigation commands', () => {
  for (const input of [3, 4, 'BrowserBack', 'BrowserForward', 'browser-backward', 'browser-forward']) {
    assert.equal(blocksMouseNavigation(true, input), true);
    assert.equal(blocksMouseNavigation(false, input), false);
  }
  for (const input of [0, 1, 2, 'ArrowLeft', 'ArrowRight', 'Backspace', 'Delete', 'z', 'media-play-pause']) {
    assert.equal(blocksMouseNavigation(true, input), false);
  }
});
