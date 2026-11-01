import { useState } from 'react';
import { awardSharedPoints, undoSharedPoints, resetSharedAdventure, sharedTeamScore, projectSharedAdventure, teamPlayDisplayName, type SharedAdventure } from '../../shared/sharedAdventure';
import { TeamPlayLibrary } from './TeamPlayLibrary';
import { TeamPlayRunControls } from './TeamPlayRunControls';
import { TeamScoreboardOverlay } from './TeamScoreboardOverlay';
import { projectTeamScoreboard } from '../../shared/teamPlay/scoreboard';
import type { useTeamPlayActivity } from './useTeamPlayActivity';
import type { SceneLessonProject } from '../../shared/lesson/model';
import type { StudentRosterEntry } from '../../shared/types';
import { SceneSurface } from '../lesson/SceneSurface';
import './sharedAdventure.css';

interface Props {
  activity:ReturnType<typeof useTeamPlayActivity>;
  project:SceneLessonProject; roster:StudentRosterEntry[]; busy:boolean; dirty:boolean; notice:string; error:string;
  resolve:(id:string)=>string|undefined; mediaPending:boolean; onChange:(group:SharedAdventure)=>void;
  onHome:()=>void; onNew:()=>void; onOpen:()=>void; onSave:()=>void; onSaveAs:()=>void; onImport:()=>void; onPresent:()=>void;
}
export function SharedAdventureWorkspace(props:Props) {
  const {project,roster,busy,dirty,resolve,onChange}=props,group=project.sharedAdventure!;
  const p=group.preparation,l=group.live;
  const [selected,setSelected]=useState<string[]>([]),[points,setPoints]=useState(5),[studentName,setStudentName]=useState(''),[deviceName,setDeviceName]=useState(''),[objective,setObjective]=useState(''),[failure,setFailure]=useState('');
  const change=(value:SharedAdventure)=>{try{onChange(value);setFailure('');}catch(reason){setFailure(String(reason));}};
  const prepare=(value:Partial<SharedAdventure['preparation']>)=>change({...group,preparation:{...p,...value}});
  const live=(value:Partial<SharedAdventure['live']>)=>change({...group,live:{...l,...value}});
  const award=(ids:string[])=>{try{change(awardSharedPoints(group,ids,points));}catch(reason){setFailure(String(reason));}};
  const team=sharedTeamScore(group);
  const addStudent=(name:string,profileId?:string)=>{
    if(!name.trim()||p.students.length>=200)return;
    prepare({students:[...p.students,{id:crypto.randomUUID(),name:name.trim().slice(0,80),color:['#67d9f5','#ffcf66','#f5a5cc'][p.students.length%3],participating:true,...(profileId?{profileId}:{})}]});setStudentName('');
  };
  return <main className="lesson-app shared-adventure">
    <header className="lesson-header"><button className="studio-brand" disabled={busy} onClick={props.onHome}>✦ Story Studio</button><h1>Team Play</h1><span>{dirty?'Unsaved changes':'Saved lesson'}</span>
      <nav aria-label="Team Play files"><button disabled={busy} onClick={props.onNew}>New group lesson</button><button disabled={busy} onClick={props.onOpen}>Open group lesson</button><button disabled={busy} onClick={props.onSave}>Save group lesson</button><button disabled={busy} onClick={props.onSaveAs}>Save group lesson as</button><button className="studio-present" disabled={busy} onClick={props.onPresent}>Open Present</button></nav>
    </header>
    <p className="shared-intro">Prepare together, teach together. Share the Present window in Zoom. Device labels describe who shares a screen; they do not connect devices.</p>
    {(props.error||failure)&&<p role="alert" className="lesson-error">{failure||props.error}</p>}
    {props.notice&&<p role="status">{props.notice}</p>}
    <fieldset className="shared-layout" disabled={busy}><legend className="shared-sr-only">Team Play preparation and teaching</legend>
      {props.activity.run&&<TeamPlayRunControls run={props.activity.run} onSession={props.activity.wheelSession} onDash={props.activity.dashCommand} onExit={props.activity.exit} onComplete={()=>{const id=props.activity.run!.entry.id;change({...group,live:{...l,completedActivityIds:[...new Set([...(l.completedActivityIds??[]),id])]}});props.activity.exit();}}/>}
      <section className="shared-teaching" aria-label="Shared lesson controls">
      <section className="shared-panel" aria-labelledby="shared-mission"><h2 id="shared-mission">Mission</h2>
        <label>Group name<input aria-label="Group name" key={project.id} defaultValue={teamPlayDisplayName(p.name)} maxLength={200} onBlur={event=>{if(event.target.value.trim()&&event.target.value!==teamPlayDisplayName(p.name))prepare({name:event.target.value.trim()});else event.target.value=teamPlayDisplayName(p.name);}} /></label>
        <label>Team target<input aria-label="Team target" type="number" min={1} max={1000000} value={p.target} onChange={event=>{const target=Number(event.target.value);if(Number.isInteger(target)&&target>0&&target<=1000000)prepare({target});}} /></label>
        <p className="shared-total" aria-live="polite">◆ Team {team} / {p.target}</p><progress aria-label="Team mission progress" value={Math.min(team,p.target)} max={p.target}/>
        <ul className="shared-objectives">{p.objectives.map(item=><li key={item.id}><label><input type="checkbox" checked={l.completedObjectiveIds.includes(item.id)} onChange={event=>live({completedObjectiveIds:event.target.checked?[...l.completedObjectiveIds,item.id]:l.completedObjectiveIds.filter(id=>id!==item.id)})}/>{item.text}</label><button aria-label={`Remove objective ${item.text}`} onClick={()=>change({...group,preparation:{...p,objectives:p.objectives.filter(row=>row.id!==item.id)},live:{...l,completedObjectiveIds:l.completedObjectiveIds.filter(id=>id!==item.id)}})}>Remove</button></li>)}</ul>
        <form onSubmit={event=>{event.preventDefault();if(objective.trim()&&p.objectives.length<200){prepare({objectives:[...p.objectives,{id:crypto.randomUUID(),text:objective.trim()}]});setObjective('');}}}><label>Next objective<input aria-label="Next objective" value={objective} maxLength={500} onChange={event=>setObjective(event.target.value)}/></label><button disabled={!objective.trim()||p.objectives.length>=200}>Add objective</button></form>
      </section>
      <section className="shared-panel" aria-labelledby="shared-scoring"><h2 id="shared-scoring">Points & scoreboard</h2><p>Select recipients in the group list. Team awards give this amount to every participating student.</p>
        <label>Points per student<input aria-label="Points per student" type="number" value={points} min={1} max={1000} onChange={event=>setPoints(Number(event.target.value))}/></label>
        <div className="shared-actions"><button disabled={busy||!selected.some(id=>p.students.some(student=>student.id===id&&student.participating))} onClick={()=>award(selected)}>Award selected</button><button disabled={busy||!p.students.some(student=>student.participating)} onClick={()=>award(p.students.map(student=>student.id))}>Award team</button><button disabled={!l.awards.length} onClick={()=>change(undoSharedPoints(group))}>Undo points</button><button aria-pressed={l.scoreboard} onClick={()=>live({scoreboard:!l.scoreboard})}>{l.scoreboard?'Hide scoreboard':'Show scoreboard'}</button></div>
        <button className="shared-reset" onClick={()=>{if(window.confirm('Start a new group session? Clear scores, scoring history and mission progress while keeping the group and media.')){change(resetSharedAdventure(group));props.activity.exit();}}}>Reset group session</button>
      </section>
      <section className="shared-panel" aria-labelledby="shared-content"><h2 id="shared-content">Lesson content</h2><p>This lesson has its own media folder. Import supported images, video and audio; the first milestone presents images and text.</p>
        <button disabled={busy} onClick={props.onImport}>Import group media</button>
        <label>Shared image<select aria-label="Shared image" value={p.imageAssetId??''} onChange={event=>prepare({imageAssetId:event.target.value||undefined})}><option value="">No image</option>{project.assets.filter(asset=>asset.mediaType==='image').map(asset=><option key={asset.id} value={asset.id}>{asset.displayTitle||asset.originalName}</option>)}</select></label>
        {p.imageAssetId&&!resolve(p.imageAssetId)&&<p role={props.mediaPending?'status':'alert'}>{props.mediaPending?'Loading selected image…':'The selected image is unavailable. Check the lesson assets folder or import another image.'}</p>}
        <label>Shared prompt<textarea aria-label="Shared prompt" value={p.prompt} maxLength={4000} onChange={event=>prepare({prompt:event.target.value})}/></label>
        <button aria-pressed={l.revealed} onClick={()=>live({revealed:!l.revealed})}>{l.revealed?'Hide content':'Reveal content'}</button>
        <p>Hidden content stays out of Present. For analog secret clues, ask the other children to turn away before revealing.</p>
      </section>
    </section><section className="shared-classroom" aria-label="Group and presentation">
      <section className="shared-panel"><h2>Student view</h2><div className="shared-preview">{props.activity.target?.kind==='game'?<p className="team-native-preview">Hero Dash is running in Present. Use Open Present to view the race.</p>:<SceneSurface plan={props.activity.target?.kind==='scene'?props.activity.target.plan:projectSharedAdventure(group,resolve)} surface="present"/>}{props.activity.run&&l.scoreboard&&<TeamScoreboardOverlay scoreboard={projectTeamScoreboard(group)}/>}</div></section>
      <TeamPlayLibrary project={project} onChange={change} onLaunch={props.activity.launch} running={!!props.activity.run}/>
      <section className="shared-panel" aria-labelledby="shared-group"><h2 id="shared-group">Group · {p.students.length} students</h2>
        <div className="shared-students">{p.students.map(student=><article key={student.id} className="shared-student" style={{borderColor:student.color}}>
          <label><input aria-label={`Award ${student.name}`} type="checkbox" checked={selected.includes(student.id)} disabled={!student.participating} onChange={event=>setSelected(event.target.checked?[...selected,student.id]:selected.filter(id=>id!==student.id))}/>Award</label>
          <label>Name<input aria-label={`Name ${student.id}`} defaultValue={student.name} maxLength={80} onBlur={event=>{const name=event.target.value.trim();if(name)prepare({students:p.students.map(row=>row.id===student.id?{...row,name}:row)});else event.target.value=student.name;}}/></label>
          <label>Color<input aria-label={`Color ${student.name}`} type="color" value={student.color} onChange={event=>prepare({students:p.students.map(row=>row.id===student.id?{...row,color:event.target.value}:row)})}/></label>
          <label>Device / location<select aria-label={`Device ${student.name}`} value={student.deviceId??''} onChange={event=>prepare({students:p.students.map(row=>row.id===student.id?{...row,deviceId:event.target.value||undefined}:row)})}><option value="">In person / unassigned</option>{p.devices.map(device=><option key={device.id} value={device.id}>{device.name}</option>)}</select></label>
          <label><input aria-label={`Participating ${student.name}`} type="checkbox" checked={student.participating} onChange={event=>prepare({students:p.students.map(row=>row.id===student.id?{...row,participating:event.target.checked}:row)})}/>Participating</label><strong className="shared-student-score">{l.scores[student.id]??0} points</strong>
          <button disabled={!!l.awards.length} title={l.awards.length?'Reset the group session before removing members.':undefined} onClick={()=>{prepare({students:p.students.filter(row=>row.id!==student.id)});setSelected(ids=>ids.filter(id=>id!==student.id));}}>Remove student</button>
        </article>)}</div>
        <form onSubmit={event=>{event.preventDefault();addStudent(studentName);}}><label>New student name<input aria-label="New student name" value={studentName} maxLength={80} onChange={event=>setStudentName(event.target.value)}/></label><button disabled={!studentName.trim()||p.students.length>=200}>Add student</button></form>
        <label>Add saved profile<select aria-label="Add saved profile" value="" onChange={event=>{const student=roster.find(row=>row.id===event.target.value);if(student)addStudent(student.nickname||student.name,student.id);}}><option value="">Choose an existing student…</option>{roster.filter(student=>!student.archived&&!p.students.some(member=>member.profileId===student.id)).map(student=><option key={student.id} value={student.id}>{student.nickname||student.name}</option>)}</select></label>
      </section>
      <section className="shared-panel"><h2>Devices / locations</h2><p>Two siblings can share Italy while another student uses Japan. Scores always belong to students.</p><ul>{p.devices.map(device=><li key={device.id}>{device.name} · {p.students.filter(student=>student.deviceId===device.id).length} students <button onClick={()=>prepare({devices:p.devices.filter(row=>row.id!==device.id),students:p.students.map(student=>student.deviceId===device.id?{...student,deviceId:undefined}:student)})}>Remove device {device.name}</button></li>)}</ul>
        <form onSubmit={event=>{event.preventDefault();if(deviceName.trim()&&p.devices.length<200){prepare({devices:[...p.devices,{id:crypto.randomUUID(),name:deviceName.trim()}]});setDeviceName('');}}}><label>New device / location<input aria-label="New device / location" value={deviceName} maxLength={200} onChange={event=>setDeviceName(event.target.value)}/></label><button disabled={!deviceName.trim()||p.devices.length>=200}>Add device</button></form>
      </section>
    </section></fieldset>
  </main>;
}
