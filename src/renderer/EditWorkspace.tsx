import { useEffect, createContext, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './editWorkspace.css';

type Area = 'content' | 'presentation' | 'audio' | 'tools' | 'inspector';
type Hosts = Partial<Record<Area, HTMLDivElement | null>>;
const EditHosts = createContext<Hosts | null>(null);

/** Move existing controls without transferring ownership of authoring state. */
export function EditDock({ area, children }: { area: Area; children: ReactNode }) {
  const hosts = useContext(EditHosts);
  if (!hosts) return <>{children}</>;
  return hosts[area] ? createPortal(<div className="edit-docked" onMouseDown={event => event.stopPropagation()}>{children}</div>, hosts[area]!) : null;
}

export function EditWorkspaceProvider({ enabled, children, hosts }: { enabled: boolean; children: ReactNode; hosts: Hosts }) {
  return <EditHosts.Provider value={enabled ? hosts : null}>{children}</EditHosts.Provider>;
}

export function useEditHosts() {
  const [hosts, setHosts] = useState<Hosts>({});
  const [refs] = useState(() => Object.fromEntries(
    (['content', 'presentation', 'audio', 'tools', 'inspector'] as Area[]).map(area =>
      [area, (node: HTMLDivElement | null) => setHosts(old => old[area] === node ? old : { ...old, [area]: node })])
  ) as Record<Area, (node: HTMLDivElement | null) => void>);
  return { hosts, refs };
}

export function EditInspector({ refs, title, tools, focus, onFocus, categories, pool, contextual, selectionKey, actions }: {
  refs: Record<Area, (node: HTMLDivElement | null) => void>; title: string; tools: ReactNode;
  focus: boolean; onFocus: () => void;
  categories: Exclude<Area, 'inspector'>[]; pool?: ReactNode; contextual?: ReactNode; selectionKey?: string; actions?: ReactNode;
}) {
  const [preferredTab, setTab] = useState<Exclude<Area, 'inspector'>>('content');
  useEffect(() => { if(selectionKey)setTab('content'); },[selectionKey]);
  const tab = categories.includes(preferredTab) ? preferredTab : categories[0];
  return <section className={`edit-inspector edit-tab-${tab}`} aria-label="Edit workspace">
    <header className="edit-inspector-heading"><strong>{title || 'Select lesson content'}</strong>{actions}<button onClick={onFocus} aria-expanded={!focus}>{focus ? 'Show inspector' : 'Focus canvas'}</button></header>
    {pool}
    <div className="edit-inspector-body" hidden={focus}>
      <div className="edit-tabs" role="tablist" aria-label="Edit workspace categories">
        {categories.map(area => <button key={area} role="tab" aria-selected={tab === area} aria-controls={`edit-${area}`} id={`edit-tab-${area}`} onClick={() => setTab(area)}>{area === 'tools' ? 'Lesson tools' : area[0].toUpperCase() + area.slice(1)}</button>)}
      </div>
      {(['content', 'presentation', 'audio', 'tools'] as const).map(area => <div key={area} id={`edit-${area}`} role="tabpanel" aria-labelledby={`edit-tab-${area}`} hidden={tab !== area}>
        {area === 'content' && contextual}{area === 'tools' && tools}<div ref={refs[area]} />
      </div>)}
      <div ref={refs.inspector} className="edit-existing-inspector" hidden={tab === 'tools' || (tab === 'content' && !!contextual)} />
    </div>
  </section>;
}
