const fs = require('node:fs/promises');
const path = require('node:path');
const {createHash,randomUUID} = require('node:crypto');
const {decompress} = require('fzstd');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
/** Content-addressed cache; neither partial nor corrupt downloads are accepted. */
async function cached(cache, item, status = () => {}) {
  await fs.mkdir(cache, {recursive:true});
  const file = path.join(cache, item.hash);
  try { const bytes = await fs.readFile(file); if (hash(bytes) === item.hash) return bytes; } catch {}
  if(process.env.STORY_STUDIO_TRANSLATION_OFFLINE==='1')throw new Error(`Offline: ${item.name} is not installed or is corrupt`);
  status(`Installing ${item.name}…`);
  const response = await fetch(item.url, {signal:AbortSignal.timeout(300000)});
  if (!response.ok) throw new Error(`Model download failed (${response.status}). Connect once to install, then retry.`);
  const chunks=[]; let size=0;
  for await (const chunk of response.body) { size+=chunk.length; if (size > item.size) throw new Error('Download exceeds expected size'); chunks.push(chunk); }
  const bytes=Buffer.concat(chunks);
  if (bytes.length !== item.size || hash(bytes) !== item.hash) throw new Error(`Integrity check failed: ${item.name}`);
  const temp=file+'.'+randomUUID()+'.tmp';
  try { await fs.writeFile(temp,bytes); await fs.rename(temp,file); }
  finally { await fs.rm(temp,{force:true}).catch(()=>{}); }
  return bytes;
}
async function modelFile(cache, record, status) {
  const data=await cached(cache,{...record.attachment,name:record.name,url:'https://firefox-settings-attachments.cdn.mozilla.net/'+record.attachment.location},status);
  const bytes=decompress(data);
  if(bytes.length !== record.decompressedSize || hash(bytes)!==record.decompressedHash) throw new Error('Decompressed model integrity check failed');
  return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
}
module.exports={cached,modelFile,hash};
