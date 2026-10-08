import { useRef, useState, type MutableRefObject, type SetStateAction } from 'react';
import { createEditSelection, editSessionView, selectEdit, type EditSelection } from '../shared/editSelection';
import type { PresentationSession } from '../shared/presentationSession';
import type { ProjectState } from '../shared/types';

export function useEditSelection(project: MutableRefObject<ProjectState|null>, live: PresentationSession) {
  const [value,render] = useState(()=>createEditSelection(project.current?.data ?? null));
  const cursor = useRef(value);
  const ref = useRef(editSessionView(cursor.current,live)); ref.current=editSessionView(cursor.current,live);
  const publish = () => { ref.current=editSessionView(cursor.current,live); render(cursor.current); };
  const reset = () => { cursor.current = createEditSelection(project.current?.data ?? null); publish(); };
  const select = <K extends Exclude<keyof EditSelection,'revision'>>(key:K,value:SetStateAction<EditSelection[K]>) => {
    const resolved = typeof value==='function' ? (value as (previous:EditSelection[K])=>EditSelection[K])(cursor.current[key]) : value;
    cursor.current=selectEdit(cursor.current,{[key]:resolved}); publish();
  };
  return {cursor,session:ref.current,ref,reset,
    commit:(session:PresentationSession)=> {const {mode,storySlideId,sectionId,boostTab,boostItemId,boardId}=session;cursor.current=selectEdit(cursor.current,{mode,storySlideId,sectionId,boostTab,boostItemId,boardId});publish();},
    setTopMode:(v:SetStateAction<EditSelection['mode']>)=>select('mode',v),
    setSelectedSectionId:(v:SetStateAction<string|null>)=>select('sectionId',v),
    setCurrentIndex:(index:number)=>select('storySlideId',project.current?.data.slides[index]?.id??null),
    setBoostTab:(v:SetStateAction<EditSelection['boostTab']>)=>select('boostTab',v),
    setSelectedBoostItemId:(v:SetStateAction<string|null>)=>select('boostItemId',v),
    setSelectedACardId:(v:SetStateAction<string|null>)=>select('boardId',v),
  };
}
