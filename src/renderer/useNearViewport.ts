import { useEffect, useState, type RefObject } from 'react';

type Group = {observer:IntersectionObserver;listeners:Map<Element,(near:boolean)=>void>};
const groups=new Map<Element|null,Group>();
/** Share observers across thumbnails and release them when their scroll container unmounts. */
export function useNearViewport<T extends HTMLElement>(ref:RefObject<T>,enabled=true):boolean {
  const [near,setNear]=useState(false);
  useEffect(()=>{
    const node=ref.current;if(!enabled||!node)return;
    if(typeof IntersectionObserver==='undefined'){setNear(true);return;}
    // The grid can grow beyond a clipped parent. A grid-root observer would count
    // every row as visible; the viewport root also respects all ancestor clips.
    const root=null;
    let group=groups.get(root);
    if(!group){const listeners=new Map<Element,(near:boolean)=>void>();const observer=new IntersectionObserver(entries=>{for(const entry of entries)listeners.get(entry.target)?.(entry.isIntersecting);},{root,rootMargin:'160px',threshold:0});group={observer,listeners};groups.set(root,group);}
    group.listeners.set(node,setNear);group.observer.observe(node);
    return()=>{group!.observer.unobserve(node);group!.listeners.delete(node);if(!group!.listeners.size){group!.observer.disconnect();groups.delete(root);}};
  },[enabled,ref]);
  return !enabled||near;
}
