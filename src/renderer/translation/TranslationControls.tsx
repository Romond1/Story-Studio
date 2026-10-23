import { useEffect, useRef, useState } from 'react';
import type { JapaneseMode, TargetLanguage, TranslationRequest, SpeechExecution, SpeechBackend, TranslationSettings, TranslationEngineState } from '../../shared/translation';
import { CAPTION_STYLE, type CaptionStyle } from '../../shared/translation';
import { loadTranslationPreferences, parseTranslationPreferences, saveTranslationPreferences } from '../../shared/translationPreferences';
import { audioController } from '../audio/AudioController';
import { captureUtterance } from './capture';
import { bindTranslationHoldKey } from './holdToTalk';
import './translation.css';

export function TranslationControls({ activeView = true }: { activeView?: boolean }) {
  const [preferences] = useState(() => {
    try { return loadTranslationPreferences(window.localStorage); }
    catch { return parseTranslationPreferences(null); }
  });
  const [preferencesStatus, setPreferencesStatus] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [target, setTarget] = useState<TargetLanguage>(preferences.target);
  const [mode, setMode] = useState<JapaneseMode>(preferences.mode);
  const [model, setModel] = useState<'base.en' | 'small.en'>(preferences.model);
  const [execution, setExecution] = useState<SpeechExecution>(preferences.execution);
  const [speechBackend, setSpeechBackend] = useState<SpeechBackend>();
  const [engine, setEngine] = useState<TranslationEngineState>({phase:'off'});
  const enginePhase = useRef<TranslationEngineState['phase']>('off');
  const preparation = useRef(Promise.resolve());
  const [english, setEnglish] = useState('');
  const [draft, setDraft] = useState('');
  const [readings, setReadings] = useState(preferences.readings);
  const [auto, setAuto] = useState(preferences.auto);
  const [style,setStyle] = useState<CaptionStyle>(preferences.style);
  const [fontSize, setFontSize] = useState(preferences.fontSize);
  const [position, setPosition] = useState<'top' | 'bottom'>(preferences.position);
  const [status, setStatus] = useState('Translation off');
  const [busy, setBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [listening, setListening] = useState(false);
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const epoch = useRef(0);
  const recording = useRef<ReturnType<typeof captureUtterance> | null>(null);
  const active = useRef(false);
  const formatting = useRef(false);
  const processing = useRef(false);
  const api = window.translationControl;
  useEffect(() => {
    let saved = false;
    try { saved = saveTranslationPreferences(window.localStorage, { target, mode, model, execution, readings, auto, style, fontSize, position }); } catch { /* Storage may be unavailable. */ }
    setPreferencesStatus(saved ? 'Translation preferences saved automatically.' : 'Unable to save translation preferences on this device.');
  }, [target, mode, model, execution, readings, auto, style, fontSize, position]);
  useEffect(()=>{void api?.setAppearance?.({fontSize,position,style}).catch(()=>setStatus('Unable to update caption style.'));},[api,fontSize,position,style]);
  const invalidate = (hide = true, unload = false) => {
    epoch.current++;
    recording.current?.cancel(); recording.current = null;
    setListening(false); setBusy(false); setPublishing(false); formatting.current = false; processing.current = false;
    if (active.current) { void api?.cancel(unload).catch(() => {}); if (hide) void api?.publish(null).catch(() => {}); }
    return epoch.current;
  };
  useEffect(() => {
    if (!enabled || !api) return;
    return api.subscribeStatus(message => { if (active.current && (processing.current || enginePhase.current==='preparing')) setStatus(message); });
  }, [enabled, api]);
  useEffect(() => {
    if(!api)return;
    const update=(state:TranslationEngineState)=>{
      const prior=enginePhase.current;enginePhase.current=state.phase;setEngine(state);
      if(state.backend)setSpeechBackend(state.backend);
      if(state.phase==='off'){
        epoch.current++;recording.current?.cancel();recording.current=null;active.current=false;processing.current=false;formatting.current=false;
        setEnabled(false);setBusy(false);setListening(false);setPublishing(false);setSpeechBackend(undefined);setStatus('Translation off');
      }else if(active.current&&state.phase==='preparing')setStatus(state.message??'Preparing local models…');
      else if(active.current&&state.phase==='error')setStatus(state.message??'Prepare translation again.');
      else if(active.current&&state.phase==='ready'&&prior!=='ready')setStatus('Ready · local models loaded');
    };
    const unsubscribe=api.subscribeState(update),token=epoch.current;
    void api.getState().then(state=>{if(token===epoch.current)update(state);}).catch(()=>{});
    return unsubscribe;
  }, [api]);
  const prepareSelection=(patch:Partial<TranslationSettings>={})=>{
    const token=invalidate();setDraft('');enginePhase.current='preparing';setEngine({phase:'preparing'});setStatus('Preparing local models…');
    const settings={target,model,execution,...patch};
    preparation.current=preparation.current.catch(()=>{}).then(async()=>{
      if(token!==epoch.current||!active.current)return;
      try{await api.cancel();if(token!==epoch.current||!active.current)return;await api.prepare(settings);}
      catch(error){if(token===epoch.current&&active.current)setStatus(error instanceof Error?error.message:'Unable to prepare translation.');}
    });
  };
  useEffect(() => () => {
    epoch.current++; recording.current?.cancel();
    if (active.current) { void api?.cancel(true).catch(() => {}); void api?.publish(null).catch(() => {}); }
    active.current = false;
  }, [api]);
  const publish = async (text: string, token = epoch.current) => {
    if (!text.trim() || token !== epoch.current || !active.current || formatting.current) return;
    formatting.current = true; setPublishing(true); setStatus('Preparing caption…');
    try {
      const tokens = target === 'ja' ? await api.format(text, mode === 'standard' ? 'standard' : 'furigana') : [{ text }];
      if (token !== epoch.current || !active.current) return;
      const corrections = new Map(readings.split('\n').map(line => line.split('=').map(part => part.trim())).filter(parts => parts.length === 2 && parts.every(Boolean)).map(parts => [parts[0], parts[1]]));
      await api.publish({ language: target, mode, tokens: tokens.map(t => corrections.has(t.text) ? { ...t, reading: corrections.get(t.text) } : t), fontSize, position, style });
      if (token === epoch.current) setStatus('Translation published');
    } catch (error) { if (token === epoch.current) setStatus(error instanceof Error ? error.message : 'Unable to publish translation.'); }
    finally { if (token === epoch.current) { formatting.current = false; setPublishing(false); } }
  };
  const run = async (input: Pick<TranslationRequest, 'text' | 'audio'>, token: number) => {
    if (token !== epoch.current || !active.current) return;
    setListening(false); setBusy(true); processing.current = true; setStatus('Processing locally…');
    try {
      const result = await api.run({ ...input, target, model, execution });
      if (token !== epoch.current || !active.current) return;
      processing.current = false; setEnglish(result.transcript); setDraft(result.translation); setMetrics(result.metrics); setStatus('Ready to review');
      if (result.speechBackend) setSpeechBackend(result.speechBackend);
      if (auto) await publish(result.translation, token);
    } catch (error) { if (token === epoch.current) setStatus(error instanceof Error ? error.message : 'Translation failed.'); }
    finally { if (token === epoch.current) { setBusy(false); processing.current = false; } }
  };
  const start = () => {
    if (recording.current || processing.current || formatting.current || !active.current || enginePhase.current!=='ready') return false;
    const token = invalidate(); setDraft(''); setEnglish('');
    const stream = audioController.getRecognitionStream();
    if (!stream) { setStatus('Enable a microphone in Audio settings first.'); return false; }
    try {
      recording.current = captureUtterance(stream, () => audioController.getRecognitionStream(), audio => {
        if (token !== epoch.current) return;
        recording.current = null; void run({ audio }, token);
      }, error => { if (token === epoch.current) { recording.current = null; setListening(false); setBusy(false); setStatus(error); } });
      setListening(true); setStatus('Listening · maximum 20 seconds');
      return true;
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Unable to record.'); return false; }
  };
  const stop = () => { if (recording.current) { recording.current.stop(); setListening(false); setBusy(true); setStatus('Preparing microphone audio…'); } };
  const holdActions = useRef({ start, stop, cancel: () => { invalidate(); setStatus('Recording cancelled'); } });
  holdActions.current = {
    start: () => {
      if (!active.current) { setStatus('Turn translation on before holding W to talk.'); return false; }
      if (enginePhase.current !== 'ready') { setStatus('Wait for translation models to be ready, then hold W again.'); return false; }
      return start();
    },
    stop,
    cancel: () => { invalidate(); setStatus('Recording cancelled'); },
  };
  useEffect(() => {
    if (!activeView) return;
    let heldCapture: ReturnType<typeof captureUtterance> | null = null;
    return bindTranslationHoldKey(window, document, {
      start: () => {
        const started = holdActions.current.start();
        heldCapture = started ? recording.current : null;
        return started;
      },
      stop: () => {
        if (heldCapture && heldCapture === recording.current) holdActions.current.stop();
        heldCapture = null;
      },
      cancel: () => {
        if (heldCapture && heldCapture === recording.current && active.current) holdActions.current.cancel();
        heldCapture = null;
      },
    });
  }, [activeView]);
  useEffect(() => {
    if (!activeView && recording.current) { invalidate(false); setStatus('Recording cancelled when leaving Teach.'); }
  }, [activeView]);
  return <section className="translation-controls teach-live-card" aria-label="Translation">
    <h3>Translation</h3>
    <small role="status">{preferencesStatus}</small>
    <button type="button" disabled={!api||stopping} aria-pressed={enabled} onClick={async() => {
      if(enabled){setStopping(true);invalidate(true,true);active.current=false;setEnabled(false);setStatus('Releasing local models…');try{await api.cancel(true);}finally{setStopping(false);}}
      else{active.current=true;setEnabled(true);prepareSelection();}
    }}>{enabled ? 'Turn translation off' : 'Turn translation on'}</button>
    <p>Hold W to talk · release to translate (translation and microphone must be enabled).</p>
    <p role="status">{status}</p>
    {enabled && <>
      <label>Target language<select value={target} onChange={e => { const target=e.target.value as TargetLanguage;setTarget(target);prepareSelection({target}); }}><option value="ja">Japanese</option><option value="it">Italian</option><option value="ro">Romanian</option></select></label>
      {target === 'ja' && <label>Japanese display<select value={mode} onChange={e => { invalidate(); setMode(e.target.value as JapaneseMode); setStatus('Ready to review'); }}><option value="standard">Standard Japanese</option><option value="kana">Kana-only</option><option value="furigana">Furigana</option></select></label>}
      <div className="translation-buttons">
        <button type="button" disabled={busy||engine.phase!=='ready'} onPointerDown={e => { if (e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); start(); }} onPointerUp={stop} onPointerCancel={() => { invalidate(); setStatus('Recording cancelled'); }} onKeyDown={e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); start(); } }} onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); stop(); } }} onBlur={() => { if (recording.current) { invalidate(); setStatus('Recording cancelled'); } }}>Hold to talk</button>
        <button type="button" disabled={busy||engine.phase!=='ready'} aria-pressed={listening} onClick={() => listening ? stop() : start()}>{listening ? 'Stop listening' : 'Start listening'}</button>
        {(busy || listening) && <button type="button" onClick={() => { invalidate(); setStatus('Cancelled'); }}>Cancel</button>}
      </div>
      <p>Engine: {engine.phase==='ready'?'READY':engine.phase==='preparing'?'PREPARING':engine.phase==='error'?'Needs preparation':'OFF'}</p>
      {engine.phase==='error'&&<button type="button" onClick={()=>prepareSelection()}>Prepare translation again</button>}
      {speechBackend && <p>Last speech backend: {speechBackend.backend === 'cuda' ? `NVIDIA CUDA${speechBackend.device ? ` · ${speechBackend.device}` : ''}` : 'CPU'}{speechBackend.reason ? ` · ${speechBackend.reason}` : ''}</p>}
      <label>English · private<textarea maxLength={2000} value={english} onChange={e => { invalidate(); setEnglish(e.target.value); setDraft(''); setStatus('Ready'); }} /></label>
      <button type="button" disabled={busy || listening || engine.phase!=='ready' || !english.trim()} onClick={() => { const token = invalidate(); setDraft(''); void run({ text: english }, token); }}>Translate English</button>
      <label>Translation draft<textarea lang={target} maxLength={2000} value={draft} onChange={e => { invalidate(); setDraft(e.target.value); setStatus('Ready to review'); }} /></label>
      <div className="translation-buttons"><button type="button" disabled={busy || publishing || listening || !draft.trim()} onClick={() => { if (formatting.current) return; const token = ++epoch.current; void publish(draft, token); }}>Publish translation</button><button type="button" onClick={() => { invalidate(); setStatus('Caption hidden'); }}>Clear / hide</button></div>
      <details><summary>Caption and recognition settings</summary>
        <label className="translation-check"><input type="checkbox" checked={auto} onChange={e => { invalidate(); setAuto(e.target.checked); }} />Auto-publish (skip review)</label>
        <label>Speech processing<select value={execution} onChange={e => { const execution=e.target.value as SpeechExecution;setExecution(execution);prepareSelection({execution}); }}><option value="auto">Auto (GPU when available)</option><option value="gpu">GPU (NVIDIA CUDA)</option><option value="cpu">CPU</option></select></label>
        <label>Speech model<select value={model} onChange={e => { const model=e.target.value as 'base.en'|'small.en';setModel(model);prepareSelection({model}); }}><option value="base.en">Base English (default)</option><option value="small.en">Small English (higher resource use)</option></select></label>
        {target === 'ja' && <label>Reading corrections (one token=reading per line)<textarea value={readings} maxLength={2000} placeholder={'勇者=ゆうしゃ'} onChange={e => { invalidate(); setReadings(e.target.value); }} /><span>Overrides exact analyzer tokens. Review names and unusual readings.</span></label>}
        {Object.keys(metrics).length > 0 && <p>{Object.entries(metrics).map(([key, value]) => `${key}: ${Math.round(value)}`).join(' · ')}</p>}
      </details>
    </>}
    <details className="caption-appearance"><summary>Caption appearance</summary>
        <label>Caption font size<input type="number" min="20" max="72" value={fontSize} onChange={e => { setFontSize(Math.max(20, Math.min(72, Number(e.target.value) || 36))); }} /></label>
        <label>Caption position<select aria-label="Caption position" value={position} onChange={e => { setPosition(e.target.value as 'top' | 'bottom'); }}><option value="top">Top (away from lower camera)</option><option value="bottom">Bottom</option></select></label>
        <label>Caption font<select aria-label="Caption font" value={style.font} onChange={e=>setStyle(s=>({...s,font:e.target.value as CaptionStyle['font']}))}><option value="sans">Sans serif · Japanese compatible</option><option value="serif">Serif</option><option value="rounded">Rounded</option><option value="mono">Monospace</option></select></label>
        <label>Text color<input type="color" value={style.color} onChange={e=>setStyle(s=>({...s,color:e.target.value}))}/></label>
        <label>Background color<input type="color" value={style.background} onChange={e=>setStyle(s=>({...s,background:e.target.value}))}/></label>
        <label>Background opacity · {Math.round(style.opacity*100)}%<input aria-label="Caption background opacity" type="range" min="0" max="1" step="0.05" value={style.opacity} onChange={e=>setStyle(s=>({...s,opacity:Number(e.target.value)}))}/></label>
        <small>Set opacity to 0 for a transparent background.</small>
        <label>Text alignment<select aria-label="Text alignment" value={style.align} onChange={e=>setStyle(s=>({...s,align:e.target.value as CaptionStyle['align']}))}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
        <label className="translation-check"><input type="checkbox" checked={style.bold} onChange={e=>setStyle(s=>({...s,bold:e.target.checked}))}/>Bold text</label>
        <label className="translation-check"><input type="checkbox" checked={style.outline} onChange={e=>setStyle(s=>({...s,outline:e.target.checked}))}/>Dark text outline</label>
        {([['lineHeight','Line spacing',1,2.5,.1],['width','Caption maximum width (%)',20,100,1],['offset','Distance from edge (%)',0,40,1]] as const).map(([key,label,min,max,step])=><label key={key}>{label}<input type="number" min={min} max={max} step={step} value={style[key]} onChange={e=>setStyle(s=>({...s,[key]:Math.max(min,Math.min(max,Number(e.target.value)||min))}))}/></label>)}
        <button type="button" onClick={()=>{setStyle(CAPTION_STYLE);setFontSize(36);setPosition('top');}}>Reset caption appearance</button>
    </details>
  </section>;
}
