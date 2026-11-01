import { useState } from 'react';
import type { SceneLessonProject } from '../../shared/lesson/model';
import type { SharedAdventure } from '../../shared/sharedAdventure';
import { createTeamEntry, getTeamActivity, listTeamActivities, teamEntryProblems, type TeamActivityEntry, type TeamActivitySource } from '../../shared/teamPlay/activities';

function EntryEditor({entry,project,onChange}:{entry:TeamActivityEntry;project:SceneLessonProject;onChange:(entry:TeamActivityEntry)=>void}) {
  const images=project.assets.filter(asset=>asset.mediaType==='image');
  return <div className="team-entry-editor">
    <label>Activity title<input aria-label="Activity title" defaultValue={entry.title} maxLength={200} onBlur={event=>{const title=event.target.value.trim();if(title)onChange({...entry,title});else event.target.value=entry.title;}}/></label>
    {entry.content.questions.map((question,index)=><fieldset key={question.id} className="team-question"><legend>Question {index+1}</legend>
      <label>Question text<textarea aria-label={`Question ${index+1} text`} maxLength={2000} value={question.prompt} onChange={event=>onChange({...entry,content:{...entry.content,questions:entry.content.questions.map(row=>row.id===question.id?{...row,prompt:event.target.value}:row)}})}/></label>
      <label>Question image<select aria-label={`Question ${index+1} image`} value={question.imageAssetId??''} onChange={event=>onChange({...entry,content:{...entry.content,questions:entry.content.questions.map(row=>row.id===question.id?{...row,imageAssetId:event.target.value||undefined}:row)}})}><option value="">No image</option>{images.map(image=><option key={image.id} value={image.id}>{image.displayTitle||image.originalName}</option>)}</select></label>
      <button onClick={()=>onChange({...entry,content:{...entry.content,questions:entry.content.questions.filter(row=>row.id!==question.id)}})}>Remove question {index+1}</button>
    </fieldset>)}
    <button disabled={entry.content.questions.length>=40} onClick={()=>onChange({...entry,content:{...entry.content,questions:[...entry.content.questions,{id:crypto.randomUUID(),prompt:''}]}})}>Add question</button>
    {entry.activityId==='mastery.hero-dash'&&<><p>Racer roles do not replace student identities or change group scores.</p><label>Race length<select aria-label="Race length" value={entry.settings.trackLength} onChange={event=>onChange({...entry,settings:{...entry.settings,trackLength:Number(event.target.value)}})}>{Array.from({length:21},(_,index)=>index+10).map(length=><option key={length}>{length}</option>)}</select></label>{entry.settings.racers.map((name,index)=><label key={index}>Racer {index+1}<input aria-label={`Racer ${index+1}`} maxLength={80} defaultValue={name} onBlur={event=>{const name=event.target.value.trim();if(!name){event.target.value=entry.settings.racers[index];return;}const racers:[string,string]=[...entry.settings.racers];racers[index]=name;onChange({...entry,settings:{...entry.settings,racers}});}}/></label>)}</>}
  </div>;
}
export function TeamPlayLibrary({project,onChange,onLaunch,running}:{project:SceneLessonProject;onChange:(group:SharedAdventure)=>void;onLaunch:(entry:TeamActivityEntry)=>void;running:boolean}) {
  const group=project.sharedAdventure!,p=group.preparation,entries=p.activities??[];
  const [source,setSource]=useState<TeamActivitySource|''>(''),[playableOnly,setPlayableOnly]=useState(false),[selected,setSelected]=useState('discovery.spinning-wheel');
  const initial=(activityId:string)=>createTeamEntry(activityId,{version:1,questions:[{id:crypto.randomUUID(),prompt:p.prompt.slice(0,2000),...(p.imageAssetId?{imageAssetId:p.imageAssetId}:{})}]});
  const [draft,setDraft]=useState<TeamActivityEntry>(()=>initial('discovery.spinning-wheel'));
  const definition=getTeamActivity(selected),completed=group.live.completedActivityIds??[];
  const problems=(entry:TeamActivityEntry)=>teamEntryProblems(entry,id=>project.assets.some(asset=>asset.id===id&&asset.mediaType==='image'));
  const replace=(next:TeamActivityEntry[])=>onChange({...group,preparation:{...p,activities:next}});
  const next=entries.find(entry=>!completed.includes(entry.id)&&!problems(entry).length);
  const choose=(activityId:string)=>{setSelected(activityId);if(getTeamActivity(activityId)?.playable)setDraft(initial(activityId));};
  const move=(index:number,delta:number)=>{const next=[...entries];[next[index],next[index+delta]]=[next[index+delta],next[index]];replace(next);};
  return <section className="shared-panel team-library" aria-labelledby="team-library-title"><h2 id="team-library-title">Activity library</h2>
    <p>Choose an existing activity, prepare its questions, then add it to the lesson sequence. Original module lessons are unchanged.</p>
    <fieldset disabled={running} className="team-library-fields"><legend className="shared-sr-only">Activity preparation</legend>
      <label>Source module<select aria-label="Source module" value={source} onChange={event=>{const value=event.target.value as TeamActivitySource|'';setSource(value);choose(listTeamActivities(value||undefined,playableOnly)[0]?.id??'');}}><option value="">All modules</option>{(['Adventure','Discovery','Challenge','Mastery','Team Play'] as const).map(module=><option key={module}>{module}</option>)}</select></label>
      <label className="team-inline"><input type="checkbox" checked={playableOnly} onChange={event=>{setPlayableOnly(event.target.checked);choose(listTeamActivities(source||undefined,event.target.checked)[0]?.id??'');}}/>Playable integrations only</label>
      <div className="team-library-items">{listTeamActivities(source||undefined,playableOnly).map(activity=><button key={activity.id} aria-pressed={selected===activity.id} onClick={()=>choose(activity.id)}><strong>{activity.name}</strong><span>{activity.source} · {activity.compatibility}{activity.playable?' · Integrated':' · Not available here'}</span></button>)}</div>
      {!listTeamActivities(source||undefined,playableOnly).length&&<p>No integrated activities match this module. Turn off the filter to see compatibility information.</p>}
      {definition&&<div className="team-library-description"><h3>{definition.name}</h3><p>{definition.description}</p><p><b>{definition.compatibility}{definition.playable?' · Integrated adapter':' · Not integrated'}</b></p><p>{definition.contentRequirements}</p><p>{definition.exitBehavior}</p>
        {definition.playable&&<div key={`${selected}:${draft.id}`}><EntryEditor entry={draft} project={project} onChange={setDraft}/><button disabled={entries.length>=200} onClick={()=>{replace([...entries,{...draft,id:crypto.randomUUID()}]);}}>Add to lesson sequence</button></div>}
      </div>}
      <h3>Lesson sequence</h3>{!entries.length&&<p>No activities prepared yet. Add one above to begin.</p>}
      <button disabled={!next} onClick={()=>next&&onLaunch(next)}>Launch next prepared activity</button>
      <ol className="team-sequence">{entries.map((entry,index)=><li key={entry.id}><details><summary>{index+1}. {entry.title} · {completed.includes(entry.id)?'Completed':problems(entry).length?'Needs preparation':'Ready to launch'}</summary>
        <p>{getTeamActivity(entry.activityId)?.source??'Unknown module'} · {getTeamActivity(entry.activityId)?.compatibility??'Unsupported'}</p>
        {getTeamActivity(entry.activityId)?.playable&&<EntryEditor entry={entry} project={project} onChange={value=>replace(entries.map(row=>row.id===entry.id?value:row))}/>}
        {problems(entry).map(problem=><p role="status" key={problem}>{problem}</p>)}
        <div className="shared-actions"><button disabled={!!problems(entry).length} onClick={()=>onLaunch(entry)}>Launch {entry.title}</button><button disabled={!getTeamActivity(entry.activityId)?.playable} onClick={()=>{setSelected(entry.activityId);setDraft({...structuredClone(entry),id:crypto.randomUUID()});}}>Load configuration</button><button aria-label={`Move ${entry.title} earlier`} disabled={index===0} onClick={()=>move(index,-1)}>Earlier</button><button aria-label={`Move ${entry.title} later`} disabled={index===entries.length-1} onClick={()=>move(index,1)}>Later</button><button onClick={()=>onChange({...group,preparation:{...p,activities:entries.filter(row=>row.id!==entry.id)},live:{...group.live,completedActivityIds:completed.filter(id=>id!==entry.id)}})}>Remove activity</button>{completed.includes(entry.id)&&<button onClick={()=>onChange({...group,live:{...group.live,completedActivityIds:completed.filter(id=>id!==entry.id)}})}>Mark not completed</button>}</div>
      </details></li>)}</ol>
    </fieldset>{running&&<p>Activity preparation is locked while a game is running. Group scoring remains available.</p>}
  </section>;
}
