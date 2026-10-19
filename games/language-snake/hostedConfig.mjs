const setupKeys=['mode','lessonType','boardWidth','boardHeight','crystalCount','coopTimerSeconds','playerCount'];
const synthSlots=new Set(['correct','wrong','eat','crash','crown','congrats','cheer','confetti','villain','music']);
function resolve(ref,mediaMap){if(!ref)return '';if(ref.startsWith('builtin:language-snake/')&&synthSlots.has(ref.slice('builtin:language-snake/'.length)))return '';const url=mediaMap[ref];if(typeof url!=='string'||!url.startsWith('media://'))throw new Error(`Missing registered Snake media: ${ref}`);return url;}
export function toSnakeRuntime(config,mediaMap){return {...config,backgroundImage:resolve(config.backgroundImage,mediaMap),sounds:Object.fromEntries(Object.entries(config.sounds??{}).map(([key,ref])=>[key,resolve(ref,mediaMap)])),music:resolve(config.music,mediaMap)};}
export function exportSnakeConfig(payload,audioRefs,mediaMap){
 const unmap=url=>{if(!url)return '';const matches=Object.entries(mediaMap).filter(([,value])=>value===url);if(matches.length!==1)throw new Error('Choose registered media from the lesson before saving Snake configuration.');return matches[0][0];};
 const setup=payload.matchSetup??payload.splashSetup??payload.setup??{};
 return {questionText:payload.questionText,setup:Object.fromEntries(setupKeys.map(key=>[key,setup[key]])),playerDirectionLabels:payload.playerDirectionLabels,playerKeyBindings:payload.playerKeyBindings,heroCrownSettings:payload.heroCrownSettings,heroCrownChallengeText:payload.heroCrownChallengeText,enemySettings:payload.enemySettings,backgroundControls:payload.backgroundControls,backgroundImage:unmap(payload.backgroundImage),...(audioRefs.sounds?{sounds:{...audioRefs.sounds}}:{}),...(audioRefs.music?{music:audioRefs.music}:{})};
}
