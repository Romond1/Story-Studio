import { build } from 'vite';
import { createHash } from 'node:crypto';
import { readFile, mkdir, copyFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const directory = new URL('../public/face-tracking/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8'));
const model = await readFile(new URL('face_landmarker.task', directory));
if (createHash('sha256').update(model).digest('hex') !== manifest.model.sha256) throw new Error('Face tracking model hash mismatch. Restore the pinned model.');
const source = new URL('../node_modules/@mediapipe/tasks-vision/', import.meta.url);
const packageJson = JSON.parse(await readFile(new URL('package.json', source), 'utf8'));
if (packageJson.version !== manifest.runtimeVersion) throw new Error('Face tracking runtime version mismatch. Run npm ci.');
await mkdir(new URL('wasm/', directory), { recursive: true });
for (const name of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm']) {
  await copyFile(new URL(`wasm/${name}`, source), new URL(`wasm/${name}`, directory));
}
// Prebundle a classic worker for BOTH dev and packaged file:// builds. MediaPipe
// 0.10.32 uses importScripts for its WASM loader, which module workers prohibit.
const result = await build({ configFile: false, logLevel: 'error', build: {
  write: false, minify: true, target: 'es2021',
  lib: { entry: fileURLToPath(new URL('../src/renderer/camera/tracking/face.worker.ts', import.meta.url)), name: 'StoryFaceWorker', formats: ['iife'] },
  rollupOptions: { output: { inlineDynamicImports: true } },
} });
const output = Array.isArray(result) ? result[0].output : result.output;
const chunk = output.find(file => file.type === 'chunk');
if (!chunk) throw new Error('Face worker bundle was not produced.');
await writeFile(new URL('face.worker.js', directory), chunk.code);
console.log(`Prepared offline face tracking: tasks-vision ${packageJson.version}, pinned model and classic worker.`);

const removalDirectory = new URL('../public/person-removal/', import.meta.url);
const removalManifest = JSON.parse(await readFile(new URL('manifest.json', removalDirectory), 'utf8'));
const removalModel = await readFile(new URL('selfie_segmenter_landscape.tflite', removalDirectory));
if (createHash('sha256').update(removalModel).digest('hex') !== removalManifest.model.sha256 || packageJson.version !== removalManifest.runtimeVersion) throw new Error('Person removal model/runtime mismatch.');
const removalResult = await build({configFile:false,logLevel:'error',build:{write:false,minify:true,target:'es2021',lib:{entry:fileURLToPath(new URL('../src/renderer/camera/removal/person.worker.ts',import.meta.url)),name:'StoryPersonWorker',formats:['iife']},rollupOptions:{output:{inlineDynamicImports:true}}}});
const removalOutput = Array.isArray(removalResult) ? removalResult[0].output : removalResult.output;
const removalChunk = removalOutput.find(file => file.type === 'chunk');
if (!removalChunk) throw new Error('Person removal worker bundle was not produced.');
await writeFile(new URL('person.worker.js', removalDirectory), removalChunk.code);
console.log('Prepared offline experimental landscape person removal.');
