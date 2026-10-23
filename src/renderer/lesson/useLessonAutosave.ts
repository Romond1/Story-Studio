import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { LessonProject, LessonProjectState } from '../../shared/lesson/model';
import type { ProjectHistory } from '../../shared/projectHistory';

interface AutosaveOptions {
  file: LessonProjectState | null; paused?: boolean;
  latest: { current: LessonProject | null };
  history: { current: ProjectHistory<LessonProject> };
  operation: { current: boolean };
  flushEditor: () => Promise<void>;
  setFile: Dispatch<SetStateAction<LessonProjectState | null>>;
  setError: (message: string) => void;
}
export function useLessonAutosave(options: AutosaveOptions) {
  const state = useRef(options); state.current = options;
  const pending = useRef<Promise<void> | null>(null);
  const [status, setStatus] = useState('Autosave every 2 min');
  useEffect(() => {
    setStatus('Autosave every 2 min');
    const timer = window.setInterval(() => {
      const current = state.current, file = current.file;
      if (!file || !current.latest.current || current.paused || current.operation.current || pending.current) return;
      setStatus('Autosaving…');
      pending.current = (async () => {
        try {
          await current.flushEditor();
          if (state.current.file?.activationToken !== file.activationToken || state.current.file?.folderPath !== file.folderPath) return;
          const written = current.latest.current;
          if (!written || !current.history.current.isDirty) { setStatus('Autosave every 2 min'); return; }
          const saved = await window.lessonApi.autosave(written, file.folderPath);
          if (state.current.file?.activationToken !== file.activationToken || state.current.file?.folderPath !== file.folderPath) return;
          current.history.current.markSaved(written);
          current.setFile(previous => previous?.activationToken === file.activationToken ? { ...previous, ...saved, data: written } : previous);
          setStatus(`Autosaved ${new Date(saved.lastSavedAt).toLocaleTimeString()}`);
        } catch (cause) {
          setStatus('Autosave failed'); current.setError(`Autosave failed: ${String(cause)}. Your edits remain in memory; retry Save.`);
        } finally { pending.current = null; }
      })();
    }, 120000);
    return () => window.clearInterval(timer);
  }, [options.file?.activationToken, options.file?.folderPath]);
  return { pending, status };
}
