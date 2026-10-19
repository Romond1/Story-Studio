import { useState, type ReactNode } from 'react';
import type { StudentRosterEntry } from '../../shared/types';
import type { ProgressionState } from '../../shared/progression/model';
import { avatarLabel } from './StudentsWorkspace';
export function TeachRoster({ roster, participants, onParticipants, onDetails, classControls, children, disabled, game, progress, adventureId }: {
  roster: StudentRosterEntry[]; participants: string[]; onParticipants: (ids: string[]) => void; onDetails: (id: string) => void; classControls: ReactNode; children?: ReactNode; disabled: boolean; game?: boolean; progress: ProgressionState | null; adventureId?: string;
}) {
  const [open,setOpen]=useState(()=>{try{return localStorage.getItem('story-studio.teach-roster-open')!=='false';}catch{return true;}});
  const guests=participants.filter(id=>id.startsWith('guest:'));
  return <details className="lesson-panel-content teach-students" open={open} onToggle={event=>{const value=event.currentTarget.open;setOpen(value);try{localStorage.setItem('story-studio.teach-roster-open',String(value));}catch{}}}><summary>Students · {participants.length} selected</summary>
    {classControls}
    <details><summary>{game?'Activity participants':'Participants'} ({participants.length})</summary><p>Each activity captures its participants when it starts. Select one student for an individual session.</p>
      {roster.map(student=>{const row=progress?.students.find(item=>item.studentId===student.id&&item.adventureId===adventureId);const count=progress?.history.filter(item=>item.kind==='activity-completed'&&item.adventureId===adventureId&&item.studentIds.includes(student.id)).length??0;return <div className="teach-student" key={student.id}><label className="lesson-check"><input type="checkbox" aria-label={student.name} disabled={disabled} checked={participants.includes(student.id)} onChange={event=>onParticipants(event.target.checked?[...participants,student.id]:participants.filter(id=>id!==student.id))} /><span aria-hidden="true">{avatarLabel(student.avatar)}</span>{student.name}</label><button onClick={()=>onDetails(student.id)} aria-label={`Details for ${student.name}`}>Details</button><small>{count} completed activities · {Object.values(row?.inventory??{}).reduce((a,b)=>a+b,0)} rewards · relic progress {Object.values(row?.relics??{}).reduce((a,b)=>a+b,0)}</small></div>;})}
      <div className="lesson-toolbar"><button disabled={disabled} onClick={()=>onParticipants([...participants,`guest:${crypto.randomUUID()}`])}>Add temporary guest</button><button disabled={disabled||!participants.length} onClick={()=>onParticipants([])}>Clear participants</button></div><span>{guests.length} guests</span>{guests.map((id,index)=><button key={id} disabled={disabled} onClick={()=>onParticipants(participants.filter(value=>value!==id))}>Remove guest {index+1}</button>)}
    </details>{children}
  </details>;
}
