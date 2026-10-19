import { useEffect, useRef, useState } from 'react';
import type { LessonProject } from '../../shared/lesson/model';
import type { EpisodeActivity, RunContext, ActivityEvent, LifecycleCommand } from '../../shared/modules/model';
import type { HostToModuleMessage, EditorOperation, EditorResult, EditorAsset } from '../../shared/modules/protocol';
import { parseModuleToHostMessage, sameRunContext } from '../../shared/modules/protocol';
import { putEpisodeActivity } from '../../shared/episode/commands';
import { collectModuleAssets } from '../../shared/modules/media';
import { createEventLedger, acceptActivityEvent, type EventLedger } from '../../shared/modules/runtime';

type Init = Extract<HostToModuleMessage, { type: 'initialize' }>;
type Run = { initialization: Init; activityId: string; configRevision: number; authored: string; ledger: EventLedger };
/** Control owns authored changes; this hook keeps only disposable run state. */
export function useEpisodeModuleHost(getProject: () => LessonProject | null, commit: (project: LessonProject) => void, onRecorded: () => void = () => {}, editor?: (operation:EditorOperation, isCurrent:()=>boolean)=>Promise<EditorResult>) {
  const callbacks = useRef({ getProject, commit, onRecorded, editor }); callbacks.current = { getProject, commit, onRecorded, editor };
  const eventQueue = useRef(Promise.resolve());
  const run = useRef<Run | null>(null);
  const waiters = useRef(new Map<string, { resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>());
  const [state, setState] = useState('stopped'), [error, setError] = useState('');
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const envelope = (current: Run, requestId: string = crypto.randomUUID()) => {
    const { channel, version, moduleType, moduleVersion, hostGeneration, context } = current.initialization;
    return { channel, version, moduleType, moduleVersion, hostGeneration, context, requestId };
  };
  const settle = (id: string, reason?: string) => { const waiter = waiters.current.get(id); if (!waiter) return; clearTimeout(waiter.timer); waiters.current.delete(id); reason ? waiter.reject(new Error(reason)) : waiter.resolve(); };
  useEffect(() => window.appApi.onModuleEvent(value => {
    const message = parseModuleToHostMessage(value), current = run.current;
    if (!message || !current || message.hostGeneration !== current.initialization.hostGeneration || !sameRunContext(message.context, current.initialization.context)) return;
    if (message.type === 'ready') {
      void window.appApi.sendModuleHost({ ...envelope(current), type: 'start' }).catch(reason => setError(String(reason)));
    } else if (message.type === 'ack') {
      setState(message.command === 'start' || message.command === 'resume' ? 'running' : message.command === 'pause' ? 'paused' : message.command);
    } else if (message.type === 'error') {
      setError(message.message); setState('error'); run.current = null;
      for (const id of waiters.current.keys()) settle(id, message.message);
    }
    else if(message.type==='config-failed') {setError(message.message);settle(message.requestId,message.message);}
    else if (message.type === 'config-proposal') {
      let reason: string | undefined;
      try {
        if (message.expectedRevision !== current.configRevision) throw new Error('Activity settings changed while this edit was pending. Retry Save.');
        const project = callbacks.current.getProject();
        if (project?.format !== 'story-studio-episode' || project.id !== message.context.episodeId || project.adventure.id !== message.context.adventureId) throw new Error('The episode changed.');
        const activity = project.activities?.find(item => item.id === current.activityId);
        if (!activity || activity.moduleType !== message.moduleType) throw new Error('Activity is no longer available.');
        if (JSON.stringify(activity.config) !== current.authored) throw new Error('Activity settings were changed in Control. Restart the activity before submitting further edits.');
        if (JSON.stringify(activity.config) !== JSON.stringify(message.config)) callbacks.current.commit(putEpisodeActivity(project, { ...activity, config: message.config } as EpisodeActivity));
        current.authored = JSON.stringify(message.config);
        current.configRevision++;
        setError('');
      } catch (failure) { reason = String(failure); setError(reason); }
      void window.appApi.sendModuleHost({ ...envelope(current, message.requestId), type: 'config-ack', accepted: !reason, configRevision: current.configRevision, ...(reason ? { reason } : {}) })
        .then(ok => settle(message.requestId, reason ?? (!ok ? 'Activity acknowledgment was rejected.' : undefined)))
        .catch(failure => settle(message.requestId, String(failure)));
    } else if (message.type === 'editor-request') {
      const isCurrent=()=>run.current===current&&callbacks.current.getProject()?.id===message.context.episodeId;
      void Promise.resolve().then(()=>{
        if(!isCurrent()||!callbacks.current.editor)throw new Error('Episode editor is no longer available.');
        return callbacks.current.editor(message.operation,isCurrent);
      }).catch(failure=>({ok:false,reason:String(failure)})).then(result=>{
        if(isCurrent())return window.appApi.sendModuleHost({...envelope(current,message.requestId),type:'editor-response',...result});
      }).catch(failure=>setError(String(failure)));
    } else if (message.type === 'inventory-request') {
      void window.appApi.progression.getRunInventory(message.context).then(inventory => window.appApi.sendModuleHost({ ...envelope(current, message.requestId), type: 'inventory-response', inventory })).catch(failure => setError(String(failure)));
    } else if (message.type === 'event') {
      const { ledger, result } = acceptActivityEvent(current.ledger, message.event); current.ledger = ledger;
      eventQueue.current = eventQueue.current.then(async () => {
        let accepted = result.accepted, reason = result.reason;
        if (accepted) {
          try {
            const saved = await window.appApi.progression.recordEvent(message.event);
            accepted = saved.accepted; reason = saved.reason;
            if (accepted) {
              if (run.current === current) setEvents(old => old.some(event => event.eventId === message.event.eventId) ? old : [...old, message.event]);
              callbacks.current.onRecorded();
            }
          } catch (failure) { accepted = false; reason = String(failure); }
        }
        if (!accepted) setError(reason ?? 'Core could not record the activity result.');
        await window.appApi.sendModuleHost({ ...envelope(current, message.requestId), type: 'event-ack', eventId: message.event.eventId, accepted, ...(reason ? { reason } : {}) });
      }).catch(failure => setError(String(failure)));
    }
  }), []);
  useEffect(() => () => { for (const id of waiters.current.keys()) settle(id, 'Activity closed.'); }, []);
  const initialize = async (activity: EpisodeActivity, context: RunContext, resolve: (id: string) => string | undefined) => {
    const mediaMap: Record<string, string> = {};
    for (const use of collectModuleAssets(activity)) if (use.assetId) {
      const url = resolve(use.assetId); if (!url) { if(activity.moduleType==='final-boss-hero')continue; throw new Error(`Activity media unavailable: ${use.assetId}`); } mediaMap[use.ref] = url;
    }
    const runtime = await window.appApi.getPresentMediaRuntime();
    const initialization: Init = { channel:'story-studio-module',version:1,moduleType:activity.moduleType,moduleVersion:1,hostGeneration:runtime.generation,requestId:crypto.randomUUID(),context,type:'initialize',configVersion:1,config:activity.config,configRevision:0,mediaMap };
    run.current = { initialization, activityId: activity.id, configRevision: 0, authored: JSON.stringify(activity.config), ledger: createEventLedger(context, activity.moduleType) };
    setError(''); setEvents([]); setState('initializing');
    if (!await window.appApi.sendModuleHost(initialization)) { run.current = null; throw new Error('Activity initialization was rejected.'); }
  };
  const command = async (type: Exclude<LifecycleCommand, 'initialize' | 'reset'>) => {
    const current = run.current; if (!current) return;
    if (!await window.appApi.sendModuleHost({ ...envelope(current), type })) throw new Error('Activity command was rejected.');
  };
  const flush = async () => {
    const current = run.current; if (!current) return;
    const requestId = crypto.randomUUID();
    const completion = new Promise<void>((resolve, reject) => { const timer = setTimeout(() => settle(requestId, 'Activity settings did not acknowledge Save. Try again after the activity responds.'), 15000); waiters.current.set(requestId, { resolve, reject, timer }); });
    void window.appApi.sendModuleHost({ ...envelope(current, requestId), type: 'config-request' }).then(ok => { if (!ok) settle(requestId, 'Activity settings request was rejected.'); }).catch(reason => settle(requestId, String(reason)));
    await completion;
    await eventQueue.current;
  };
  const stop = () => { const current = run.current; if (current) void window.appApi.sendModuleHost({ ...envelope(current), type:'dispose' }).catch(()=>{}); run.current = null; setState('stopped'); for (const id of waiters.current.keys()) settle(id, 'Activity closed.'); };
  const updateMedia=(assets:EditorAsset[])=>{const current=run.current;if(current&&current.initialization.moduleType==='final-boss-hero')void window.appApi.sendModuleHost({...envelope(current),type:'media-catalogue',assets}).catch(failure=>setError(String(failure)));};
  return { initialize, command, flush, stop, updateMedia, state, error, events, isActive: !!run.current, activityId: run.current?.activityId };
}
