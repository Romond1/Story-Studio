import { useCallback, useRef } from "react";
import gsap from "gsap";

export function useScreenShake() {
  const targetRef = useRef<HTMLElement | null>(null);
  const isShakingRef = useRef(false);

  const bindShakeTarget = useCallback((el: HTMLElement | null) => {
    targetRef.current = el;
  }, []);

  const triggerShake = useCallback((intensity: "light" | "medium" | "heavy" = "medium") => {
    const el = targetRef.current;
    if (!el || isShakingRef.current) return;
    isShakingRef.current = true;

    const px = intensity === "light" ? 2 : intensity === "heavy" ? 6 : 4;
    const duration = intensity === "light" ? 0.12 : intensity === "heavy" ? 0.35 : 0.22;
    const repeats = intensity === "light" ? 2 : intensity === "heavy" ? 5 : 3;

    const tl = gsap.timeline({
      onComplete: () => {
        gsap.set(el, { x: 0, y: 0 });
        isShakingRef.current = false;
      },
    });

    for (let i = 0; i < repeats; i++) {
      const xOff = (Math.random() - 0.5) * px * 2;
      const yOff = (Math.random() - 0.5) * px * 2;
      tl.to(el, { x: xOff, y: yOff, duration: duration / repeats, ease: "power2.inOut" });
    }
    tl.to(el, { x: 0, y: 0, duration: duration / repeats, ease: "power2.out" });
  }, []);

  return { bindShakeTarget, triggerShake };
}
