import type {Dispatch,SetStateAction} from 'react';
import type {LessonSession} from '../../shared/lesson/model';
import {setLessonRewardAppearance} from '../../shared/lesson/rewards';
import {DEFAULT_REWARD_APPEARANCE,type RewardAppearance} from '../../shared/rewardAppearance';
import {notifyTeacher} from './teacherNotifications';
export function RewardAppearanceControls({session,onSession}:{session:LessonSession;onSession:Dispatch<SetStateAction<LessonSession>>}){
 const appearance=session.rewards?.appearance??DEFAULT_REWARD_APPEARANCE;
 const change=(patch:Partial<RewardAppearance>,message:string)=>{onSession(current=>current.id===session.id?setLessonRewardAppearance(current,{...appearance,...patch}):current);notifyTeacher(message,'reward-appearance');};
 return <details className="lesson-inspector-section"><summary>Reward appearance</summary><div>
 <label className="lesson-field">Reward position<select aria-label="Reward position" value={appearance.position} onChange={e=>change({position:e.target.value as RewardAppearance['position']},`Rewards: ${e.target.selectedOptions[0].text}`)}>{[['topRight','Top right'],['topLeft','Top left'],['bottomRight','Bottom right'],['bottomLeft','Bottom left'],['center','Center']].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
 <label className="lesson-field">Reward pop-up size<input aria-label="Reward pop-up size" type="range" min=".5" max="3" step=".05" value={appearance.size} onChange={e=>change({size:Number(e.target.value)},`Reward size: ${Math.round(Number(e.target.value)*100)}%`)}/><output>{Math.round(appearance.size*100)}%</output></label>
 <label className="lesson-field">Reward effect intensity<input aria-label="Reward effect intensity" type="range" min="0" max="3" step=".1" value={appearance.intensity} onChange={e=>change({intensity:Number(e.target.value)},`Reward intensity: ${Math.round(Number(e.target.value)*100)}%`)}/><output>{Math.round(appearance.intensity*100)}%</output></label>
 <p className="lesson-hint">Size changes the star and name pop-up. Intensity changes its sparkle, glow and spread. Applies to the next award.</p>
 <button onClick={()=>change(DEFAULT_REWARD_APPEARANCE,'Reward appearance reset')}>Reset reward appearance</button></div></details>;
}
