import {mkdir,copyFile,readdir} from 'node:fs/promises';
const source=new URL('../src/main/translation/',import.meta.url);
const target=new URL('../dist/main/main/translation/',import.meta.url);
await mkdir(target,{recursive:true});
for(const file of await readdir(source)) if(/\.(cjs|json|txt|md)$/.test(file)) await copyFile(new URL(file,source),new URL(file,target));
await copyFile(new URL('../native/whisper-host/bin/win32-x64/whisper-host.exe',import.meta.url),new URL('whisper-host.exe',target));
await copyFile(new URL('../native/whisper-host/manifest.json',import.meta.url),new URL('whisper-host-manifest.json',target));
await copyFile(new URL('../native/whisper-host/vendor/LICENSE',import.meta.url),new URL('whisper-host-LICENSE.txt',target));
