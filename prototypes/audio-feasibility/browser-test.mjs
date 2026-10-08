// Optional focused real-Web-Audio test. Uses synthetic microphone, no physical recording.
import { createRequire } from 'node:module';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { serve } from './serve.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = await serve();
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--mute-audio'] });
const artifacts = await mkdtemp(join(tmpdir(), 'story-audio-feasibility-'));
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1100 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByRole('button', { name: 'Start route', exact: true }).click();
  await page.waitForFunction(() => JSON.parse(document.querySelector('#diagnostics').textContent).context === 'running');
  await page.getByRole('button', { name: 'Start 440 Hz tone' }).click();
  await page.getByRole('button', { name: 'Start microphone', exact: true }).click();
  // One generated WAV fixture exercises real decoding for three independent media sources.
  const length = 48000 * 3; const wav = Buffer.alloc(44 + length * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(48000, 24); wav.writeUInt32LE(96000, 28); wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(length * 2, 40);
  for (let i = 0; i < length; i++) wav.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 220 / 48000) * 4000), 44 + i * 2);
  for (const name of ['dialogue', 'music', 'sfx']) {
    await page.getByLabel(`${name[0].toUpperCase() + name.slice(1)} audio file`).setInputFiles({ name: 'test.wav', mimeType: 'audio/wav', buffer: wav });
    await page.getByRole('button', { name: `Play ${name}`, exact: true }).click();
  }
  await page.waitForFunction(() => {
    const d = JSON.parse(document.querySelector('#diagnostics').textContent);
    return d.sources.length === 5 && d.mixRms > 0.001;
  });
  const running = JSON.parse(await page.locator('#diagnostics').textContent());
  await page.screenshot({ path: join(artifacts, 'desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Stop all / release microphone' }).click();
  await page.waitForFunction(() => JSON.parse(document.querySelector('#diagnostics').textContent).context === 'closed');
  const stopped = JSON.parse(await page.locator('#diagnostics').textContent());
  assert.deepEqual(stopped.sources, []); assert.equal(stopped.mixRms, 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(artifacts, 'narrow.png'), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: 'PASS: browser producer only; synthetic mic; output muted; no virtual capture proven', running, stopped, artifacts }, null, 2));
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
