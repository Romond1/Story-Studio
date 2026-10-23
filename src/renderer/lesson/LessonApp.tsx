import { useLiveAudioLevels } from './useLiveAudioLevels';
import { lessonShortcut } from '../../shared/keyboardShortcuts';
import { useSectionMusic } from './useSectionMusic';
import { SectionMusicControls } from './SectionMusicControls';
import { useLessonAutosave } from './useLessonAutosave';
import { LessonRecoveryDialog } from './LessonRecoveryDialog';
import { restoreEditorSelection } from '../../shared/lesson/editorSelection';
import { addReviewMedia } from '../../shared/lesson/sections';
import { BreakAudioControls } from './BreakReviewTools';
import { mediaDisplayTitle } from '../../shared/mediaDisplayName';
import { EpisodeContentPanel } from '../episode/EpisodeContentPanel';
import {createDash,dashProjection,dashAction,type DashState} from '../../shared/heroDash';
import {HeroDashControl} from '../games/heroDash/HeroDashControl';
import { CameraControls } from '../camera/CameraControls';
import { TranslationControls } from '../translation/TranslationControls';

import { createModuleTemplate } from '../../shared/modules/templates';
import { AdventureDefinitionEditor } from '../episode/AdventureDefinitionEditor';
import { ProgressionPanel } from '../episode/ProgressionPanel';
import { StudentsWorkspace } from '../students/StudentsWorkspace';
import type { StudentClass, StudentSnapshot } from '../../shared/students/model';
import { TeachRoster } from '../students/TeachRoster';
import { GroupRewardControls } from '../students/GroupRewardControls';
import type { GroupRewardPlan } from '../../shared/students/groupRewards';
import type { ProgressionState } from '../../shared/progression/model';
import { projectRosterPresentation } from '../../shared/students/rosterPresentation';
import { EpisodeActivities } from '../episode/EpisodeActivities';
import { ActivationActivities } from '../episode/ActivationActivities';
import { useEpisodeModuleHost } from '../episode/useEpisodeModuleHost';
import { putEpisodeActivity, putActivityOccurrence } from '../../shared/episode/commands';
import type { EpisodeActivity, RunContext, ActivityEvent } from '../../shared/modules/model';
import type { StudentRosterEntry } from '../../shared/types';
import { useDerivedMedia } from '../episode/useDerivedMedia';
import { useMediaRegistry } from '../useMediaRegistry';
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
import { parseSceneDocument } from '../../shared/lesson/validation';
import { ProjectHistory } from '../../shared/projectHistory';
import { projectScene } from '../../shared/lesson/projection';
import { SceneSurface, EditSceneVideo } from './SceneSurface';
import { SceneVideoTrimControls } from './SceneVideoTrimControls';
import { updateSceneVideoTrim } from '../../shared/lessonVideoTrim';
import { SceneInspector } from './SceneInspector';
import { LessonTimeline } from './LessonTimeline';
import { LessonMediaPool, LESSON_ASSET_DRAG } from './LessonMediaPool';
import { LessonTeachControls } from './LessonTeachControls';
import { SceneAudioOwner } from './SceneAudioOwner';
import { audioManager } from '../audio/AudioManager';
import { AudioSettingsWorkspace } from '../audio/AudioSettingsWorkspace';
import { usePresentationMedia } from '../usePresentationMedia';
import type { PresentStatus } from '../../shared/presentStatus';
import './lessonWorkspace.css';
import { Beginning } from '../Beginning';
import storyIcon from '../../../assets/Splash Screen/Story.png';
import activationIcon from '../../../assets/Splash Screen/Activation.png';
import { mergeLessonMediaImport } from '../../shared/lesson/mediaImport';
import type { EditorOperation, EditorResult } from '../../shared/modules/protocol';
import { GameHost } from '../games/GameHost';
import { getGamesForSection, type GameSection, type GameSession } from '../../shared/gameHost';

function LiveVideo({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { const video = ref.current; if (!video) return; video.srcObject = stream; if (stream) void video.play().catch(() => {}); return () => { video.srcObject = null; }; }, [stream]);
  return <video ref={ref} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
}
const emptySelection = (): EditorSelection => ({ sequence: 'story', entryId: null, objectId: null });

/** The single Control authority for scene-format documents. Legacy App is never mounted here. */
export function LessonApp() {
  const [beginning, setBeginning] = useState(true);
  const [gameSection, setGameSection] = useState<GameSection | null>(null);
  const [activeGame, setActiveGame] = useState<GameSession | null>(null);
  const [dash,setDash]=useState<DashState>(()=>createDash());
  useEffect(()=>window.appApi.onDashZoom?.(packet=>{if(activeGameRef.current?.gameId==='hero-dash'&&activeGameRef.current.instanceId===packet.instanceId)setDash(state=>dashAction(state,{type:'zoom',zoom:packet.zoom}));}),[]);
  const activeGameRef = useRef(activeGame); activeGameRef.current = activeGame;
  const [gameNotice, setGameNotice] = useState('');
  const gameLaunch = useRef(false);
  const gameMediaReturn = useRef<{ identity: string; position: number } | null>(null);
  const gameMediaSuspended = useRef(false);
  const [entrySequence, setEntrySequence] = useState<SequenceKind>('story');
  const [activeBinId, setActiveBinId] = useState('');
  const [file, setFile] = useState<LessonProjectState | null>(null);
  const [project, setProject] = useState<LessonProject | null>(null);
  const [editVideo, setEditVideo] = useState<HTMLVideoElement | null>(null);
  const [autoplayVideos, setAutoplayVideos] = useState(() => { try { return localStorage.getItem('story-studio.video-autoplay.v1') === 'true'; } catch { return false; } });
  useLessonMouseSafety(!!project);
  const layout = useWorkspaceLayout();
  const latest = useRef(project); latest.current = project;
  const history = useRef(new ProjectHistory<LessonProject>());
  const [selectedActivityId, setSelectedActivityId] = useState('');
  const [participants, setParticipants] = useState<string[]>([]);
  const [roster, setRoster] = useState<StudentRosterEntry[]>([]);
  const [classes, setClasses] = useState<StudentClass[]>([]);
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const classIdentity = useRef<string | null>(null);
  const applyStudents = (value: StudentSnapshot) => {
    const active = value.studentRoster.filter(student => !student.archived);
    setRoster(active);setClasses(value.classes);setActiveClassId(value.activeClassId);
    if(classIdentity.current !== value.activeClassId){classIdentity.current=value.activeClassId;const group=value.classes.find(item=>item.id===value.activeClassId);setParticipants(group?.studentIds.filter(id=>active.some(student=>student.id===id))??[]);}
    else setParticipants(old=>old.filter(id=>id.startsWith('guest:')||active.some(student=>student.id===id)));
  };
  const [studentsOpen, setStudentsOpen] = useState(false);
  const [studentsView, setStudentsView] = useState<'profiles'|'hero'>('profiles');
  const [detailsStudentId,setDetailsStudentId]=useState('');
  const [rosterVisible,setRosterVisible]=useState(false),[rosterPosition,setRosterPosition]=useState<'top'|'bottom'>('bottom');
  const [showScores,setShowScores]=useState(false),[showRewards,setShowRewards]=useState(false),[showRelics,setShowRelics]=useState(false);
  const [rosterProgress,setRosterProgress]=useState<ProgressionState|null>(null);
  const groupRewardPlans=useRef(new Map<string,GroupRewardPlan>());
  const [activationPaused, setActivationPaused] = useState(false);
  const activationVideoPlaying = useRef(false);
  const [selection, setSelection] = useState<EditorSelection>(emptySelection);
  const [multiSelection, setMultiSelection] = useState<{ entryId: string | null; ids: string[] }>({ entryId: null, ids: [] });
  const objectClipboard = useRef<ObjectClipboard | null>(null);
  const [drawingPreview, setDrawingPreview] = useState<{ key: string; value: DrawingPreview } | null>(null);
  const [facePreview, setFacePreview] = useState<{ sceneId: string; objectId: string; faceId: string } | null>(null);
  const [session, setSession] = useState<LessonSession>(createSession);
  const [mode, setMode] = useState<'edit' | 'teach'>('edit');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const operation = useRef(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const autosave = useLessonAutosave({ file, latest, history, operation, setFile, setError, paused: recoveryOpen, flushEditor: async () => { if (hosted.isActive) await hosted.flush(); } });
  const selectionHistory = useRef(new WeakMap<LessonProject, EditorSelection>());
  const inputHistoryGroup = useRef<{ target: Element; group: object; at: number } | null>(null);
  useEffect(() => { const boundary = (event: Event) => { if ((event.target as Element)?.matches?.('input,textarea')) { inputHistoryGroup.current = null; history.current.breakGroup(); } }; window.addEventListener('focusout', boundary); window.addEventListener('pointerup', boundary); return () => { window.removeEventListener('focusout', boundary); window.removeEventListener('pointerup', boundary); }; }, []);
  const [audioOpen, setAudioOpen] = useState(false), [drawing, setDrawing] = useState(false), [liveObject, setLiveObject] = useState<string | null>(null);
  const [drawTool, setDrawTool] = useState<DrawingTool>('pen'), [drawColor, setDrawColor] = useState('#ffcc33'), [drawSize, setDrawSize] = useState(6);
  const [drawRainbow, setDrawRainbow] = useState(false), [drawFadeMs, setDrawFadeMs] = useState(0);
  const [editView, setEditView] = useState<{ sceneId: string; viewport: SceneViewport } | null>(null);
  const [presentStatus, setPresentStatus] = useState<PresentStatus | null>(null);
  const audio = useRef(new SceneAudioOwner(audioManager));
  const revision = useRef(0);
  const [progressionRevision, setProgressionRevision] = useState(0);
  const progressionChanged = () => setProgressionRevision(value => value + 1);
  useEffect(()=>{let live=true;void window.appApi.progression.getSnapshot().then(value=>{if(live)setRosterProgress(value);}).catch(reason=>{if(live)setError(String(reason));});return()=>{live=false;};},[progressionRevision,project?.format==='story-studio-episode'?project.adventure.id:null]);
  const rosterProjection=useMemo(()=>{if(!rosterVisible||beginning)return undefined;const value=projectRosterPresentation({roster,participantIds:participants,progression:rosterProgress,adventureId:project?.format==='story-studio-episode'?project.adventure.id:undefined,sessionId:session.id,position:rosterPosition,showScores,showRewards,showRelics});return value.entries.length?value:undefined;},[rosterVisible,beginning,roster,participants,rosterProgress,project,session.id,rosterPosition,showScores,showRewards,showRelics]);
  const hosted = useEpisodeModuleHost(() => latest.current, value => { history.current.record(value); latest.current = value; setProject(value); }, progressionChanged, handleHostedEditor);
  const registerRun = async (context: RunContext, activity: EpisodeActivity) => {
    const current = latest.current;
    if (current?.format !== 'story-studio-episode' || !file) throw new Error('Open an episode before starting an activity.');
    const result = await window.appApi.progression.registerRun({ expectedFolder: file.folderPath, activityId: activity.id, context, moduleType: activity.moduleType, ...(current.adventureDefinition ? { adventureDefinition: current.adventureDefinition } : {}), ...(activity.rewardBindings ? { rewardBindings: activity.rewardBindings } : {}) });
    if (!result.accepted) throw new Error(result.reason ?? 'Core could not register this activity.');
  };
  const recordActivation = async (event: ActivityEvent) => {
    if (event.type !== 'activity-completed') throw new Error('Unsupported Activation result.');
    const result = await window.appApi.progression.completeActivation({ commandId: event.eventId, runId: event.context.runId, outcome: event.payload.outcome });
    if (result.accepted) { progressionChanged(); setNotice(`Activation completed for ${event.context.participantIds.length} participants. Result recorded for this session.`); }
    return result;
  };
  const editScene = project ? sceneAt(project, selection) : undefined;
  const liveScene = project ? sceneAt(project, session.cursor) : undefined;
  const displayed = mode === 'edit' ? editScene : liveScene;
  const mediaRegistry = useMediaRegistry(project ? { format: 'scene', data: project } : null, file?.folderPath ?? null, file?.activationToken, [displayed?.background.assetId, liveScene?.background.assetId].filter((id):id is string=>!!id));
  const derivedMedia = useDerivedMedia(project, mediaRegistry.pending?null:mediaRegistry.view);
  const resolve = useCallback((id: string) => derivedMedia.urls.get(id) ?? mediaRegistry.resolve(id), [derivedMedia.urls, mediaRegistry.resolve]);
  const editorMedia = useRef({project,resolve,pending:true,registry:mediaRegistry.registry});
  editorMedia.current={project,resolve,pending:mediaRegistry.pending||derivedMedia.pending,registry:mediaRegistry.registry};
  const hostedCatalogue=mediaRegistry.pending||derivedMedia.pending?null:[
    ...(mediaRegistry.registry?.list().map(asset=>({id:asset.id,name:asset.originalName||asset.filename,mediaType:asset.mediaType,url:resolve(asset.id)}))??[]),
    ...(mediaRegistry.registry?.images().filter(asset=>!project?.assets.some(item=>item.id===asset.id)).map(asset=>({id:asset.id,name:asset.label,mediaType:'image' as const,url:resolve(asset.id)}))??[])
  ].map(({url,...asset})=>url?{...asset,url}:asset);
  const hostedCatalogueKey=JSON.stringify(hostedCatalogue);
  useEffect(()=>{if(hostedCatalogue&&hosted.state==='running')hosted.updateMedia(hostedCatalogue);},[hostedCatalogueKey,hosted.state]);
  async function handleHostedEditor(kind:EditorOperation,isCurrent:()=>boolean):Promise<EditorResult>{
    const catalogue=async()=>{
      // Wait for the normal registry effect to publish grants after an import.
      const until=Date.now()+10000;
      while(isCurrent()&&(editorMedia.current.pending||editorMedia.current.project!==latest.current)&&Date.now()<until)await new Promise(resolve=>setTimeout(resolve,30));
      if(!isCurrent())throw new Error('The episode changed while the editor request was pending.');
      if(editorMedia.current.pending)throw new Error('Episode media is still loading. Refresh the media pool.');
      const view=editorMedia.current;
      const physical=view.registry?.list().map(asset=>({id:asset.id,name:asset.originalName||asset.filename,mediaType:asset.mediaType,url:view.resolve(asset.id)}))??[];
      const derived=view.registry?.images().filter(asset=>!physical.some(item=>item.id===asset.id)).map(asset=>({id:asset.id,name:asset.label,mediaType:'image' as const,url:view.resolve(asset.id)}))??[];
      return [...physical,...derived].map(({url,...asset})=>url?{...asset,url}:asset);
    };
    if(kind==='media-list')return {ok:true,assets:await catalogue()};
    if(operation.current)throw new Error('Story Studio is busy. Please retry after the current operation finishes.');
    operation.current=true;setBusy(true);setError('');
    try{
      if(!isCurrent())throw new Error('This episode is no longer active.');
      if(kind==='episode-save')return {ok:true,cancelled:!await saveEpisode('save')};
      const imported=await window.appApi.importMedia(file && latest.current ? { folderPath: file.folderPath, assets: latest.current.assets } : undefined);
      if(!isCurrent())throw new Error('The episode changed during import.');
      if(!imported)return {ok:true,cancelled:true};
      const current=latest.current;if(!current)throw new Error('No episode is open.');
      const next=mergeLessonMediaImport(current,imported);
      parseSceneDocument(next);history.current.record(next);latest.current=next;setProject(next);
      const reason=imported.failures?.map(item=>`${item.name}: ${item.reason}`).join('\n');
      return {ok:true,assets:await catalogue(),importedIds:[...imported.importedAssets,...(imported.replacedAssets??[])].map(asset=>asset.id),...(reason?{reason}:{})};
    }catch(failure){setError(String(failure));throw failure;}
    finally{operation.current=false;setBusy(false);}
  }
  const videoAsset = liveScene && project?.assets.find(asset => asset.id === liveScene.background.assetId && asset.mediaType === 'video');
  const mediaIdentity = videoAsset ? `${project!.id}:${session.cursor!.entryId}:${session.visit}:${videoAsset.id}` : null;
  const restoreGameMedia = !activeGame && !!gameMediaReturn.current && gameMediaReturn.current.identity === mediaIdentity && (gameMediaSuspended.current || !gameSection);
  const media = usePresentationMedia(!activeGame ? mediaIdentity : null, { enabled: true, volume: 1 }, liveScene?.background.videoTrim, mode === 'teach' && !!videoAsset && !gameSection,
    gameMediaReturn.current?.identity === mediaIdentity ? gameMediaReturn.current.position : 0, restoreGameMedia, autoplayVideos);
  useEffect(() => {
    if (restoreGameMedia && media.intent) {
      gameMediaSuspended.current = false;
      if (!gameSection) gameMediaReturn.current = null;
    }
  }, [restoreGameMedia, gameSection, media.intent?.identity]);
  const liveKey = `${session.id}:${session.cursor?.entryId}:${session.visit}`;
  const livePlan = useMemo(() => project && liveScene ? projectScene(project, liveScene.id, session, resolve) : null, [project, liveScene, session, resolve]);
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
  }, [project, editScene, selection.entryId, selection.sequence, selection.objectId, facePreview, editView, resolve]);
  const previewFace = useCallback((faceId: string) => {
    if (selection.objectId && editScene) setFacePreview(previous => previous?.sceneId === editScene.id && previous.objectId === selection.objectId && previous.faceId === faceId ? previous : { sceneId: editScene.id, objectId: selection.objectId!, faceId });
  }, [selection.objectId, editScene?.id]);
  useEffect(() => { setFacePreview(previous => previous?.sceneId === editScene?.id && previous?.objectId === selection.objectId ? previous : null); }, [editScene?.id, selection.objectId]);
  const plan = mode === 'edit' ? editPlan : livePlan;
  const dirty = history.current.isDirty;
  const currentSequence = mode === 'edit' ? selection.sequence : session.cursor?.sequence ?? selection.sequence;
  const liveAudioLevels = useLiveAudioLevels(project?.id);
  const musicEntry = project?.sequences[currentSequence].find(entry => entry.id === (mode === 'edit' ? selection.entryId : session.cursor?.entryId));
  const musicSection = musicEntry?.kind !== 'break' ? project?.sections?.find(section => section.id === musicEntry?.sectionId) : undefined;
  const liveMusicSection = musicSection ? { ...musicSection, audio: liveAudioLevels.tracks(musicSection.audio ?? []) } : undefined;
  const liveBreakScene = liveScene ? { ...liveScene, audio: liveAudioLevels.tracks(liveScene.audio) } : undefined;
  const sectionMusic = useSectionMusic({ section: liveMusicSection,
    scope: JSON.stringify([project?.id,file?.activationToken,mode,currentSequence,musicSection?.id,musicEntry?.kind === 'break' ? musicEntry.id : !musicSection ? musicEntry?.id : null,beginning,gameSection]),
    resolve, shortcutEnabled: mode === 'teach' && !beginning && !gameSection && !activationPaused,
    onPlayBreak: musicEntry?.kind === 'break' && liveScene ? () => { void audio.current.play(liveAudioLevels.tracks(liveScene.audio), resolve).catch(reason => setError(String(reason))); } : undefined,
    onError: reason => setError(String(reason)) });

  const selectedIds = multiSelection.entryId === selection.entryId && multiSelection.ids.includes(selection.objectId ?? '') ? multiSelection.ids.filter(id => editScene?.objects.some(o => o.id === id)) : selection.objectId ? [selection.objectId] : [];
  const selectMany = (ids: string[]) => { setMultiSelection({ entryId: selection.entryId, ids }); setSelection(old => ({ ...old, objectId: ids[0] ?? null })); };
  const object = editScene?.objects.find(item => item.id === selection.objectId);

  const editCommand = (work: () => void) => { try { work(); } catch (reason) { setError(String(reason)); } };

  const apply = (value: LessonProject, group?: object) => {
    if (operation.current || value === latest.current) return;
    if (latest.current) selectionHistory.current.set(latest.current, { ...selection });
    const target = document.activeElement;
    if (!group && target?.matches('input:not([type=checkbox]):not([type=radio]),textarea')) {
      const previous = inputHistoryGroup.current;
      if (!previous || previous.target !== target || Date.now() - previous.at > 1500) inputHistoryGroup.current = { target, group: {}, at: Date.now() };
      else previous.at = Date.now();
      group = inputHistoryGroup.current!.group;
    } else if (!group) inputHistoryGroup.current = null;
    history.current.record(value, group); latest.current = value; setProject(value); setSession(old => reconcileSession(value, old));
  };
  const changeScene = (scene: LessonScene) => {
    if (!project) return;
    apply(putScene(project, { ...scene, objects: scene.objects.map(item => ({ ...item, box: fitBox(item.box, scene.frame) })) }));
  };
  const historyStep = (direction: 'undo' | 'redo') => {
    if (operation.current) return; const value = history.current[direction](); if (!value) return;
    if (latest.current) selectionHistory.current.set(latest.current, { ...selection });
    inputHistoryGroup.current = null;
    setSelection(restoreEditorSelection(value, selectionHistory.current.get(value) ?? selection));
    latest.current = value; setProject(value); setSession(old => reconcileSession(value, old));
    setNotice(direction === 'undo' ? 'Undone. Redo restores this action.' : 'Redone.');
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
  const clearDrawing = (ask = true) => { if (ask && !window.confirm('Clear this scene drawing? You can undo this action.')) return; if (mode === 'edit' && editScene) changeScene({ ...editScene, drawings: [] }); else setSession(old => setLiveDrawings(old, [])); };
  useEffect(() => {
    void audioManager.initializeFromAppSettings(window.appApi).catch(reason => setError(String(reason)));
    void window.appApi.students.getSnapshot().then(applyStudents).catch(reason => setError(String(reason)));
    const unsubscribe = window.appApi.onPresentStatus(setPresentStatus);
    void window.appApi.getPresentStatus().then(setPresentStatus);
    return () => { unsubscribe(); audio.current.stop(); };
  }, []);
  useEffect(() => {
    const snapshot = { sessionId: session.id, revision: ++revision.current, ...(rosterProjection?{roster:rosterProjection}:{}), target: activeGame
      ? { kind: 'game' as const, occurrenceId: activeGame.instanceId, ...activeGame, ...(activeGame.gameId==='hero-dash'?{dash:dashProjection(dash,resolve)}:{}) }
      : presentationPlan
      ? { kind: 'scene' as const, occurrenceId: `${session.cursor!.entryId}:${session.visit}`, plan: presentationPlan, ...(media.intent && presentationPlan.background.mediaType === 'video' ? { media: media.intent } : {}) }
      : { kind: 'empty' as const, occurrenceId: 'empty' } };
    void window.appApi.publishPresentSnapshot(snapshot).then(ok => { if (!ok) setError('The presentation rejected this scene. Your authored changes are still available.'); }).catch(reason => setError(String(reason)));
  }, [presentationPlan, session.id, JSON.stringify(media.intent), activeGame, rosterProjection, dash, resolve]);
  useEffect(() => window.appApi.onGameEnded(event => {
    if (activeGameRef.current?.instanceId !== event.instanceId) return;
    hosted.stop(); activeGameRef.current = null; setActiveGame(null);
    setGameNotice(event.reason === 'closed' ? 'Present closed. The game ended; your lesson is preserved.' : 'Present restarted or stopped unexpectedly. The game ended; launch a new run to continue.');
  }), []);
  const autoplayTracks=liveScene?.audio.filter(track=>track.autoplay)??[];
  const autoplayAudioKey=JSON.stringify(autoplayTracks.map(track=>[track,resolve(track.assetId)]));
  useEffect(() => {
    const owner = audio.current;
    if (!beginning && !gameSection && mode === 'teach' && liveScene && autoplayTracks.every(track=>!!resolve(track.assetId))) void owner.play(autoplayTracks, resolve).catch(reason => setError(String(reason)));
    else owner.stop();
    return () => owner.stop();
  }, [beginning, gameSection, mode, liveKey, project?.id, autoplayAudioKey]);
  useEffect(() => {
    return window.appApi.onRequestClose(() => { if (!history.current.isDirty || window.confirm('Discard unsaved lesson changes and close?')) window.appApi.forceClose(); });
  }, []);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (beginning || gameSection) return;
      if (activationPaused) return;
      if (event.defaultPrevented || (event.target as HTMLElement)?.closest?.('[role="dialog"], [role="menu"], form')) return;
      const tag = (event.target as HTMLElement)?.tagName;
      if (['INPUT','TEXTAREA','SELECT'].includes(tag) || (event.target as HTMLElement)?.isContentEditable) return;
      const command = event.ctrlKey || event.metaKey, key = event.key.toLowerCase();
      if (command && key === 's') { event.preventDefault(); void save('save'); return; }
      if (command && !event.altKey && (key === 'z' || key === 'y')) { event.preventDefault(); if (event.repeat) return; const redo = key === 'y' || event.shiftKey; if (mode === 'edit') historyStep(redo ? 'redo' : 'undo'); else setSession(redo ? redoLiveDrawing : undoLiveDrawing); return; }
      const shortcut = lessonShortcut(event, mode);
      if (shortcut === 'draw') { event.preventDefault(); setDrawing(old => !old); return; }
      if (shortcut === 'clear-drawings') { event.preventDefault(); clearDrawing(false); return; }
      if ((shortcut === 'previous' || shortcut === 'next') && project) { event.preventDefault(); setSession(old => stepScene(project, old, shortcut === 'next' ? 1 : -1)); return; }
      if (shortcut === 'playback') {
        const selectedVideo = document.querySelector<HTMLVideoElement>('.lesson-canvas [data-selected="true"] video');
        const localVideo = selectedVideo ?? (mode === 'edit' ? editVideo : null);
        if (localVideo) { event.preventDefault(); if (localVideo.paused) void localVideo.play().catch(reason => setError(String(reason))); else localVideo.pause(); return; }
        if (mode === 'teach' && media.intent) { event.preventDefault(); void media.command(media.intent.playing ? 'pause' : 'play'); return; }
      }
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
  const run = async (work: () => Promise<void>) => { if (operation.current) return; operation.current = true; setBusy(true); setError(''); try { await autosave.pending.current; await work(); } catch (reason) { setError(String(reason)); } finally { operation.current = false; setBusy(false); } };
  const load = (kind: 'new' | 'open') => run(async () => {
    if (history.current.isDirty && !window.confirm('Discard unsaved changes and continue?')) return;
    const candidate = kind === 'new' ? await window.lessonApi.createProject() : await window.lessonApi.openProject(); if (!candidate) return;
    const data = parseSceneDocument(candidate.data);
    await media.revoke(); audio.current.stop(); sectionMusic.stop(); window.lessonApi.activateProject(candidate.activationToken);
    const sequence = project ? selection.sequence : entrySequence;
    const entryId = data.sequences[sequence][0]?.id ?? null;
    history.current.reset(data); latest.current = data; setProject(data); setFile(candidate); setActiveBinId(''); setSession(navigate(data, createSession(), entryId ? { sequence, entryId } : null)); setMode(project ? mode : 'teach'); setDrawing(false); setEditView(null);
    setSelection({ sequence, entryId, objectId: null }); setNotice(kind === 'new' ? 'Switch to Edit to import media or add a scene.' : 'Lesson opened.');
    if (gameSection) await prepareGameProject(data, candidate);
  });
  const save = (saveMode: 'save' | 'saveAs') => run(async () => { await saveEpisode(saveMode); });
  async function saveEpisode(saveMode: 'save' | 'saveAs') {
    if (!project || !file) throw new Error('Open an episode before saving.');
    let written = project;
    if (hosted.isActive) { await hosted.flush(); written = latest.current ?? project; }
    parseSceneDocument(written);
    const saved = await window.lessonApi.saveProject(written, saveMode, file.folderPath); if (!saved) return false;
    if (hosted.isActive && saved.folderPath !== file.folderPath) { hosted.stop(); activeGameRef.current = null; setActiveGame(null); setGameNotice('Lesson saved in a new folder. Launch the activity again to use its new media scope.'); }
    history.current.markSaved(written); setFile({ ...file, ...saved, data: written, isDraft: false }); setNotice('Lesson saved.');
    return true;
  }
  const convertEpisode = (adventure: { id: string; version: string }) => run(async () => {
    if (!project || !file || project.format !== 'story-studio-scene') return;
    const candidate = await window.lessonApi.convertProject(project, adventure, file.folderPath);
    if (!candidate) return;
    const data = parseSceneDocument(candidate.data);
    await media.revoke(); audio.current.stop(); sectionMusic.stop(); window.lessonApi.activateProject(candidate.activationToken);
    history.current.reset(data); latest.current = data; setProject(data); setFile(candidate);
    setSession(old => reconcileSession(data, old));
    setNotice(`Episode copy created. Original backup: ${candidate.backupPath}. Migration report: ${candidate.migrationReport}`);
  });
  const exportPackage = () => run(async () => {
    if (!file || latest.current?.format !== 'story-studio-episode') return;
    if (hosted.isActive) await hosted.flush();
    const current = latest.current;
    if (current?.format !== 'story-studio-episode') return;
    const result = await window.lessonApi.exportPackage(current, file.folderPath);
    if (result) setNotice(`Portable episode exported to ${result.folderPath}`);
  });
  const importPackage = () => run(async () => {
    if (hosted.isActive) await hosted.flush();
    if (history.current.isDirty && !window.confirm('Discard unsaved changes and import an episode?')) return;
    const candidate = await window.lessonApi.importPackage();
    if (!candidate) return;
    const data = parseSceneDocument(candidate.data);
    hosted.stop(); activeGameRef.current = null; setActiveGame(null);
    await media.revoke(); audio.current.stop(); sectionMusic.stop(); window.lessonApi.activateProject(candidate.activationToken);
    const sequence = 'story', entryId = data.sequences.story[0]?.id ?? null;
    history.current.reset(data); latest.current = data; setProject(data); setFile(candidate); setActiveBinId('');
    setSession(navigate(data, createSession(), entryId ? { sequence, entryId } : null));
    setSelection({ sequence, entryId, objectId: null }); setDrawing(false); setEditView(null);
    setGameSection(null); setBeginning(false);
    setNotice('Portable episode verified and imported. You can edit and save this copy.');
  });
  const importMedia = async (kind: 'files' | 'folder' | 'drop', paths?: string[], destinationBinId = activeBinId) => {
    await run(async () => {
      if (!project) return;
      const imported = kind === 'files' ? await window.appApi.importMedia(file && latest.current ? { folderPath: file.folderPath, assets: latest.current.assets } : undefined) : kind === 'folder' ? await window.appApi.importMediaFolder(file && latest.current ? { folderPath: file.folderPath, assets: latest.current.assets } : undefined) : await window.appApi.importDroppedMedia(paths ?? [], file && latest.current ? { folderPath: file.folderPath, assets: latest.current.assets } : undefined);
      if (!imported) return;
      const current = latest.current; if (!current || current.id !== project.id) return;
      const next = mergeLessonMediaImport(current, imported, destinationBinId);
      parseSceneDocument(next);
      history.current.record(next); latest.current = next; setProject(next);
      setNotice(`${imported.importedAssets.length} media files imported.${imported.replacedAssets?.length ? ` ${imported.replacedAssets.length} existing media updated.` : ''} Select media to add scenes.`);
      if (imported.failures?.length) setError(imported.failures.map(failure => `${failure.name}: ${failure.reason}`).join('\n'));
    });
  };
  const addScenes = (assetIds?: string[], beforeEntryId?: string) => editCommand(() => {
    if (!project || busy) return; let next = project; let entryId: string | null = null;
    const assets = assetIds?.map(id => { const physical = mediaRegistry.registry?.get(id); const image = mediaRegistry.registry?.images().find(item => item.id === id); return physical ?? (image ? { ...image, originalName: image.label } : undefined); }).filter(asset => asset && asset.mediaType !== 'audio');
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
    else {
      setSelection(old => ({ ...old, sequence }));
      setSession(old => {
        if (!old.cursor && !old.storyReturn) {
          const entryId = project.sequences[sequence][0]?.id;
          return navigate(project, old, entryId ? { sequence, entryId } : null);
        }
        return sequence === 'activation' ? startActivation(project, old) : exitActivation(project, old);
      });
    }
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
    const result = duplicateSceneEntry(project, selection.sequence, entryId, destination, linked); apply(result.project); if (destination === selection.sequence) setSelection({ sequence: destination, entryId: result.entryId, objectId: null }); else setNotice(`Added ${linked ? 'a linked copy' : 'an independent copy'} to ${destination === 'activation' ? 'Discovery' : 'Adventure'}. Current sequence unchanged.`);
  });
  const enterGames = async (section: GameSection) => {
    if (section === gameSection || operation.current || gameLaunch.current) return;
    if (activeGameRef.current?.moduleHost && presentStatus?.state !== 'error') { try { await hosted.flush(); } catch (reason) { setError(String(reason)); return; } }
    operation.current = true; setBusy(true); setError('');
    try {
      let current = latest.current, currentFile = file;
      if (!current || !currentFile) {
        currentFile = await window.lessonApi.createDraft('story');
        current = parseSceneDocument(currentFile.data);
        window.lessonApi.activateProject(currentFile.activationToken);
        history.current.reset(current); latest.current = current; setProject(current); setFile(currentFile);
      }
      await prepareGameProject(current, currentFile);
    } catch (reason) { setError(String(reason)); return; }
    finally { operation.current = false; setBusy(false); }
    if (!gameSection) gameMediaReturn.current = media.intent ? { identity: media.intent.identity, position: media.status?.positionSec ?? media.intent.positionSec } : null;
    void media.command('pause'); audio.current.stop(); setDrawing(false);
    hosted.stop(); activeGameRef.current = null; setActiveGame(null); setGameSection(section); setGameNotice('');
  };
  async function prepareGameProject(current: LessonProject, currentFile: LessonProjectState) {
    if (current.format === 'story-studio-episode') return;
    const candidate = await window.lessonApi.prepareGames(current, currentFile.folderPath);
    const data = parseSceneDocument(candidate.data);
    await media.revoke(); audio.current.stop(); sectionMusic.stop(); window.lessonApi.activateProject(candidate.activationToken);
    history.current.reset(data); latest.current = data; setProject(data); setFile(candidate);
    setSession(old => reconcileSession(data, old));
  }
  const exitGame = async () => {
    if (activeGameRef.current?.moduleHost && presentStatus?.state !== 'error') { try { await hosted.flush(); } catch (reason) { setError(String(reason)); return false; } }
    hosted.stop(); activeGameRef.current = null; setActiveGame(null); setGameNotice(''); return true;
  };
  const saveActivity = (activity: EpisodeActivity) => {
    const current = latest.current; if (current?.format !== 'story-studio-episode') return;
    let next = putEpisodeActivity(current, activity);
    if (!next.occurrences?.some(item => item.activityId === activity.id)) next = putActivityOccurrence(next, { id: crypto.randomUUID(), activityId: activity.id, section: activity.moduleType === 'language-snake' ? 'challenge' : (activity.moduleType === 'final-boss-hero' || activity.moduleType === 'hero-dash') ? 'mastery' : 'activation' });
    apply(next); setSelectedActivityId(activity.id);
  };
  const launchGame = async (gameId: string) => {
    if (!gameSection || gameLaunch.current || !getGamesForSection(gameSection).some(game => game.id === gameId)) return;
    gameLaunch.current = true; setBusy(true); setError('');
    let episode = latest.current?.format === 'story-studio-episode' ? latest.current : null;
    let activity = episode?.activities?.find(item => item.id === selectedActivityId && item.moduleType === gameId) ?? episode?.activities?.find(item => item.moduleType === gameId);
    let occurrence = episode?.occurrences?.find(item => item.activityId === activity?.id);
    const next: GameSession = { gameId, instanceId: crypto.randomUUID(), ...(gameId==='hero-dash'?{}:{moduleHost:true as const}) };
    try {
      if (!episode || (gameId !== 'final-boss-hero' && gameId !== 'language-snake' && gameId !== 'hero-dash')) throw new Error('Open a lesson before launching.');
      if (!activity) {
        activity = { id: crypto.randomUUID(), moduleType: gameId, moduleVersion: 1, configVersion: 1, config: createModuleTemplate(gameId) } as EpisodeActivity;
        episode = putEpisodeActivity(episode, activity);
      }
      if (!occurrence) {
        occurrence = { id: crypto.randomUUID(), activityId: activity.id, section: gameId !== 'language-snake' ? 'mastery' : 'challenge' };
        episode = putActivityOccurrence(episode, occurrence);
      }
      if (episode !== latest.current) { history.current.record(episode); latest.current = episode; setProject(episode); }
      setSelectedActivityId(activity.id);
      if (activeGameRef.current?.moduleHost && presentStatus?.state !== 'error') await hosted.flush();
      hosted.stop();
      void media.command('pause'); audio.current.stop();
      if (media.intent) gameMediaReturn.current = { identity: media.intent.identity, position: media.status?.positionSec ?? media.intent.positionSec };
      gameMediaSuspended.current = !!gameMediaReturn.current;
      activeGameRef.current = next; setActiveGame(next); setGameNotice('');
      const race=activity.moduleType==='hero-dash'?createDash(activity.config):undefined;
      if(race)setDash(race);
      await window.appApi.launchGame({ sessionId: session.id, revision: ++revision.current, target: { kind: 'game', occurrenceId: next.instanceId, ...next, ...(race?{dash:dashProjection(race,resolve)}:{}) } });
      if (episode && activity && occurrence && next.moduleHost) {
        const activityId = activity.id;
        const fresh = latest.current?.format === 'story-studio-episode' ? latest.current.activities?.find(item => item.id === activityId) ?? activity : activity;
        const context = { sessionId: session.id, runId: crypto.randomUUID(), instanceId: next.instanceId, occurrenceId: occurrence.id, episodeId: episode.id, adventureId: episode.adventure.id, participantIds: [...participants] };
        await registerRun(context, fresh);
        await hosted.initialize(fresh, context, resolve);
      }
    } catch (reason) {
      if (activeGameRef.current?.instanceId === next.instanceId) { activeGameRef.current = null; setActiveGame(null); }
      setError(`The game could not open Present: ${String(reason)}`);
    } finally { gameLaunch.current = false; setBusy(false); }
  };
  const studentsWorkspace = studentsOpen ? <StudentsWorkspace onClose={() => setStudentsOpen(false)} onChange={applyStudents} initialView={studentsView} initialStudentId={detailsStudentId} lesson={project?.format === 'story-studio-episode' && file ? {project,folder:file.folderPath,participants,refreshKey:progressionRevision,onChange:progressionChanged}:undefined} /> : null;
  const classControls = <div className="lesson-panel-content"><label className="lesson-field">Active class<select aria-label="Active class" disabled={busy || !!activeGame} value={activeClassId ?? ''} onChange={event=>void window.appApi.students.selectClass({id:event.target.value||null}).then(applyStudents).catch(reason=>setError(String(reason)))}><option value="">Individual session</option>{classes.filter(item=>!item.archived).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button disabled={!activeClassId || busy || !!activeGame} onClick={()=>void window.appApi.students.getSnapshot().then(value=>{applyStudents(value);const group=value.classes.find(item=>item.id===value.activeClassId);setParticipants(group?.studentIds.filter(id=>value.studentRoster.some(student=>student.id===id&&!student.archived))??[]);}).catch(reason=>setError(String(reason)))}>Load class participants</button><button onClick={()=>setStudentsOpen(true)}>Manage students and classes</button></div>;
  const rosterSettings=<details><summary>Present roster settings</summary><label className="lesson-check"><input type="checkbox" checked={rosterVisible} onChange={event=>setRosterVisible(event.target.checked)} />Show roster in Present</label><label className="lesson-field">Roster placement<select value={rosterPosition} onChange={event=>setRosterPosition(event.target.value as 'top'|'bottom')}><option value="bottom">Bottom</option><option value="top">Top</option></select></label><label className="lesson-check"><input type="checkbox" checked={showScores} onChange={event=>setShowScores(event.target.checked)} />Show session scores</label><label className="lesson-check"><input type="checkbox" checked={showRewards} onChange={event=>setShowRewards(event.target.checked)} />Show reward totals</label><label className="lesson-check"><input type="checkbox" checked={showRelics} onChange={event=>setShowRelics(event.target.checked)} />Show relic progress</label><p>Present uses nicknames or anonymous student labels. It shows up to eight selected participants and reserves a separate strip above or below the story.</p></details>;
  const teachRoster=<TeachRoster roster={roster} participants={participants} onParticipants={setParticipants} onDetails={id=>{setDetailsStudentId(id);setStudentsView('hero');setStudentsOpen(true);}} classControls={classControls} disabled={busy||!!activeGame} game={!!gameSection} progress={rosterProgress} adventureId={project?.format==='story-studio-episode'?project.adventure.id:undefined}>{rosterSettings}{project?.format==='story-studio-episode'&&file&&<GroupRewardControls project={project} folder={file.folderPath} participants={participants} roster={roster} onChange={progressionChanged} intentStore={groupRewardPlans.current} refreshKey={progressionRevision} />}</TeachRoster>;
  const finishLesson=async()=>{if(await exitGame()){audio.current.stop();void media.command('pause');setSession(createSession());setGameSection(null);setMode('edit');setBeginning(true);setRosterVisible(false);}};
  const createGameLesson = () => run(async () => {
    const candidate = await window.lessonApi.createDraft('story');
    const data = parseSceneDocument(candidate.data);
    window.lessonApi.activateProject(candidate.activationToken);
    history.current.reset(data); latest.current = data; setProject(data); setFile(candidate); setBeginning(false);
  });
  const leaveForPhase = async (sequence: SequenceKind) => {
    if (busy || !await exitGame()) return;
    if (!latest.current) await createGameLesson();
    const current = latest.current; if (!current) return;
    const entryId = current.sequences[sequence][0]?.id ?? null;
    setSelection({ sequence, entryId, objectId: null });
    setSession(old => navigate(current, old, entryId ? { sequence, entryId } : null));
    setGameSection(null); setBeginning(false);
  };
  if (gameSection) return <div className="lesson-app">{studentsWorkspace}
    <header className="lesson-header"><a className="studio-brand studio-home-link" href="#" aria-label="Story Studio" onClick={async event => { event.preventDefault(); if (await exitGame()) { setGameSection(null); setBeginning(true); } }}><span aria-hidden="true">✦</span> Story Studio</a><span className="lesson-project-title">{project?.title ?? 'Game library'}{dirty ? ' • Unsaved' : ''}</span>
      <div className="lesson-toolbar"><button disabled={busy || !project} onClick={() => void save('save')}>Save lesson</button><button disabled={busy} onClick={() => void importPackage()}>Import portable episode</button><button disabled={busy || project?.format !== 'story-studio-episode'} onClick={() => void exportPackage()}>Export portable episode</button><button onClick={() => {setStudentsView('profiles');setStudentsOpen(true);}}>Students</button><button onClick={() => {setDetailsStudentId('');setStudentsView('hero');setStudentsOpen(true);}}>Hero Board</button><button onClick={() => setAudioOpen(true)}>Audio settings</button><button disabled={busy} onClick={()=>void finishLesson()}>Finish lesson</button></div></header>
    {mediaRegistry.diagnostics.length > 0 && <p className="lesson-error" role="status">Media unavailable: {mediaRegistry.diagnostics.map(item => `${item.assetId ?? item.path ?? "Project"}: ${item.code}`).join(", ")}</p>}{error && <div className="lesson-error" role="alert">{error}<button onClick={() => setError('')}>Dismiss</button></div>}
    <nav className="lesson-phase-tabs" aria-label="Game sections"><button disabled={busy} onClick={() => void leaveForPhase('story')}>Adventure</button><button disabled={busy} onClick={() => void leaveForPhase('activation')}>Discovery</button><button aria-pressed={gameSection === 'game'} title="Apply what you've learned through interactive games." onClick={() => enterGames('game')}>Challenge</button><button aria-pressed={gameSection === 'mastery'} title="Demonstrate your skills and complete the learning journey." onClick={() => enterGames('mastery')}>Mastery</button></nav>
    <div className="game-control-workspace"><div className="game-control-content">
    {notice && <p className="lesson-notice" role="status">{notice}</p>}
    <GameHost section={gameSection} session={activeGame} status={presentStatus} notice={gameNotice} hasLesson={!!project} busy={busy}
      onLaunch={id => void launchGame(id)} onRestart={() => activeGame && void launchGame(activeGame.gameId)} onExit={exitGame}
      onBack={async () => { if (await exitGame()) { setGameSection(null); setBeginning(!project); } }} onFocus={() => void window.appApi.openPresent().catch(reason => setError(String(reason)))} />
    {activeGame?.gameId==='hero-dash' && <HeroDashControl key={activeGame.instanceId} state={dash} busy={busy}
      onChange={next=>{setDash(next);if(next.config!==dash.config)saveActivity({id:selectedActivityId,moduleType:'hero-dash',moduleVersion:1,configVersion:1,config:next.config});}}
      images={(mediaRegistry.registry?.images()??[]).map(image=>({id:image.id,label:image.label,url:resolve(image.id)}))}
      onImport={()=>void importMedia('files')} onSave={()=>void save('save')}
      collections={project?.format==='story-studio-episode'?(project.activities??[]).filter(a=>a.moduleType==='hero-dash').map(a=>({id:a.id,title:a.moduleType==='hero-dash'?a.config.title:''})):[]}
      onLoad={id=>{if(project?.format!=='story-studio-episode')return;const activity=project.activities?.find(a=>a.id===id);if(activity?.moduleType==='hero-dash'){setSelectedActivityId(id);setDash(createDash(activity.config));}}}
      onNew={()=>{const id=crypto.randomUUID();const race=createDash();saveActivity({id,moduleType:'hero-dash',moduleVersion:1,configVersion:1,config:race.config});setDash(race);}} />}
    {project?.format === 'story-studio-episode' && <div className="game-setup-grid">
      <details className="game-setup-compartment"><summary>Students and presentation</summary>{teachRoster}</details>
      {!activeGame && <details className="game-setup-compartment game-activity-compartment" open><summary>Lesson activity configuration</summary><EpisodeActivities project={project} moduleType={gameSection === 'game' ? 'language-snake' : 'final-boss-hero'} registry={mediaRegistry.registry!} selectedId={selectedActivityId || project.activities?.find(item => item.moduleType === (gameSection === 'game' ? 'language-snake' : 'final-boss-hero'))?.id || ''} onSelect={setSelectedActivityId} onSave={saveActivity} disabled={busy} /></details>}
      {activeGame?.moduleHost && <div className="lesson-toolbar"><span role="status">Activity: {hosted.state}</span><button disabled={hosted.state !== 'running'} onClick={() => void hosted.command('pause').catch(reason => setError(String(reason)))}>Pause activity</button><button disabled={hosted.state !== 'paused'} onClick={() => void hosted.command('resume').catch(reason => setError(String(reason)))}>Resume activity</button><span>{hosted.events.length} accepted activity events</span></div>}
      {hosted.error && <p role="alert" className="lesson-error">{hosted.error}</p>}
      {file && <details className="game-setup-compartment"><summary>Progress and rewards</summary><ProgressionPanel project={project} folder={file.folderPath} roster={roster} participants={participants} refreshKey={progressionRevision} onChange={progressionChanged} /></details>}
    </div>}

    </div><aside className="game-control-present" aria-label="Game presentation controls"><h2>Present controls</h2><button className="studio-present" onClick={() => void window.appApi.openPresent().catch(reason => setError(String(reason)))}>Open Present</button><CameraControls /><TranslationControls /></aside></div>
    <AudioSettingsWorkspace open={audioOpen} onClose={() => setAudioOpen(false)} />
  </div>;
  if (beginning) return <div className="lesson-app">{studentsWorkspace}<Beginning onUsers={() => {setStudentsView('profiles');setStudentsOpen(true);}} onChoose={destination => {
    if (destination === 'settings') { setAudioOpen(true); return; }
    if (destination === 'legacy') { if (!dirty || window.confirm('Discard unsaved lesson changes and open Legacy?')) window.location.search = '?legacy=1'; return; }
    if (destination === 'game' || destination === 'mastery') { enterGames(destination); return; }
    if (busy) return;
    void run(async () => {
      setEntrySequence(destination); setMode('edit'); setDrawing(false);
      let current = project;
      if (!current) {
        const candidate = await window.lessonApi.createDraft(destination);
        current = parseSceneDocument(candidate.data);
        window.lessonApi.activateProject(candidate.activationToken);
        history.current.reset(current); latest.current = current; setProject(current); setFile(candidate);
        setNotice('Unsaved lesson · Add cards or import media. Choose a folder when you save.');
      }
      const entryId = current.sequences[destination][0]?.id ?? null;
      setSelection({ sequence: destination, entryId, objectId: null });
      setSession(old => navigate(current!, old, entryId ? { sequence: destination, entryId } : null));
      setBeginning(false);
    });
  }} />{error && <p className="lesson-error" role="alert">{error}</p>}<AudioSettingsWorkspace open={audioOpen} onClose={() => setAudioOpen(false)} /></div>;
  return <div className="lesson-app">{studentsWorkspace}
    <header className="lesson-header"><a className="studio-brand studio-home-link" href="#" aria-label="Story Studio" title="Choose a mode" aria-disabled={busy || undefined} onClick={event => { event.preventDefault(); if (busy) return; void media.command('pause'); setBeginning(true); }}><span aria-hidden="true">✦</span> Story Studio</a><span className="lesson-project-title">{project?.title ?? `${entrySequence === 'story' ? 'Adventure' : 'Discovery'} · Teach`}{dirty ? ' • Unsaved' : ''}</span>
      <div className="lesson-toolbar"><button disabled={busy} onClick={() => void load('new')}>New project</button><button disabled={busy} onClick={() => void load('open')}>Open project</button><button className="studio-primary" disabled={busy || !project || (!dirty && !file?.isDraft)} onClick={() => void save('save')}>Save</button><button disabled={busy || !project} onClick={() => void save('saveAs')}>Save as</button><button disabled={busy || !file} onClick={async () => { await autosave.pending.current; setRecoveryOpen(true); }}>Recovery</button><button disabled={busy} onClick={() => void importPackage()}>Import portable episode</button><button disabled={busy || project?.format !== 'story-studio-episode'} onClick={() => void exportPackage()}>Export portable episode</button><button onClick={() => {setStudentsView('profiles');setStudentsOpen(true);}}>Students</button><button onClick={() => {setDetailsStudentId('');setStudentsView('hero');setStudentsOpen(true);}}>Hero Board</button><button onClick={() => setAudioOpen(true)}>Audio settings</button><button disabled={busy} onClick={()=>void finishLesson()}>Finish lesson</button></div>
      <div className="lesson-toolbar"><button aria-pressed={mode === 'edit'} onClick={() => { setMode('edit'); setDrawing(false); void media.command('pause'); }}>Edit</button><button disabled={!project} aria-pressed={mode === 'teach'} onClick={teach}>Teach</button><button className="studio-present" disabled={!project || busy} onClick={() => void openPresent()}>Open Present</button></div>
    </header>
    {mediaRegistry.diagnostics.length > 0 && <p className="lesson-error" role="status">Media unavailable: {mediaRegistry.diagnostics.map(item => `${item.assetId ?? item.path ?? "Project"}: ${item.code}`).join(", ")}</p>}{error && <div className="lesson-error" role="alert">{error}<button onClick={() => setError('')}>Dismiss</button></div>}
    {derivedMedia.errors.length > 0 && <p className="lesson-error" role="alert">{derivedMedia.errors.join("; ")}</p>}{project && <>
      <nav className="lesson-phase-tabs" aria-label="Lesson phases"><button aria-pressed={currentSequence === 'story'} title="Experience the story and enter its world." onClick={() => selectPhase('story')}><img src={storyIcon} alt="" />Adventure</button><button aria-pressed={currentSequence === 'activation'} title="Explore and understand new language and concepts." onClick={() => selectPhase('activation')}><img src={activationIcon} alt="" />Discovery</button><button title="Apply what you've learned through interactive games." onClick={() => enterGames('game')}>Challenge</button><button title="Demonstrate your skills and complete the learning journey." onClick={() => enterGames('mastery')}>Mastery</button><span>{mode === 'edit' ? 'Edit' : 'Live'} / {currentSequence === 'story' ? 'Adventure' : 'Discovery'} / {displayed?.title ?? 'Choose a scene'}</span></nav>
      <div className="lesson-workspace" style={layout.style}>
        <main className="lesson-main" style={activationPaused ? { pointerEvents: 'none', opacity: .7 } : undefined}>
          {mode === 'edit' && <div className="lesson-content-rail"><EpisodeContentPanel key={`${file?.activationToken}:${project.id}:${project.format}`} project={project} registry={mediaRegistry.registry!} resolve={resolve} onChange={apply} onConvert={convertEpisode} onInsert={addScenes} busy={busy} />
          {project.format === 'story-studio-episode' && <AdventureDefinitionEditor project={project} registry={mediaRegistry.registry!} onChange={apply} busy={busy} />}
          <LessonMediaPool key={project.id} project={project} registry={mediaRegistry.registry!} resolveAsset={resolve} binId={activeBinId} onBinChange={setActiveBinId} onImport={importMedia} onInsert={addScenes} onChange={apply} /></div>}
          {mode === 'edit' && layout.splitter('pool')}
          <div className="lesson-toolbar lesson-canvas-tools">
            {mode === 'edit' ? <><button className="studio-creative" onClick={() => addScenes()}>Add scene</button><button className="studio-creative" disabled={!editScene} onClick={() => add('card')}>Add Card</button><button className="studio-creative" disabled={!editScene} onClick={() => add('bubble')}>Add Bubble</button><button className="studio-creative" disabled={!editScene} onClick={() => add('text')}>Add Text</button><button disabled={!editScene} aria-pressed={drawing} onClick={() => setDrawing(!drawing)}>Draw</button><button disabled={!object} onClick={duplicateSelected}>Duplicate</button><button disabled={!object} onClick={removeSelected}>Delete</button><button disabled={!history.current.canUndo || busy} title={`${history.current.undoCount} undo steps available (up to 100)`} onClick={() => historyStep('undo')}>Undo</button><button disabled={!history.current.canRedo || busy} title={`${history.current.redoCount} redo steps available`} onClick={() => historyStep('redo')}>Redo</button><button disabled={!editScene} onClick={() => { if (selection.entryId) setSession(old => navigate(project, old, { sequence: selection.sequence, entryId: selection.entryId! })); }}>Show in Present</button></>
              : <><button title="A · Previous scene" onClick={() => setSession(old => stepScene(project, old, -1))}>Previous scene</button><button title="D · Next scene" className="studio-primary" onClick={() => setSession(old => stepScene(project, old, 1))}>Next scene</button>{session.cursor?.sequence === 'activation' ? <button onClick={() => setSession(old => exitActivation(project, old))}>Return to Adventure</button> : <button className="studio-creative" disabled={!project.sequences.activation.length} onClick={() => setSession(old => startActivation(project, old))}>Start Discovery</button>}<button onClick={() => setSession(old => resetScene(project, old))}>Reset scene</button><button onClick={() => { if (window.confirm('Start a fresh teaching session? Temporary Card states and drawings will reset.')) setSession(navigate(project, createSession(), session.cursor)); }}>New teaching session</button></>}
          </div>
          <div className="lesson-drawing-row">{drawing && <DrawingToolbar active={drawing} tool={drawTool} color={drawColor} size={drawSize} rainbow={drawRainbow} fadeMs={drawFadeMs} onRainbow={setDrawRainbow} onFadeMs={setDrawFadeMs} onActive={setDrawing} onTool={setDrawTool} onColor={setDrawColor} onSize={setDrawSize}
            onUndo={() => mode === 'edit' ? historyStep('undo') : setSession(undoLiveDrawing)} onRedo={() => mode === 'edit' ? historyStep('redo') : setSession(redoLiveDrawing)} onClear={() => clearDrawing()}
            canUndo={mode === 'edit' ? history.current.canUndo : !!session.drawingUndo?.length} canRedo={mode === 'edit' ? history.current.canRedo : !!session.drawingRedo?.length} />}
            {mode === 'edit' && plan && <div className="lesson-toolbar lesson-edit-view"><label>Canvas zoom<input aria-label="Canvas zoom" type="range" min="1" max="4" step=".1" value={plan.viewport.zoom} onChange={event => updateView({ ...plan.viewport, zoom: Number(event.target.value) })} /></label><button onClick={() => updateView({ zoom: 1, pan: { x: 0, y: 0 } })}>Reset view</button></div>}
          </div>
          <div className="lesson-canvas" aria-label={mode === 'edit' ? 'Edit canvas' : 'Live preview'} onDragOver={e => { if (mode === 'edit') e.preventDefault(); }} onDrop={e => {
            if (mode !== 'edit' || !editScene) return; e.preventDefault();
            const payload = e.dataTransfer.getData(LESSON_ASSET_DRAG); if (!payload) return;
            editCommand(() => { const ids = JSON.parse(payload) as string[]; let next = project; for (const id of ids) if (project.sequences[selection.sequence].find(entry => entry.id === selection.entryId)?.kind === 'break') { const asset = project.assets.find(a => a.id === id && (a.mediaType === 'image' || a.mediaType === 'video')); if (asset) next = putScene(next, addReviewMedia(next.scenes[editScene.id], asset, mediaDisplayTitle(asset))); } else if (project.assets.some(asset => asset.id === id && asset.mediaType === 'image')) next = addObject(next, editScene.id, { id: makeId(), kind: 'image', assetId: id, visible: true, box: { x: 60, y: 60, width: 400, height: 300 } }); apply(next); });
          }}>
            {plan ? <SceneSurface plan={plan} surface={mode} selectedObjectId={mode === 'edit' ? selection.objectId ?? undefined : liveObject ?? undefined}
              playback={mode==='teach'&&videoAsset?{positionSec:media.status?.positionSec??0,playing:media.status?.state==='playing'}:undefined}
              selectedObjectIds={mode === 'edit' ? selectedIds : undefined} onSelectMany={mode === 'edit' ? selectMany : undefined} onGeometryChanges={changeGeometries}
              onDrawingPreview={value => { if (mode === 'teach') setDrawingPreview(value ? { key: liveKey, value } : null); }}
              onSelect={id => mode === 'edit' ? selectMany(id ? [id] : []) : setLiveObject(id)}
              onGeometryChange={mode === 'edit' ? (id, box) => { const item = editScene?.objects.find(o => o.id === id); if (item && editScene) apply(putObject(project, editScene.id, { ...item, box })); } : (id, box) => setSession(old => moveLiveCard(project, old, id, box))}
              onViewportChange={updateView} onContextMenu={menus.openContext} onCardDrop={menus.dropCard} occurrenceKey={mode === 'edit' ? selection.entryId ?? '' : liveKey}
              erasableStrokeIds={mode === 'teach' ? session.drawings.map(stroke => stroke.id) : undefined} drawingTool={drawTool} drawColor={drawColor} drawSize={drawSize} drawRainbow={drawRainbow} drawFadeMs={drawFadeMs}
              onErase={ids => mode === 'edit' && editScene ? changeScene({ ...editScene, drawings: editScene.drawings.filter(stroke => !ids.includes(stroke.id)) }) : setSession(old => setLiveDrawings(old, old.drawings.filter(stroke => !ids.includes(stroke.id))))}
              onInteract={id => { setLiveObject(id); setSession(old => cardAction(project, old, id, 'interact')); }}
              video={mode === 'teach' && videoAsset ? <LiveVideo stream={media.previewStream} /> : mode === 'edit' && plan.background.mediaType === 'video' && plan.background.src
                ? <EditSceneVideo key={`${selection.entryId}:${plan.background.src}`} src={plan.background.src} interactive trim={editScene?.background.videoTrim} onElement={setEditVideo} /> : undefined}
              drawing={drawing} onDraw={stroke => mode === 'edit' && editScene ? changeScene({ ...editScene, drawings: [...editScene.drawings, stroke] }) : setSession(old => setLiveDrawings(old, [...old.drawings, stroke]))} />
              : <div className="lesson-empty"><h2>{mode === 'edit' ? 'Build your sequence' : 'Choose a scene to teach'}</h2><p>{mode === 'edit' ? 'Import media and drag it into the timeline, or add a blank scene.' : 'Select a scene in the timeline below.'}</p></div>}
          </div>
          {mode === 'teach' && videoAsset && <div className="lesson-toolbar"><label title="Manual playback is the default; Space plays or pauses."><input type="checkbox" checked={autoplayVideos} onChange={event => { setAutoplayVideos(event.target.checked); try { localStorage.setItem('story-studio.video-autoplay.v1', String(event.target.checked)); } catch {} }} />Autoplay videos when changing scenes</label><button title="Play / Pause · Space" aria-pressed={!!media.intent?.playing} onClick={() => void media.command(media.intent?.playing ? 'pause' : 'play')}>{media.intent?.playing ? 'Pause video' : 'Play video'}</button><button onClick={() => void media.command('replay')}>Replay video</button><label>Video position<input aria-label="Video position" onKeyDown={event => { if (event.key === ' ' && !event.repeat && !event.ctrlKey && !event.altKey && !event.metaKey) { event.preventDefault(); event.stopPropagation(); void media.command(media.intent?.playing ? 'pause' : 'play'); } }} type="range" min="0" max={media.status?.durationSec || 1} step=".1" value={media.status?.epoch === media.intent?.epoch ? media.status?.positionSec ?? 0 : media.intent?.positionSec ?? 0} onChange={e => void media.command('seek', Number(e.target.value))} /></label><span>{media.error ?? (media.available ? media.status?.state ?? 'Ready' : 'Open Present to play video')}</span></div>}
          {layout.splitter('timeline')}
          <LessonTimeline resolveAsset={resolve} onHistory={historyStep} onProjectChange={apply} project={project} sequence={currentSequence} selectedEntryId={mode === 'edit' ? selection.entryId : session.cursor?.entryId ?? null} live={session.cursor} readOnly={mode === 'teach'}
            videoControls={mode === 'edit' && editScene && editPlan?.background.mediaType === 'video' ? <SceneVideoTrimControls key={selection.entryId} video={editVideo} trim={editScene.background.videoTrim}
              onChange={(trim, duration, group) => { if (!busy) apply(updateSceneVideoTrim(project, editScene.id, trim, duration), group); }} /> : undefined}
            onSelect={entryId => { if (mode === 'edit') setSelection(old => ({ ...old, entryId, objectId: null })); else setSession(old => navigate(project, old, { sequence: currentSequence, entryId })); }} onAdd={addScenes}
            onReorder={(id, before) => apply(reorderEntry(project, selection.sequence, id, before))}
            onDelete={id => { const next = removeEntry(project, selection.sequence, id); apply(next); setSelection(old => ({ ...old, entryId: next.sequences[old.sequence][0]?.id ?? null, objectId: null })); }}
            onCopy={duplicateEntry} onCopyToActivation={(id, linked) => duplicateEntry(id, linked, 'activation')} onSection={(id, section) => apply({ ...project, sequences: { ...project.sequences, [selection.sequence]: project.sequences[selection.sequence].map(entry => entry.id === id ? { ...entry, section } : entry) } })} />
        </main>
        {layout.splitter('inspector')}
        <div className="lesson-side">
        {teachRoster}
        {project.format === 'story-studio-episode' && <div className="lesson-panel-content">
          <ActivationActivities project={project} onChange={apply} participants={participants} sessionId={session.id} readOnly={mode === 'teach'} disabled={busy}
            onRegisterRun={registerRun} onLifecycle={(context, state) => window.appApi.progression.lifecycle({ runId: context.runId, state })}
            onStart={sceneId => { const entry = project.sequences.activation.find(item => item.sceneId === sceneId); if (!entry) { setError('Activation scene has no sequence entry.'); return; } setMode('teach'); setSession(old => navigate(project, old.cursor?.sequence === 'activation' ? old : startActivation(project, old), { sequence: 'activation', entryId: entry.id })); }}
            onPaused={paused => { setActivationPaused(paused); if (paused) { activationVideoPlaying.current = !!media.intent?.playing; audio.current.pause(); sectionMusic.pause(); void media.command('pause'); } else { audio.current.resume(); sectionMusic.resume(); if (activationVideoPlaying.current) void media.command('play'); activationVideoPlaying.current = false; } }}
            onStop={() => { setActivationPaused(false); setSession(old => exitActivation(project, old)); }}
            onEvent={recordActivation} />
          {file && <details className="game-setup-compartment"><summary>Progress and rewards</summary><ProgressionPanel project={project} folder={file.folderPath} roster={roster} participants={participants} refreshKey={progressionRevision} onChange={progressionChanged} /></details>}
        </div>}
        {mode === 'edit' ? <div><label>Lesson title<input value={project.title} onChange={e => apply({ ...project, title: e.target.value })} /></label>
          {editScene && Object.values(project.sequences).flat().filter(entry => entry.sceneId === editScene.id).length > 1 && <p className="lesson-shared-note">Shared scene: changes appear wherever this scene is reused. Use an independent copy to edit separately.</p>}
          {musicSection && <SectionMusicControls section={musicSection} assets={project.assets} onChange={section => apply({ ...project, sections: project.sections?.map(item => item.id === section.id ? section : item) })} onPlay={tracks => { void sectionMusic.play(tracks, resolve).catch(reason => setError(String(reason))); }} onStop={() => sectionMusic.stop()} />}
          <SceneInspector resolveAsset={resolve} onPlayAudio={tracks => { void audio.current.play(tracks, resolve).catch(reason => setError(String(reason))); }} onStopAudio={() => audio.current.stop()} entryKind={project.sequences[selection.sequence].find(e => e.id === selection.entryId)?.kind} registry={mediaRegistry.registry!} project={project} scene={editScene} object={object} onSelectObject={id => selectMany(id ? [id] : [])} onPreviewFace={previewFace} onSceneChange={changeScene} onObjectChange={item => editScene && apply(putObject(project, editScene.id, item))} onCardChange={card => apply(putCard(project, card))} onDelete={removeSelected} onDuplicate={duplicateSelected} onLayer={direction => editScene && object && apply(layerObject(project, editScene.id, object.id, direction))}
            onSaveSet={set => apply({ ...project, cardSets: [...project.cardSets.filter(item => item.id !== set.id), set] })}
            onInsertSet={id => { if (!editScene) return; try { const result = insertCardSet(project, editScene.id, id); apply(result.project); setSelection(old => ({ ...old, objectId: result.objectIds[0] ?? null })); } catch (reason) { setError(String(reason)); } }}
            onLibrarySave={() => object?.kind === 'card' && apply({ ...project, library: [...new Set([...project.library, object.cardId])] })}
            onLibraryInsert={(id, linked) => editCommand(() => { if (!editScene) return; const result = addCard(project, editScene.id, id, linked); apply(result.project); setSelection(old => ({ ...old, objectId: result.objectId })); })} />
        </div> : <>{musicSection && <SectionMusicControls section={liveMusicSection!} assets={project.assets} onVolumeChange={(track, volume) => { liveAudioLevels.setVolume(track, volume); const url = resolve(track.assetId); if (url) sectionMusic.setVolume(url, volume); }} onPlay={tracks => { if (!activationPaused) void sectionMusic.play(tracks, resolve).catch(reason => setError(String(reason))); }} onStop={() => sectionMusic.stop()} />}{liveScene && project.sequences[currentSequence].find(e => e.id === session.cursor?.entryId)?.kind === 'break' && <BreakAudioControls key={liveKey} scene={liveBreakScene!} assets={project.assets} onVolumeChange={(track, volume) => { liveAudioLevels.setVolume(track, volume); const url = resolve(track.assetId); if (url) audio.current.setVolume(url, volume); }} onPlay={tracks => { if (!activationPaused) void audio.current.play(tracks, resolve).catch(reason => setError(String(reason))); }} onStop={() => audio.current.stop()} />}<LessonTeachControls project={project} scene={liveScene} session={session} onSession={activationPaused ? () => {} : setSession} selectedId={liveObject} onSelect={setLiveObject} drawing={drawing} onDrawing={setDrawing} onPlayAudio={() => { if (liveScene && !activationPaused) void audio.current.play(liveAudioLevels.tracks(liveScene.audio), resolve).catch(reason => setError(String(reason))); }} onStopAudio={() => audio.current.stop()} /></>}
        <div hidden={mode !== 'teach'} aria-label="Live camera and translation"><CameraControls /><TranslationControls activeView={mode === 'teach'} /></div>
        </div>
      </div>
    </>}
    {menus.content}
    {recoveryOpen && file && <LessonRecoveryDialog folder={file.folderPath} current={() => latest.current} onClose={() => setRecoveryOpen(false)} onRestore={value => { if (value.id !== latest.current?.id || value.format !== latest.current?.format) { setError('Recovery project changed.'); return; } apply(value); setSelection(restoreEditorSelection(value, selection)); setNotice('Recovery checkpoint loaded. Undo returns to your previous work. Save to keep this version.'); }} />}
    <footer className="lesson-status"><span title="Automatic saves preserve history and keep recovery checkpoints">{autosave.status}</span><span>{busy ? 'Working…' : notice || (dirty ? 'Unsaved changes' : 'Saved')}</span><span>Present: {presentStatus ? ('state' in presentStatus ? String(presentStatus.state) : 'Connected') : 'Closed'}</span><span>{file?.isDraft ? 'Unsaved lesson' : file?.folderPath}</span></footer>
    <AudioSettingsWorkspace open={audioOpen} onClose={() => setAudioOpen(false)} />
  </div>;
}
