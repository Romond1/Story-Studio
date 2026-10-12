const {spawnSync}=require('node:child_process');const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const root=path.resolve(__dirname,'../native/whisper-host');const out=path.join(root,'bin/win32-x64');fs.mkdirSync(out,{recursive:true});
const result=spawnSync('cl.exe',['/nologo','/std:c++17','/EHsc','/O2','/MT',`/I${path.join(root,'vendor')}`,path.join(root,'main.cpp'),`/Fo${path.join(out,'whisper-host.obj')}`,`/Fe${path.join(out,'whisper-host.exe')}`],{stdio:'inherit',windowsHide:true});
if(result.error)throw result.error;if(result.status)process.exit(result.status);
fs.unlinkSync(path.join(out,'whisper-host.obj'));
const binary=fs.readFileSync(path.join(out,'whisper-host.exe'));
fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify({version:1,whisperVersion:'1.8.2',platform:'win32-x64',file:'bin/win32-x64/whisper-host.exe',size:binary.length,sha256:crypto.createHash('sha256').update(binary).digest('hex')},null,2)+'\n');
