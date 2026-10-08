import { copyObjects, pasteObjects, type ObjectClipboard } from '../../shared/lesson/objectClipboard';
import { previewDrawings, translateBoxes, type DrawingPreview } from '../../shared/lesson/objectSelection';
import { DrawingToolbar, type DrawingTool } from './DrawingToolbar';
import type { SceneViewport } from '../../shared/teachingScene';
import { useSceneMenus } from './SceneMenus';
import { useWorkspaceLayout } from './WorkspaceLayout';
import { useLessonMouseSafety } from './useLessonMouseSafety';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addCard, addObject, addText, duplicateEntry as duplicateSceneEntry, createScene, fitBox, insertCardSet, insertScene, layerObject, putCard, putObject, putScene, removeEntry, reorderEntry } from '../../shared/lesson/commands';
import { makeId, sceneAt, type EditorSelection, type LessonProject, type LessonProjectState, type LessonScene, type LessonSession, type Rect, type SequenceKind } from '../../shared/lesson/model';
import { cardAction, createSession, exitActivation, navigate, reconcileSession, startActivation, stepScene, resetScene, moveLiveCard, setLiveDrawings, undoLiveDrawing, redoLiveDrawing } from '../../shared/lesson/session';
import { parseLessonProject } from '../../shared/lesson/validation';
import { ProjectHistory } from '../../shared/projectHistory';
import { projectScene } from '../../shared/lesson/projection';
import { SceneSurface } from './SceneSurface';
import { SceneInspector } from './SceneInspector';
import { LessonTimeline } from './LessonTimeline';
import { LessonMediaPool, lessonMediaUrl, LESSON_ASSET_DRAG } from './LessonMediaPool';
import { LessonTeachControls } from './LessonTeachControls';
import { SceneAudioOwner } from './SceneAudioOwner';
import { audioManager } from '../audio/AudioManager';
import { AudioSettingsWorkspace } from '../audio/AudioSettingsWorkspace';
import { usePresentationMedia } from '../usePresentationMedia';
import type { PresentStatus } from '../../shared/presentStatus';
import './lessonWorkspace.css';

function LiveVideo({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { const video = ref.current; if (!video) return; video.srcObject = stream; if (stream) void video.play().catch(() => {}); return () => { video.srcObject = null; }; }, [stream]);
  return <video ref={ref} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
}
const emptySelection = (): EditorSelection => ({ sequence: 'story', entryId: null, objectId: null });

/** The single Control authority for scene-format documents. Legacy App is never mounted here. */
export function LessonApp() {
  const [file, setFile] = useState<LessonProjectState | null>(null);
  const [project, setProject] = useState<LessonProject | null>(null);
  useLessonMouseSafety(!!project);
  const layout = useWorkspaceLayout();
  const latest = useRef(project); latest.current = project;
  const history = useRef(new ProjectHistory<LessonProject>());
  const [selection, setSelection] = useState<EditorSelection>(emptySelection);
  const [multiSelection, setMultiSelection] = useState<{ entryId: string | null; ids: string[] }>({ entryId: null, ids: [] });
  const objectClipboard = useRef<ObjectClipboard | null>(null);
  const [drawingPreview, setDrawingPreview] = useState<{ key: string; value: DrawingPreview } | null>(null);
  const [facePreview, setFacePreview] = useState<{ sceneId: string; objectId: string; faceId: string } | null>(null);
  const [session, setSession] = useState<LessonSession>(createSession);
  const [mode, setMode] = useState<'edit' | 'teach'>('edit');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const operation = useRef(false);
  const [audioOpen, setAudioOpen] = useState(false), [drawing, setDrawing] = useState(false), [liveObject, setLiveObject] = useState<string | null>(null);
  const [drawTool, setDrawTool] = useState<DrawingTool>('pen'), [drawColor, setDrawColor] = useState('#ffcc33'), [drawSize, setDrawSize] = useState(6);
  const [editView, setEditView] = useState<{ sceneId: string; viewport: SceneViewport } | null>(null);
  const [presentStatus, setPresentStatus] = useState<PresentStatus | null>(null);
  const audio = useRef(new SceneAudioOwner(audioManager));
  const revision = useRef(0);
  const editScene = project ? sceneAt(project, selection) : undefined;
  const liveScene = project ? sceneAt(project, session.cursor) : undefined;
  const displayed = mode === 'edit' ? editScene : liveScene;
  const resolve = (id: string) => { const asset = project?.assets.find(item => item.id === id); return asset && lessonMediaUrl(asset.relativePath, project!.id); };
  const videoAsset = liveScene && project?.assets.find(asset => asset.id === liveScene.background.assetId && asset.mediaType === 'video');
  const media = usePresentationMedia(videoAsset ? `${project!.id}:${session.cursor!.entryId}:${session.visit}:${videoAsset.id}` : null, { enabled: true, volume: 1 }, undefined, mode === 'teach' && !!videoAsset);
  const liveKey = `${session.id}:${session.cursor?.entryId}:${session.visit}`;
  const livePlan = useMemo(() => project && liveScene ? projectScene(project, liveScene.id, session, resolve) : null, [project, liveScene, session]);
  const presentationPlan = useMemo(() => livePlan && drawingPreview?.key === liveKey ? { ...livePlan, drawings: previewDrawings(livePlan.drawings, drawingPreview.value) } : livePlan, [livePlan, drawingPreview, liveKey]);
  const editPlan = useMemo(() => {
    if (!project || !editScene) return null;
    const selected = editScene.objects.find(item => item.id === selection.objectId);
    const preview = selected?.kind === 'card' && facePreview?.sceneId === editScene.id && facePreview.objectId === selected.id ? facePreview : null;
    const editorSession: LessonSession | undefined = preview && selection.entryId ? {
      id: 'editor-preview', revision: 0, visit: 0, cursor: { sequence: selection.sequence, entryId: selection.entryId }, storyReturn: null,
      cards: { [preview.objectId]: { faceId: preview.faceId, concealed: false } }, drawings: [], viewport: editScene.viewport,
    } : undefined;
    const result = projectScene(project, editScene.id, editorSession, resolve);
    return result && editView?.sceneId === editScene.id ? { ...result, viewport: editView.viewport } : result;
  }, [project, editScene, selection.entryId, selection.sequence, selection.objectId, facePreview, editView]);
  const previewFace = useCallback((faceId: string) => {
    if (selection.objectId && editScene) setFacePreview(previous => previous?.sceneId === editScene.id && previous.objectId === selection.objectId && previous.faceId === faceId ? previous : { sceneId: editScene.id, objectId: selection.objectId!, faceId });
  }, [selection.objectId, editScene?.id]);
  useEffect(() => { setFacePreview(previous => previous?.sceneId === editScene?.id && previous?.objectId === selection.objectId ? previous : null); }, [editScene?.id, selection.objectId]);
  const plan = mode === 'edit' ? editPlan : livePlan;
  const dirty = history.current.isDirty;
  const currentSequence = mode === 'edit' ? selection.sequence : session.cursor?.sequence ?? selection.sequence;
  const selectedIds = multiSelection.entryId === selection.entryId && multiSelection.ids.includes(selection.objectId ?? '') ? multiSelection.ids.filter(id => editScene?.objects.some(o => o.id === id)) : selection.objectId ? [selection.objectId] : [];
  const selectMany = (ids: string[]) => { setMultiSelection({ entryId: selection.entryId, ids }); setSelection(old => ({ ...old, objectId: ids[0] ?? null })); };
  const object = editScene?.objects.find(item => item.id === selection.objectId);

  const editCommand = (work: () => void) => { try { work(); } catch (reason) { setError(String(reason)); } };

  const apply = (value: LessonProject) => { if (operation.current || value === latest.current) return; history.current.record(value); latest.current = value; setProject(value); setSession(old => reconcileSession(value, old)); };
  const changeScene = (scene: LessonScene) => {
    if (!project) return;
    apply(putScene(project, { ...scene, objects: scene.objects.map(item => ({ ...item, box: fitBox(item.box, scene.frame) })) }));
  };
  const historyStep = (direction: 'undo' | 'redo') => {
    if (operation.current) return; const value = history.current[direction](); if (!value) return;
    latest.current = value; setProject(value); setSession(old => reconcileSession(value, old));
  };
  const removeSelected = () => { if (project && editScene && selectedIds.length) { changeScene({ ...editScene, objects: editScene.objects.filter(o => !selectedIds.includes(o.id)) }); selectMany([]); } };
  const copySelected = () => { if (project && editScene && selectedIds.length) { objectClipboard.current = copyObjects(project, editScene.id, selectedIds); setNotice(`${selectedIds.length} object${selectedIds.length === 1 ? '' : 's'} copied.`); } };
  const pasteSelected = () => editCommand(() => {
    const copied = objectClipboard.current; if (!project || !editScene || !copied || copied.projectId !== project.id) return;
    const result = pasteObjects(project, editScene.id, copied); apply(result.project); selectMany(result.objectIds);
  });
  const duplicateSelected = () => { if (!selectedIds.length) return; copySelected(); pasteSelected(); };
  const changeGeometries = (changes: { id: string; box: Rect }[]) => { if (editScene && changes.length) changeScene({ ...editScene, objects: editScene.objects.map(o => { const change = changes.find(c => c.id === o.id); return change ? { ...o, box: change.box } : o; }) }); };
  const menus = useSceneMenus({ project, scene: editScene, selection, mode, apply, select: value => { setMultiSelection({ entryId: value.entryId, ids: value.objectId ? [value.objectId] : [] }); setSelection(value); }, copySelection: copySelected, pasteSelection: pasteSelected, canPasteSelection: objectClipboard.current?.projectId === project?.id, setNotice, setError, add: kind => add(kind), duplicate: duplicateSelected, remove: removeSelected,
    navigate: direction => project && setSession(old => stepScene(project, old, direction)), reset: () => project && setSession(old => resetScene(project, old)),
    chooseTool: tool => { if (tool === 'navigate') setDrawing(false); else { setDrawTool(tool); setDrawing(true); } }, importImages: () => importMedia('files') });
  const updateView = (viewport: SceneViewport) => mode === 'edit' && editScene ? setEditView({ sceneId: editScene.id, viewport }) : setSession(old => ({ ...old, viewport, revision: old.revision + 1 }));
  const clearDrawing = () => { if (!window.confirm('Clear this scene drawing? You can undo this action.')) return; if (mode === 'edit' && editScene) changeScene({ ...editScene, drawings: [] }); else setSession(old => setLiveDrawings(old, [])); };
  useEffect(() => {
    void audioManager.initializeFromAppSettings(window.appApi).catch(reason => setError(String(reason)));
    const unsubscribe = window.appApi.onPresentStatus(setPresentStatus);
    void window.appApi.getPresentStatus().then(setPresentStatus);
    return () => { unsubscribe(); audio.current.stop(); };
  }, []);
  useEffect(() => {
    const snapshot = { sessionId: session.id, revision: ++revision.current, target: presentationPlan
      ? { kind: 'scene' as const, occurrenceId: `${session.cursor!.entryId}:${session.visit}`, plan: presentationPlan, ...(media.intent && videoAsset ? { media: media.intent } : {}) }
      : { kind: 'empty' as const, occurrenceId: 'empty' } };
    void window.appApi.publishPresentSnapshot(snapshot).then(ok => { if (!ok) setError('The presentation rejected this scene. Your authored changes are still available.'); }).catch(reason => setError(String(reason)));
  }, [presentationPlan, session.id, JSON.stringify(media.intent)]);
  useEffect(() => {
    const owner = audio.current;
    if (mode === 'teach' && liveScene) void owner.play(liveScene.audio.filter(track => track.autoplay), resolve).catch(reason => setError(String(reason)));
    else owner.stop();
    return () => owner.stop();
  }, [mode, session.visit, project?.id, JSON.stringify(liveScene?.audio)]);
  useEffect(() => {
    return window.appApi.onRequestClose(() => { if (!history.current.isDirty || window.confirm('Discard unsaved lesson changes and close?')) window.appApi.forceClose(); });
  }, []);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented || (event.target as HTMLElement)?.closest?.('[role="dialog"], [role="menu"], form')) return;
      const tag = (event.target as HTMLElement)?.tagName;
      if (['INPUT','TEXTAREA','SELECT'].includes(tag) || (event.target as HTMLElement)?.isContentEditable) return;
      const command = event.ctrlKey || event.metaKey, key = event.key.toLowerCase();
      if (command && key === 's') { event.preventDefault(); void save('save'); return; }
      if (command && (key === 'z' || key === 'y')) { event.preventDefault(); const redo = key === 'y' || event.shiftKey; if (mode === 'edit') historyStep(redo ? 'redo' : 'undo'); else setSession(redo ? redoLiveDrawing : undoLiveDrawing); return; }
      if ((event.target as HTMLElement)?.closest?.('.lesson-timeline, .lesson-pool')) return;
      if ((event.target as HTMLElement)?.closest?.('button, [role="button"], a') && !(event.target as HTMLElement)?.closest?.('.lesson-object-hit')) return;
      if (event.ctrlKey || event.metaKey) {
        if (event.key.toLowerCase() === 'c' && mode === 'edit') { event.preventDefault(); copySelected(); }
        if (event.key.toLowerCase() === 'x' && mode === 'edit') { event.preventDefault(); copySelected(); removeSelected(); }
        if (event.key.toLowerCase() === 'a' && mode === 'edit' && editScene) { event.preventDefault(); selectMany(editScene.objects.filter(o => o.visible).map(o => o.id)); }
        if (event.key.toLowerCase() === 'v' && mode === 'edit') { event.preventDefault(); pasteSelected(); }
        if (event.key.toLowerCase() === 'd' && mode === 'edit') { event.preventDefault(); duplicateSelected(); }
      } else if (mode === 'edit' && event.key === 'Escape') { selectMany([]); setDrawing(false); }
      else if (mode === 'edit' && editScene && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); const step = event.shiftKey ? 10 : 1; changeGeometries(translateBoxes(editScene.objects.filter(o => selectedIds.includes(o.id)), event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0, event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0, editScene.frame)); }
      else if (mode === 'edit' && ['Delete','Backspace'].includes(event.key)) { event.preventDefault(); removeSelected(); }
      else if (mode === 'teach' && project && ['ArrowRight','ArrowLeft'].includes(event.key)) { event.preventDefault(); setSession(old => stepScene(project, old, event.key === 'ArrowRight' ? 1 : -1)); }
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  });
  const run = async (work: () => Promise<void>) => { if (operation.current) return; operation.current = true; setBusy(true); setError(''); try { await work(); } catch (reason) { setError(String(reason)); } finally { operation.current = false; setBusy(false); } };
  const load = (kind: 'new' | 'open') => run(async () => {
    if (history.current.isDirty && !window.confirm('Discard unsaved changes and continue?')) return;
    const candidate = kind === 'new' ? await window.lessonApi.createProject() : await window.lessonApi.openProject(); if (!candidate) return;
    const data = parseLessonProject(candidate.data);
    await media.revoke(); audio.current.stop(); window.lessonApi.activateProject(candidate.activationToken);
    history.current.reset(data); latest.current = data; setProject(data); setFile(candidate); setSession(createSession()); setMode('edit'); setDrawing(false); setEditView(null);
    setSelection({ sequence: 'story', entryId: data.sequences.story[0]?.id ?? null, objectId: null }); setNotice(kind === 'new' ? 'Import media or add a blank scene to begin.' : 'Lesson opened.');
  });
  const save = (saveMode: 'save' | 'saveAs') => run(async () => {
    if (!project || !file) return;
    const written = project; parseLessonProject(written);
    const saved = await window.lessonApi.saveProject(written, saveMode, file.folderPath); if (!saved) return;
    history.current.markSaved(written); setFile({ ...file, ...saved, data: written }); setNotice('Lesson saved.');
  });
  const importMedia = async (kind: 'files' | 'folder' | 'drop', paths?: string[]) => {
    await run(async () => {
      if (!project) return;
      const imported = kind === 'files' ? await window.appApi.importMedia() : kind === 'folder' ? await window.appApi.importMediaFolder() : await window.appApi.importDroppedMedia(paths ?? []);
      if (!imported) return;
      const current = latest.current; if (!current || current.id !== project.id) return;
      const next = { ...current, assets: [...current.assets, ...imported.importedAssets], mediaBins: [...current.mediaBins, ...(imported.importedBins ?? [])] };
      parseLessonProject(next);
      history.current.record(next); latest.current = next; setProject(next);
      setNotice(`${imported.importedAssets.length} media files imported. Select media to add scenes.`);
      if (imported.failures?.length) setError(imported.failures.map(failure => `${failure.name}: ${failure.reason}`).join('\n'));
    });
  };
  const addScenes = (assetIds?: string[], beforeEntryId?: string) => editCommand(() => {
    if (!project || busy) return; let next = project; let entryId: string | null = null;
    const assets = assetIds?.map(id => project.assets.find(asset => asset.id === id)).filter(asset => asset && asset.mediaType !== 'audio');
    if (assetIds && !assets?.length) return;
    for (const asset of assets?.length ? assets : [undefined]) {
      const result = insertScene(next, selection.sequence, createScene(asset?.originalName ?? 'New scene', asset?.id), beforeEntryId); next = result.project; entryId = result.entryId;
    }
    apply(next); setSelection(old => ({ ...old, entryId, objectId: null }));
  });
  const add = (kind: 'card' | 'text' | 'bubble') => editCommand(() => {
    if (!project || !editScene) return;
    const result = kind === 'card' ? addCard(project, editScene.id) : addText(project, editScene.id, kind);
    apply(result.project); setSelection(old => ({ ...old, objectId: result.objectId }));
  });
  const selectPhase = (sequence: SequenceKind) => {
    setDrawing(false); if (!project) return;
    if (mode === 'edit') setSelection({ sequence, entryId: project.sequences[sequence][0]?.id ?? null, objectId: null });
    else setSession(old => sequence === 'activation' ? startActivation(project, old) : exitActivation(project, old));
  };
  const teach = () => {
    if (!project) return; setMode('teach'); setDrawing(false);
    if (!session.cursor && selection.entryId) setSession(old => navigate(project, old, { sequence: selection.sequence, entryId: selection.entryId! }));
  };
  const openPresent = () => run(async () => {
    if (project && selection.entryId && mode === 'edit') setSession(old => navigate(project, old, { sequence: selection.sequence, entryId: selection.entryId! }));
    await window.appApi.openPresent();
  });
  const duplicateEntry = (entryId: string, linked: boolean, destination = selection.sequence) => editCommand(() => {
    if (!project) return; const entry = project.sequences[selection.sequence].find(item => item.id === entryId); if (!entry) return;
    const result = duplicateSceneEntry(project, selection.sequence, entryId, destination, linked); apply(result.project); setSelection({ sequence: destination, entryId: result.entryId, objectId: null });
  });
  return <div className="lesson-app">
    <header className="lesson-header"><strong>Story Studio</strong><span className="lesson-project-title">{project?.title ?? 'Lesson studio'}{dirty ? ' • Unsaved' : ''}</span>
      <div className="lesson-toolbar"><button disabled={busy} onClick={() => void load('new')}>New project</button><button disabled={busy} onClick={() => void load('open')}>Open project</button><button disabled={busy || !project || !dirty} onClick={() => void save('save')}>Save</button><button disabled={busy || !project} onClick={() => void save('saveAs')}>Save as</button><button onClick={() => setAudioOpen(true)}>Audio settings</button></div>
      <div className="lesson-toolbar"><button aria-pressed={mode === 'edit'} onClick={() => { setMode('edit'); setDrawing(false); void media.command('pause'); }}>Edit</button><button disabled={!project} aria-pressed={mode === 'teach'} onClick={teach}>Teach</button><button disabled={!project || busy} onClick={() => void openPresent()}>Open Present</button></div>
    </header>
    {error && <div className="lesson-error" role="alert">{error}<button onClick={() => setError('')}>Dismiss</button></div>}
    {!project ? <main className="lesson-welcome"><h1>A lesson, from Story to Activation.</h1><p>Create a project, import your media, then add cards and bubbles directly to the scene.</p><div className="lesson-toolbar"><button onClick={() => void load('new')} disabled={busy}>Create a new lesson</button><button onClick={() => void load('open')} disabled={busy}>Open a scene lesson</button></div><details><summary>Earlier projects</summary><p>Episodes created with the previous editor open in Legacy mode. Scene lessons use a separate format.</p><button onClick={() => { window.location.search = '?legacy=1'; }}>Open Legacy mode</button></details></main> : <>
      <nav className="lesson-phase-tabs" aria-label="Lesson phases"><button aria-pressed={currentSequence === 'story'} onClick={() => selectPhase('story')}>Story</button><button aria-pressed={currentSequence === 'activation'} onClick={() => selectPhase('activation')}>Activation</button><button disabled title="Planned for a future version">Language · Coming later</button><button disabled title="Planned for a future version">Final Boss · Coming later</button><span>{mode === 'edit' ? 'Edit' : 'Live'} / {currentSequence === 'story' ? 'Story' : 'Activation'} / {displayed?.title ?? 'Choose a scene'}</span></nav>
      <div className="lesson-workspace" style={layout.style}>
        <main className="lesson-main">
          {mode === 'edit' && <LessonMediaPool project={project} onImport={importMedia} onInsert={addScenes} onChange={apply} />}
          {mode === 'edit' && layout.splitter('pool')}
          <div className="lesson-toolbar lesson-canvas-tools">
            {mode === 'edit' ? <><button onClick={() => addScenes()}>Add scene</button><button disabled={!editScene} onClick={() => add('card')}>Add Card</button><button disabled={!editScene} onClick={() => add('bubble')}>Add Bubble</button><button disabled={!editScene} onClick={() => add('text')}>Add Text</button><button disabled={!editScene} aria-pressed={drawing} onClick={() => setDrawing(!drawing)}>Draw</button><button disabled={!object} onClick={duplicateSelected}>Duplicate</button><button disabled={!object} onClick={removeSelected}>Delete</button><button disabled={!history.current.canUndo || busy} onClick={() => historyStep('undo')}>Undo</button><button disabled={!history.current.canRedo || busy} onClick={() => historyStep('redo')}>Redo</button><button disabled={!editScene} onClick={() => { if (selection.entryId) setSession(old => navigate(project, old, { sequence: selection.sequence, entryId: selection.entryId! })); }}>Show in Present</button></>
              : <><button onClick={() => setSession(old => stepScene(project, old, -1))}>Previous scene</button><button onClick={() => setSession(old => stepScene(project, old, 1))}>Next scene</button>{session.cursor?.sequence === 'activation' ? <button onClick={() => setSession(old => exitActivation(project, old))}>Return to Story</button> : <button disabled={!project.sequences.activation.length} onClick={() => setSession(old => startActivation(project, old))}>Start Activation</button>}<button onClick={() => setSession(old => resetScene(project, old))}>Reset scene</button><button onClick={() => { if (window.confirm('Start a fresh teaching session? Temporary Card states and drawings will reset.')) setSession(navigate(project, createSession(), session.cursor)); }}>New teaching session</button></>}
          </div>
          <div className="lesson-drawing-row">{drawing && <DrawingToolbar active={drawing} tool={drawTool} color={drawColor} size={drawSize} onActive={setDrawing} onTool={setDrawTool} onColor={setDrawColor} onSize={setDrawSize}
            onUndo={() => mode === 'edit' ? historyStep('undo') : setSession(undoLiveDrawing)} onRedo={() => mode === 'edit' ? historyStep('redo') : setSession(redoLiveDrawing)} onClear={clearDrawing}
            canUndo={mode === 'edit' ? history.current.canUndo : !!session.drawingUndo?.length} canRedo={mode === 'edit' ? history.current.canRedo : !!session.drawingRedo?.length} />}
            {mode === 'edit' && plan && <div className="lesson-toolbar lesson-edit-view"><label>Canvas zoom<input aria-label="Canvas zoom" type="range" min="1" max="4" step=".1" value={plan.viewport.zoom} onChange={event => updateView({ ...plan.viewport, zoom: Number(event.target.value) })} /></label><button onClick={() => updateView({ zoom: 1, pan: { x: 0, y: 0 } })}>Reset view</button></div>}
          </div>
          <div className="lesson-canvas" aria-label={mode === 'edit' ? 'Edit canvas' : 'Live preview'} onDragOver={e => { if (mode === 'edit') e.preventDefault(); }} onDrop={e => {
            if (mode !== 'edit' || !editScene) return; e.preventDefault();
            const payload = e.dataTransfer.getData(LESSON_ASSET_DRAG); if (!payload) return;
            editCommand(() => { const ids = JSON.parse(payload) as string[]; let next = project; for (const id of ids) if (project.assets.some(asset => asset.id === id && asset.mediaType === 'image')) next = addObject(next, editScene.id, { id: makeId(), kind: 'image', assetId: id, visible: true, box: { x: 60, y: 60, width: 400, height: 300 } }); apply(next); });
          }}>
            {plan ? <SceneSurface plan={plan} surface={mode} selectedObjectId={mode === 'edit' ? selection.objectId ?? undefined : liveObject ?? undefined}
              selectedObjectIds={mode === 'edit' ? selectedIds : undefined} onSelectMany={mode === 'edit' ? selectMany : undefined} onGeometryChanges={changeGeometries}
              onDrawingPreview={value => { if (mode === 'teach') setDrawingPreview(value ? { key: liveKey, value } : null); }}
              onSelect={id => mode === 'edit' ? selectMany(id ? [id] : []) : setLiveObject(id)}
              onGeometryChange={mode === 'edit' ? (id, box) => { const item = editScene?.objects.find(o => o.id === id); if (item && editScene) apply(putObject(project, editScene.id, { ...item, box })); } : (id, box) => setSession(old => moveLiveCard(project, old, id, box))}
              onViewportChange={updateView} onContextMenu={menus.openContext} onCardDrop={menus.dropCard} occurrenceKey={mode === 'edit' ? selection.entryId ?? '' : liveKey}
              erasableStrokeIds={mode === 'teach' ? session.drawings.map(stroke => stroke.id) : undefined} drawingTool={drawTool} drawColor={drawColor} drawSize={drawSize}
              onErase={ids => mode === 'edit' && editScene ? changeScene({ ...editScene, drawings: editScene.drawings.filter(stroke => !ids.includes(stroke.id)) }) : setSession(old => setLiveDrawings(old, old.drawings.filter(stroke => !ids.includes(stroke.id))))}
              onInteract={id => { setLiveObject(id); setSession(old => cardAction(project, old, id, 'interact')); }}
              video={mode === 'teach' && videoAsset ? <LiveVideo stream={media.previewStream} /> : undefined}
              drawing={drawing} onDraw={stroke => mode === 'edit' && editScene ? changeScene({ ...editScene, drawings: [...editScene.drawings, stroke] }) : setSession(old => setLiveDrawings(old, [...old.drawings, stroke]))} />
              : <div className="lesson-empty"><h2>{mode === 'edit' ? 'Build your sequence' : 'Choose a scene to teach'}</h2><p>{mode === 'edit' ? 'Import media and drag it into the timeline, or add a blank scene.' : 'Select a scene in the timeline below.'}</p></div>}
          </div>
          {mode === 'teach' && videoAsset && <div className="lesson-toolbar"><button onClick={() => void media.command('play')}>Play video</button><button onClick={() => void media.command('pause')}>Pause video</button><button onClick={() => void media.command('replay')}>Replay video</button><label>Video position<input aria-label="Video position" type="range" min="0" max={media.status?.durationSec || 1} step=".1" value={media.status?.positionSec ?? 0} onChange={e => void media.command('seek', Number(e.target.value))} /></label><span>{media.error ?? (media.available ? media.status?.state ?? 'Ready' : 'Open Present to play video')}</span></div>}
          {layout.splitter('timeline')}
          <LessonTimeline onHistory={historyStep} onProjectChange={apply} project={project} sequence={currentSequence} selectedEntryId={mode === 'edit' ? selection.entryId : session.cursor?.entryId ?? null} live={session.cursor} readOnly={mode === 'teach'}
            onSelect={entryId => { if (mode === 'edit') setSelection(old => ({ ...old, entryId, objectId: null })); else setSession(old => navigate(project, old, { sequence: currentSequence, entryId })); }} onAdd={addScenes}
            onReorder={(id, before) => apply(reorderEntry(project, selection.sequence, id, before))}
            onDelete={id => { const next = removeEntry(project, selection.sequence, id); apply(next); setSelection(old => ({ ...old, entryId: next.sequences[old.sequence][0]?.id ?? null, objectId: null })); }}
            onCopy={duplicateEntry} onCopyToActivation={(id, linked) => duplicateEntry(id, linked, 'activation')} onSection={(id, section) => apply({ ...project, sequences: { ...project.sequences, [selection.sequence]: project.sequences[selection.sequence].map(entry => entry.id === id ? { ...entry, section } : entry) } })} />
        </main>
        {layout.splitter('inspector')}
        {mode === 'edit' ? <div className="lesson-side"><label>Lesson title<input value={project.title} onChange={e => apply({ ...project, title: e.target.value })} /></label>
          {editScene && Object.values(project.sequences).flat().filter(entry => entry.sceneId === editScene.id).length > 1 && <p className="lesson-shared-note">Shared scene: changes appear wherever this scene is reused. Use an independent copy to edit separately.</p>}
          <SceneInspector project={project} scene={editScene} object={object} onSelectObject={id => selectMany(id ? [id] : [])} onPreviewFace={previewFace} onSceneChange={changeScene} onObjectChange={item => editScene && apply(putObject(project, editScene.id, item))} onCardChange={card => apply(putCard(project, card))} onDelete={removeSelected} onDuplicate={duplicateSelected} onLayer={direction => editScene && object && apply(layerObject(project, editScene.id, object.id, direction))}
            onSaveSet={set => apply({ ...project, cardSets: [...project.cardSets.filter(item => item.id !== set.id), set] })}
            onInsertSet={id => { if (!editScene) return; try { const result = insertCardSet(project, editScene.id, id); apply(result.project); setSelection(old => ({ ...old, objectId: result.objectIds[0] ?? null })); } catch (reason) { setError(String(reason)); } }}
            onLibrarySave={() => object?.kind === 'card' && apply({ ...project, library: [...new Set([...project.library, object.cardId])] })}
            onLibraryInsert={(id, linked) => editCommand(() => { if (!editScene) return; const result = addCard(project, editScene.id, id, linked); apply(result.project); setSelection(old => ({ ...old, objectId: result.objectId })); })} />
        </div> : <LessonTeachControls project={project} scene={liveScene} session={session} onSession={setSession} selectedId={liveObject} onSelect={setLiveObject} drawing={drawing} onDrawing={setDrawing} onPlayAudio={() => { if (liveScene) void audio.current.play(liveScene.audio, resolve).catch(reason => setError(String(reason))); }} onStopAudio={() => audio.current.stop()} />}
      </div>
    </>}
    {menus.content}
    <footer className="lesson-status"><span>{busy ? 'Working…' : notice || (dirty ? 'Unsaved changes' : 'Saved')}</span><span>Present: {presentStatus ? ('state' in presentStatus ? String(presentStatus.state) : 'Connected') : 'Closed'}</span><span>{file?.folderPath}</span></footer>
    <AudioSettingsWorkspace open={audioOpen} onClose={() => setAudioOpen(false)} />
  </div>;
}
