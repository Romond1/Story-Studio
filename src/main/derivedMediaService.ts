import { createReadStream } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import type { DerivedSourceRequest, PublishDerivedRequest } from '../shared/episodeProtocol';
import { MediaRegistryService } from './mediaRegistryService';
const PNG_SIGNATURE = [137,80,78,71,13,10,26,10];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_CACHE_BYTES = 64 * 1024 * 1024;
type Grant = { request: DerivedSourceRequest; png: Uint8Array; cacheKey: string };
/** Bounded runtime cache only. It never writes authored files or metadata. */
export class DerivedMediaService {
 private grants = new Map<string, Grant>();
 private bytes = 0;
 private generation = 0;
 constructor(private registry: MediaRegistryService, private imageSize: (bytes: Uint8Array) => { width: number; height: number }) {}
 private assertCurrent(request: DerivedSourceRequest) {
  if (!request || !this.registry.isCurrent(request.leaseId, request.revision) || (request.generation !== undefined && request.generation !== this.generation)) throw new Error('Derived media request is stale.');
 }
 private prune() {
  for (const [id, grant] of this.grants) if (!this.registry.isCurrent(grant.request.leaseId, grant.request.revision)) { this.bytes -= grant.png.byteLength; this.grants.delete(id); }
 }
 begin(request: {leaseId:string;revision:number;keepUrls:string[]}): {generation:number} {
  if(!request||!this.registry.isCurrent(request.leaseId,request.revision)||!Array.isArray(request.keepUrls)||request.keepUrls.length>100000)throw new Error('Derived generation is stale or invalid.');
  const keep=new Set<string>();
  for(const value of request.keepUrls){try{const url=new URL(value);const parts=url.pathname.split('/');if(url.protocol==='media:'&&url.hostname==='scoped-derived'&&parts.length===3&&parts[1]===request.leaseId)keep.add(parts[2]);}catch{throw new Error('Invalid retained derived grant.');}}
  // Retain the currently rendered pixels while the replacement is evaluated.
  // Older and canceled generations were never current, or were superseded.
  this.prune();for(const [id,grant] of this.grants)if(!keep.has(id)){this.bytes-=grant.png.byteLength;this.grants.delete(id);}
  return {generation:++this.generation};
 }
 async getSource(request: DerivedSourceRequest): Promise<{url:string;digest:string}> {
  this.assertCurrent(request);this.prune();
  const resolved=await this.registry.resolve({leaseId:request.leaseId,revision:request.revision,assetId:request.sourceAssetId,expectedType:'image'});
  if(!resolved.ok)throw new Error(`Derived source unavailable: ${resolved.code}`);
  const file=await this.registry.resolveUrl(resolved.url);if(!file)throw new Error('Derived source is stale or unsafe.');
  const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);
  this.assertCurrent(request);return {url:resolved.url,digest:hash.digest('hex')};
 }
 async publish(request:PublishDerivedRequest):Promise<{url:string}> {
  this.assertCurrent(request);this.prune();
  if(typeof request.key!=='string'||!request.key||request.key.length>8192||typeof request.sourceDigest!=='string'||!/^[a-f0-9]{64}$/.test(request.sourceDigest))throw new Error('Invalid derived cache identity.');
  const png=request.png;
  if(!(png instanceof Uint8Array)||png.byteLength>MAX_IMAGE_BYTES||png.byteLength<33||PNG_SIGNATURE.some((byte,i)=>png[i]!==byte))throw new Error('Invalid or oversized derived PNG.');
  const header=Buffer.from(png.buffer,png.byteOffset,png.byteLength);
  if(header.readUInt32BE(8)!==13||header.toString('ascii',12,16)!=='IHDR')throw new Error('Invalid derived PNG header.');
  const width=header.readUInt32BE(16),height=header.readUInt32BE(20);
  if(!width||!height||width>4096||height>4096||width*height>8*1024*1024)throw new Error('Derived PNG dimensions exceed limits.');
  const size=this.imageSize(png);
  if(size.width!==width||size.height!==height||!Number.isInteger(size.width)||!Number.isInteger(size.height)||size.width<1||size.height<1||size.width>4096||size.height>4096||size.width*size.height>8*1024*1024)throw new Error('Derived PNG dimensions exceed limits.');
  const source=await this.getSource(request);if(source.digest!==request.sourceDigest)throw new Error('Derived source changed; render again.');
  this.assertCurrent(request);
  const cacheKey=JSON.stringify([request.leaseId,request.revision,request.sourceAssetId,request.sourceDigest,request.key,createHash('sha256').update(png).digest('hex')]);
  for(const [grant,item] of this.grants)if(item.cacheKey===cacheKey)return {url:`media://scoped-derived/${request.leaseId}/${grant}`};
  // Refuse instead of evicting a grant that a published presentation still uses.
  if(this.bytes+png.byteLength>MAX_CACHE_BYTES)throw new Error('Derived image cache is full. Reopen the project to clear it.');
  const grant=randomUUID(),copy=new Uint8Array(png);this.grants.set(grant,{request:{leaseId:request.leaseId,revision:request.revision,sourceAssetId:request.sourceAssetId},png:copy,cacheKey});this.bytes+=copy.byteLength;
  return {url:`media://scoped-derived/${request.leaseId}/${grant}`};
 }
 async read(url:string):Promise<Uint8Array|null> {
  this.prune();
  try{const parsed=new URL(url),parts=parsed.pathname.split('/');if(parsed.protocol!=='media:'||parsed.hostname!=='scoped-derived'||parts.length!==3)return null;const grant=this.grants.get(parts[2]);if(!grant||grant.request.leaseId!==parts[1]||!this.registry.isCurrent(grant.request.leaseId,grant.request.revision))return null;return new Uint8Array(grant.png);}catch{return null;}
 }
}
