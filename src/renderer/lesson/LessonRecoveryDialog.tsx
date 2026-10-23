import { useEffect, useRef, useState } from 'react';
import type { LessonProject } from '../../shared/lesson/model';

export function LessonRecoveryDialog({ folder, current, onRestore, onClose }: { folder: string; current: () => LessonProject | null; onRestore: (value: LessonProject) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [versions, setVersions] = useState<Awaited<ReturnType<Window['lessonApi']['recoveryList']>>>([]);
  const [preview, setPreview] = useState<{ name: string; data: LessonProject } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    const node = dialog.current!, trigger = document.activeElement as HTMLElement | null;
    node.showModal(); let live = true;
    void window.lessonApi.recoveryList(folder).then(value => { if (live) setVersions(value); }).catch(e => { if (live) setError(String(e)); });
    return () => { live = false; node.close(); trigger?.focus(); };
  }, [folder]);
  return <dialog ref={dialog} className="lesson-recovery-dialog" role="dialog" aria-modal="true" aria-label="Project recovery" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }} onKeyDown={e => e.stopPropagation()}>
    <h2>Project recovery</h2><p>Choose a checkpoint to preview. Restore is undoable and keeps a backup of your current work.</p>
    <div className="lesson-recovery-versions">{versions.map(version => <button key={version.name} disabled={busy} aria-pressed={preview?.name === version.name} onClick={async () => { setBusy(true); try { const data = await window.lessonApi.recoveryRead(folder, version.name); setPreview({ name: version.name, data }); setError(''); } catch (e) { setError(String(e)); } finally { setBusy(false); } }}>{new Date(version.createdAt).toLocaleString()} · {version.reason}<small>{version.title}</small></button>)}</div>
    {!versions.length && <p>No checkpoints yet. Autosave runs every two minutes while there are unsaved changes.</p>}
    {preview && <p role="status">{preview.data.title} · {preview.data.sequences.story.length} Adventure items · {preview.data.sequences.activation.length} Discovery items</p>}
    {error && <p role="alert">{error}</p>}
    <footer><button disabled={!preview || busy} onClick={async () => { if (!preview) return; setBusy(true); try { const before = current(); if (!before) throw new Error('Project is no longer open.'); const restored = await window.lessonApi.recoveryRead(folder, preview.name, before); onRestore(restored); onClose(); } catch (e) { setError(String(e)); } finally { setBusy(false); } }}>Restore checkpoint</button><button disabled={busy} onClick={onClose}>Close recovery</button></footer>
  </dialog>;
}
