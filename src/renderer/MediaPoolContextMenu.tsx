import { useEffect, useRef } from 'react';
import './mediaPoolPreview.css';

export interface MediaPoolMenuTarget { assetId: string; x: number; y: number }

/** Native top layer keeps this small menu above the pool's scrolling/clipping panels. */
export function MediaPoolContextMenu({ target, onClose, onRemove, onAdd }: {
  target: MediaPoolMenuTarget; onClose: () => void; onRemove: () => void; onAdd?: () => void;
}) {
  const menu = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = menu.current!, trigger = document.activeElement as HTMLElement | null;
    const fallback = trigger?.closest('section')?.querySelector<HTMLInputElement>('input[aria-label="Search media"]');
    node.showModal();
    const position = () => {
      node.style.left = `${Math.max(8, Math.min(target.x, window.innerWidth - node.offsetWidth - 8))}px`;
      node.style.top = `${Math.max(8, Math.min(target.y, window.innerHeight - node.offsetHeight - 8))}px`;
    };
    position(); node.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    window.addEventListener('resize', position);
    return () => {
      window.removeEventListener('resize', position); node.close();
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      else if (fallback?.isConnected) fallback.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={menu} role="menu" aria-label="Media Pool actions" className="media-pool-context-menu"
    onContextMenu={event => { event.preventDefault(); event.stopPropagation(); }}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }}
    onPointerDown={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()}
    onClick={event => {
      event.stopPropagation();
      if (event.target !== event.currentTarget) return;
      const r = event.currentTarget.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) onClose();
    }} onKeyDown={event => {
      event.stopPropagation();
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    }}>
    <button type="button" role="menuitem" onClick={() => { onRemove(); onClose(); }}>Remove from Media Pool</button>
    <button type="button" role="menuitem" disabled={!onAdd} onClick={() => { onAdd?.(); onClose(); }}>Add to Sequence</button>
  </dialog>;
}
