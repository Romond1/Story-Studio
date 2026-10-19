import test from 'node:test';
import assert from 'node:assert/strict';
import {LEGACY_BE_A_HERO_V1} from './adventures/legacy-be-a-hero-v1';
import {DEFAULT_MOVEMENT_EVENTS, BUILT_IN_MOVEMENT_GIFS} from './movement';
import {DEFAULT_RELIC_SYSTEM} from './relics';
import {createModuleTemplate} from './modules/templates';
test('versioned legacy pack preserves movement identity and asset compatibility',()=>{
 const pack=LEGACY_BE_A_HERO_V1;
 assert.equal(pack.id,'legacy-be-a-hero'); assert.equal(pack.version,1);
 assert.deepEqual(pack.movementEvents.map(e=>[e.id,e.gifRelativePath,e.shortcut]),[
 ['touch-color','assets/touch_color.gif','Numpad1'],['run-in-place','assets/run.gif','Numpad2'],['hero-pose','assets/hero_pose_mia.gif','Numpad3'],['touch-head','assets/touch_head.gif','Numpad4'],['touch-nose','assets/touch_nose.gif','Numpad5']]);
 assert.deepEqual(DEFAULT_MOVEMENT_EVENTS,pack.movementEvents);
 assert.deepEqual(BUILT_IN_MOVEMENT_GIFS,pack.movementGifs);
 assert.notEqual(DEFAULT_MOVEMENT_EVENTS,pack.movementEvents);
 assert.deepEqual(pack.movementGifs.filter(g=>g.label.startsWith('Hero')), [{label:'Hero Pose - Mia',relativePath:'assets/hero_pose_mia.gif'},{label:'Hero Pose - Yuki',relativePath:'assets/hero_pose_yuki.gif'}]);
});
test('legacy questions and relic stages retain exact authored text',()=>{
 assert.deepEqual(LEGACY_BE_A_HERO_V1.snakeQuestionLines,[
 'CLUE: They followed the glowing s__________ through the forest.','Answer: shard','',
 'UNSCRAMBLE: deeper / The / forest / into / shard / moving / is','Answer: The shard is moving deeper into the forest.','',
 'WHO SAID: "Do not rush, Yuki?"','Answer: Kage','',
 'FINISH: The kids found a big old c__________ in the forest.','Answer: castle']);
 assert.deepEqual(DEFAULT_RELIC_SYSTEM.stageTitles,{stage1:'Echo Fragment Found',stage2:'Echo Core Restored',stage3:'Echo Stone Awakened'});
 assert.deepEqual(DEFAULT_RELIC_SYSTEM.stageTitles,LEGACY_BE_A_HERO_V1.relicStageTitles);
});
test('new hosted module templates contain no legacy adventure content',()=>{
 for(const type of ['activation-cards','language-snake','final-boss-hero'] as const){
 const config=createModuleTemplate(type);
 assert.doesNotMatch(JSON.stringify(config),/Mia|Yuki|Kage|Echo (?:Stone|Core|Fragment)|glowing s__________/);
 }
});
