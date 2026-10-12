import { useEffect } from "react";

const MAX_TILT_DEG = 16; // dramatic but still readable over Zoom
const BG_PARALLAX_PX = 26;

/**
 * Global pointer-driven 3D tilt + holographic glare.
 *
 * Every mini-game card already carries the shared `.motion-card` class, so a
 * single document-level listener gives all current and future cards a
 * pointer-tracked perspective tilt with zero per-plugin wiring. The listener
 * also publishes a subtle background-parallax offset on the document root that
 * the scene backgrounds read via CSS custom properties.
 *
 * Everything is expressed as CSS custom properties so the visual treatment
 * lives in styles.css and can be tuned without touching this hook.
 */
export function usePointerTilt3D(): void {
  useEffect(() => {
    const root = document.documentElement;
    let current: HTMLElement | null = null;
    let frame = 0;
    let pending: { card: HTMLElement | null; clientX: number; clientY: number } | null = null;

    const clearCard = (card: HTMLElement | null) => {
      if (!card) return;
      card.classList.remove("is-tilting");
      card.style.removeProperty("--rx");
      card.style.removeProperty("--ry");
      card.style.removeProperty("--pointer-x");
      card.style.removeProperty("--pointer-y");
    };

    const apply = () => {
      frame = 0;
      if (!pending) return;
      const { card, clientX, clientY } = pending;
      pending = null;

      // Background parallax follows the pointer across the whole viewport.
      const px = clientX / window.innerWidth - 0.5;
      const py = clientY / window.innerHeight - 0.5;
      root.style.setProperty("--bg-parallax-x", `${(-px * BG_PARALLAX_PX).toFixed(2)}px`);
      root.style.setProperty("--bg-parallax-y", `${(-py * BG_PARALLAX_PX).toFixed(2)}px`);

      if (card !== current) {
        clearCard(current);
        current = card;
      }
      if (!card) return;

      const rect = card.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const localX = (clientX - rect.left) / rect.width; // 0..1
      const localY = (clientY - rect.top) / rect.height; // 0..1
      const ry = (localX - 0.5) * (MAX_TILT_DEG * 2);
      const rx = -(localY - 0.5) * (MAX_TILT_DEG * 2);

      card.classList.add("is-tilting");
      card.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
      card.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
      card.style.setProperty("--pointer-x", `${(localX * 100).toFixed(1)}%`);
      card.style.setProperty("--pointer-y", `${(localY * 100).toFixed(1)}%`);
    };

    const handleMove = (event: PointerEvent) => {
      const target = event.target as Element | null;
      const card = (target?.closest?.(".motion-card") as HTMLElement | null) ?? null;
      pending = { card, clientX: event.clientX, clientY: event.clientY };
      if (frame === 0) {
        frame = window.requestAnimationFrame(apply);
      }
    };

    window.addEventListener("pointermove", handleMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handleMove);
      if (frame !== 0) window.cancelAnimationFrame(frame);
      clearCard(current);
      root.style.removeProperty("--bg-parallax-x");
      root.style.removeProperty("--bg-parallax-y");
    };
  }, []);
}
