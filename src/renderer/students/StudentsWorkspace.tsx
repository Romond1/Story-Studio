import { useEffect, useRef, useState } from 'react';
import type { StudentRosterEntry } from '../../shared/types';
import { STUDENT_AVATARS, type StudentSnapshot } from '../../shared/students/model';
import { previewLegacyProfiles, type LegacyProfilePreview } from '../../shared/studentImport';
import './students.css';
import { ClassesPanel } from './ClassesPanel';
import { HeroBoard, type HeroBoardLesson } from './HeroBoard';

export const avatarLabel = (avatar?: string) => ({star:'⭐',rocket:'🚀',leaf:'🌱',sun:'☀️',moon:'🌙',cat:'🐱'}[avatar ?? ''] ?? avatar ?? '○');

export function StudentsWorkspace({ onClose, onChange, initialView = 'profiles', lesson, initialStudentId }: { onClose: () => void; onChange: (snapshot: StudentSnapshot) => void; initialView?: 'profiles'|'hero'; lesson?: HeroBoardLesson; initialStudentId?: string }) {
  const [view,setView]=useState(initialView);
  const [snapshot, setSnapshot] = useState<StudentSnapshot | null>(null), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(''), [name, setName] = useState(''), [nickname, setNickname] = useState(''), [avatar, setAvatar] = useState('');
  const [showArchived, setShowArchived] = useState(false), [search, setSearch] = useState('');
  const [source, setSource] = useState(''), [json, setJson] = useState(''), [preview, setPreview] = useState<LegacyProfilePreview[]>([]), [targets, setTargets] = useState<Record<string,string>>({});
  const lock = useRef(false), close = useRef<HTMLButtonElement>(null), surface = useRef<HTMLElement>(null);
  const apply = (value: StudentSnapshot) => { setSnapshot(value); onChange(value); };
  useEffect(() => { let live = true; close.current?.focus(); void window.appApi.students.getSnapshot().then(value => { if (live) apply(value); }).catch(reason => { if(live)setError(String(reason)); }); return () => { live = false; }; }, []);
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; return () => previous?.focus(); }, []);
  const perform = async (operation: () => Promise<StudentSnapshot>, message: string) => {
    if(lock.current)return; lock.current=true;setBusy(true);setError('');setNotice('');
    try { apply(await operation());setNotice(message); } catch(reason){setError(String(reason));} finally{lock.current=false;setBusy(false);}
  };
  const edit = (student?: StudentRosterEntry) => {setSelected(student?.id ?? '');setName(student?.name ?? '');setNickname(student?.nickname ?? '');setAvatar(student?.avatar ?? '');setNotice('');};
  const profile = snapshot?.studentRoster.find(student => student.id === selected);
  return <div className="students-backdrop"><section ref={surface} className="students-workspace" role="dialog" aria-modal="true" aria-label="Students" onKeyDown={event => { if(event.key==='Escape'&&!busy)onClose(); if(event.key==='Tab'){const nodes=Array.from(surface.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary')??[]).filter(node=>node.getClientRects().length);const first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}} }}>
    <header><div><p className="students-eyebrow">Your classroom</p><h1>Students</h1><p>Permanent profiles, shared across your lessons and adventures.</p></div><button ref={close} disabled={busy} onClick={onClose}>Close students</button></header>
    <nav className="students-actions" aria-label="Student workspace"><button aria-pressed={view==='profiles'} onClick={()=>setView('profiles')}>Profiles and classes</button><button aria-pressed={view==='hero'} onClick={()=>setView('hero')}>Hero Board</button></nav>
    {error && <p role="alert" className="lesson-error">{error}</p>}{notice && <p role="status">{notice}</p>}
    {!snapshot ? <p>Loading student profiles…</p> : view==='hero'?<HeroBoard students={snapshot} lesson={lesson} initialStudentId={initialStudentId} />:<div className="students-columns">
      <aside><div className="students-actions"><button onClick={() => edit()} disabled={busy}>New student</button><label><input type="checkbox" checked={showArchived} onChange={event=>setShowArchived(event.target.checked)} />Include archived</label></div>
        <label className="students-field">Find student<input value={search} onChange={event=>setSearch(event.target.value)} /></label>
        <div className="students-list">{snapshot.studentRoster.filter(student => (showArchived || !student.archived) && `${student.name} ${student.nickname ?? ''}`.toLowerCase().includes(search.toLowerCase())).map(student=><button key={student.id} className={selected===student.id?'selected':''} aria-label={`Open profile for ${student.name}`} onClick={()=>edit(student)}><span aria-hidden="true">{avatarLabel(student.avatar)}</span><span><strong>{student.name}</strong><small>{student.nickname || 'No nickname'}{student.archived?' · Archived':''}</small></span></button>)}</div>
        {!snapshot.studentRoster.length && <p>Add your first student. Students with the same name remain separate profiles.</p>}
      </aside>
      <div><form onSubmit={event=>{event.preventDefault();void perform(()=>selected?window.appApi.students.updateProfile({id:selected,name,nickname:nickname.trim()||null,avatar:avatar||null}):window.appApi.students.createProfile({name,...(nickname.trim()?{nickname}:{}),...(avatar?{avatar}:{})}),selected?'Profile saved.':'Student created.');}}>
        <h2>{profile?'Edit profile':'New student'}</h2>
        <label className="students-field">Display name<input required maxLength={200} value={name} onChange={event=>setName(event.target.value)} /></label>
        <label className="students-field">Nickname<input maxLength={80} value={nickname} onChange={event=>setNickname(event.target.value)} /><small>Use a nickname for student-facing presentation.</small></label>
        <label className="students-field">Avatar<select value={avatar} onChange={event=>setAvatar(event.target.value)}><option value="">No avatar</option>{STUDENT_AVATARS.filter(value=>/^[a-z]+$/.test(value)).map(value=><option key={value} value={value}>{avatarLabel(value)} {value}</option>)}</select></label>
        <div className="students-actions"><button className="studio-primary" disabled={busy || !name.trim()} type="submit">Save profile</button>{profile && <button type="button" disabled={busy} onClick={()=>void perform(()=>window.appApi.students.setArchived({id:profile.id,archived:!profile.archived}),profile.archived?'Profile restored.':'Profile archived. Historical progress is retained.')}>{profile.archived?'Restore student':'Archive student'}</button>}</div>
        {profile && <p className="students-meta">Created {profile.createdAt} · Updated {profile.updatedAt}<br />Archiving removes a student from active teaching lists and preserves their history.</p>}
      </form>
      <ClassesPanel snapshot={snapshot} onChange={apply} />
      <details className="students-import"><summary>Map legacy students</summary><p>Paste a legacy roster with IDs and names. Choose each destination explicitly. Names never merge profiles. Reward and relic balances remain unchanged; use reviewed teacher adjustments to transfer legacy progress.</p>
        <button disabled={busy} onClick={()=>{try{const text=window.localStorage.getItem('story-studio.student-roster.v1');if(!text)throw Error('No local roster backup was found.');setPreview(previewLegacyProfiles(text));setJson(text);setSource('local-roster-backup-v1');setTargets({});setError('');}catch(reason){setError(String(reason));}}}>Preview local roster backup</button>
        <label className="students-field">Legacy source<input value={source} onChange={event=>{setSource(event.target.value);setPreview([]);}} placeholder="A unique source label or legacy lesson path" /></label>
        <label className="students-field">Legacy roster JSON<textarea rows={5} value={json} onChange={event=>{setJson(event.target.value);setPreview([]);}} /></label>
        <button disabled={busy || !source.trim()} onClick={()=>{try{setPreview(previewLegacyProfiles(json));setTargets({});setError('');}catch(reason){setError(String(reason));}}}>Preview legacy roster</button>
        {preview.map(row=>{const mapping=snapshot.legacyMappings.find(item=>item.source===source.trim()&&item.sourceStudentId===row.id);return <div key={row.id} className="students-mapping"><strong>{row.name}</strong><small>Source ID: {row.id}</small>{mapping?<p>Mapped to {snapshot.studentRoster.find(student=>student.id===mapping.targetStudentId)?.name ?? 'Existing profile'}</p>:<><select aria-label={`Map legacy ${row.id}`} value={targets[row.id]??''} onChange={event=>setTargets(old=>({...old,[row.id]:event.target.value}))}><option value="">Choose a destination</option><option value="__create__">Create a separate profile</option>{snapshot.studentRoster.map(student=><option key={student.id} value={student.id}>{student.name} · {student.id}{student.archived?' (archived)':''}</option>)}</select><button disabled={busy || !targets[row.id]} onClick={()=>void perform(()=>targets[row.id]==='__create__'?window.appApi.students.importProfile({source:source.trim(),sourceStudentId:row.id,name:row.name}):window.appApi.students.mapLegacy({source:source.trim(),sourceStudentId:row.id,targetStudentId:targets[row.id]}),'Legacy identity mapped. No progression balances were changed.')}>Confirm mapping for {row.id}</button></>}</div>;})}
        {!!snapshot.legacyMappings.length && <p>{snapshot.legacyMappings.length} source identities mapped.</p>}
      </details></div>
    </div>}
  </section></div>;
}
