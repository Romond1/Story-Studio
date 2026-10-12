import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const REPOSITION_DURATION_MS = 560;
const REPOSITION_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

export function useFlipListMotion(itemIds: string[]) {
  const nodeMapRef = useRef(new Map<string, HTMLElement>());
  const rectMapRef = useRef(new Map<string, DOMRect>());
  const idsSignature = useMemo(() => itemIds.join("|"), [itemIds]);

  useLayoutEffect(() => {
    const nextRects = new Map<string, DOMRect>();

    itemIds.forEach((itemId) => {
      const node = nodeMapRef.current.get(itemId);
      if (!node) return;

      const nextRect = node.getBoundingClientRect();
      nextRects.set(itemId, nextRect);

      const prevRect = rectMapRef.current.get(itemId);
      if (!prevRect) {
        // fill:"none" so the entry animation does NOT hold a transform afterward
        // (a held transform would override the CSS hover/tilt and cause flicker).
        node.animate(
          [
            { opacity: 0, transform: "translateY(10px) scale(0.98)" },
            { opacity: 1, transform: "translateY(0) scale(1)" },
          ],
          {
            duration: 400,
            easing: REPOSITION_EASING,
            fill: "none",
          },
        );
        return;
      }

      const dx = prevRect.left - nextRect.left;
      const dy = prevRect.top - nextRect.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;

      node.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: "translate(0, 0)" },
        ],
        {
          duration: REPOSITION_DURATION_MS,
          easing: REPOSITION_EASING,
        },
      );
    });

    rectMapRef.current = nextRects;
    // Only re-run when the set of ids actually changes (reorder/add/remove), NOT
    // on every re-render — otherwise hover-induced rect changes (scale/lift) fire
    // spurious reposition animations that flicker against the tilt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsSignature]);

  const bindFlipItem = useCallback(
    (itemId: string) => (node: HTMLElement | null) => {
      if (!node) {
        nodeMapRef.current.delete(itemId);
        return;
      }
      nodeMapRef.current.set(itemId, node);
    },
    [],
  );

  return { bindFlipItem };
}

export function useShakeFeedback(durationMs = 480) {
  const [shakeMap, setShakeMap] = useState<Record<string, true>>({});
  const timeoutMapRef = useRef(new Map<string, number>());

  useEffect(
    () => () => {
      timeoutMapRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeoutMapRef.current.clear();
    },
    [],
  );

  const triggerShake = useCallback(
    (id: string) => {
      setShakeMap((prev) => ({ ...prev, [id]: true }));
      const activeTimeout = timeoutMapRef.current.get(id);
      if (activeTimeout !== undefined) {
        window.clearTimeout(activeTimeout);
      }
      const timeoutId = window.setTimeout(() => {
        setShakeMap((prev) => {
          if (!prev[id]) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
        timeoutMapRef.current.delete(id);
      }, durationMs);
      timeoutMapRef.current.set(id, timeoutId);
    },
    [durationMs],
  );

  const shakeClassName = useCallback(
    (id: string) => (shakeMap[id] ? "is-shaking" : ""),
    [shakeMap],
  );

  return {
    triggerShake,
    shakeClassName,
  };
}
