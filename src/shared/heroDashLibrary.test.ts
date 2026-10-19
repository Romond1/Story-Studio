import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {HeroDashLibrary} from '../main/heroDashLibrary';
import {defaultDashConfig} from './heroDash';
test('review imports persist independently and saved collections capture episode references',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'dash-library-'));const store=new HeroDashLibrary(path.join(root,'library'));
 const picture=path.join(root,'old-episode.png');await fs.writeFile(picture,Buffer.from('89504e470d0a1a0a00000000','hex'));
 const unsupported=path.join(root,'unsupported.exe');await fs.writeFile(unsupported,'unsupported');
 const result=await store.importImages([picture,unsupported]);assert.equal(result.images.length,1);assert.equal(result.failures.length,1);assert.match(result.failures[0].reason,/Use PNG/);
 const config={...defaultDashConfig(),importedImages:[`dash:${result.images[0].id}`],cards:[{id:'q',image:'asset:episode-image',text:'',note:'Teacher only',reward:1}]};
 const saved=await store.saveCollection(undefined,config,async()=>({bytes:await fs.readFile(picture),name:'episode.png'}));
 assert.ok(saved.config.cards[0].image.startsWith('dash:'));await fs.unlink(picture);
 const reopened=new HeroDashLibrary(path.join(root,'library'));assert.equal((await reopened.list()).collections.length,1);assert.equal((await reopened.loadCollection(saved.id)).cards[0].note,'Teacher only');assert.ok(await reopened.resolveUrl(result.images[0].url));assert.equal(await reopened.resolveUrl('media://hero-dash/../secret'),null);
});
