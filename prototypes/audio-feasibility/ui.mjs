import { AudioRoute } from './route.mjs';
const route = new AudioRoute();
const $ = id => document.getElementById(id);
const message = text => { $('message').textContent = text; };
let starting = false;
const run = action => async () => { try { await action(); } catch (e) { message(`${e.name}: ${e.message}`); } };
async function devices(permission = false) {
  if (permission) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  for (const [id, kind] of [['output', 'audiooutput'], ['mic', 'audioinput']]) {
    const select = $(id); const previous = select.value;
    select.replaceChildren(new Option(id === 'output' ? 'System default (not virtual-device proof)' : 'System default', ''));
    for (const device of devices.filter(d => d.kind === kind)) select.add(new Option(device.label || `${kind} (${device.deviceId.slice(0, 8) || 'permission needed'})`, device.deviceId));
    if ([...select.options].some(option => option.value === previous)) select.value = previous;
  }
}
$('devices').onclick = run(() => devices(true));
$('start').onclick = run(async () => {
  starting = true; update();
  try { await route.start($('output').value); message(route.status); } finally { starting = false; update(); }
});
$('stop').onclick = run(async () => { await route.stop(); message('Stopped. Verify silence on the paired capture device.'); update(); });
$('startMic').onclick = run(async () => { await route.microphone($('mic').value); message('Microphone request completed. See active sources below.'); });
$('stopMic').onclick = () => route.stopSource('mic');
$('tone').onclick = run(() => route.tone());
$('stopTone').onclick = () => route.stopSource('tone');
for (const name of ['dialogue', 'music', 'sfx']) {
  const container = document.createElement('div'); container.className = 'row clip';
  const label = document.createElement('label'); label.textContent = `${name[0].toUpperCase() + name.slice(1)} audio file`;
  const input = document.createElement('input'); input.type = 'file'; input.accept = 'audio/*'; label.append(input);
  const play = document.createElement('button'); play.textContent = `Play ${name}`; play.dataset.source = '';
  play.onclick = run(async () => {
    const file = input.files[0]; if (!file) throw Error(`Choose a ${name} audio file first.`);
    if (file.size > 100 * 1024 * 1024) throw Error('Use a test clip smaller than 100 MB.');
    await route.clip(name, await file.arrayBuffer(), name === 'music');
  });
  const stop = document.createElement('button'); stop.textContent = `Stop ${name}`; stop.onclick = () => route.stopSource(name);
  container.append(label, play, stop); $('clips').append(container);
}
function update() {
  const d = route.diagnostics(); $('diagnostics').textContent = JSON.stringify(d, null, 2);
  $('start').disabled = starting || Boolean(route.session); $('output').disabled = starting || Boolean(route.session);
  for (const button of document.querySelectorAll('[data-source]')) button.disabled = starting || d.context !== 'running';
}
navigator.mediaDevices?.addEventListener('devicechange', run(() => devices()));
window.addEventListener('pagehide', () => { void route.stop(); });
setInterval(update, 150); update();
if (navigator.mediaDevices) void run(() => devices())();
else message('Media devices unavailable. Open this harness on http://localhost in desktop Chrome or Edge.');
