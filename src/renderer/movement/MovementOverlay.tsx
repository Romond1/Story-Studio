import { useEffect, useState, type CSSProperties } from "react";
import { movementRemaining, type MovementPresentation } from "../../shared/movementPresentation";
import { LogicalSceneFrame } from "../StaticScene";
import { movementMediaUrl } from "./builtinMedia";
import type { MovementEventConfig } from "../../shared/types";
import "./movement.css";

interface MovementOverlayProps { presentation: MovementPresentation | null; canonical?: boolean }
export function MovementSurface({ presentation }: MovementOverlayProps) {
  if (!presentation) return null;
  return <div data-movement-surface style={{ position: 'absolute', inset: 0, zIndex: 30000, pointerEvents: 'none' }}><LogicalSceneFrame frame={presentation.frame} transparent><MovementOverlay presentation={presentation} canonical /></LogicalSceneFrame></div>;
}
function MovementIcon({
  animation,
  gifUrl,
}: {
  animation: MovementEventConfig["animation"];
  gifUrl: string | null;
}) {
  const [failed, setFailed] = useState(false);
  if (gifUrl && !failed) {
    return (
      <div className="movement-gif-frame">
        <img src={gifUrl} alt="" className="movement-gif" onError={() => setFailed(true)} />
      </div>
    );
  }

  if (animation === "runner") {
    return <div className="movement-runner" aria-hidden="true">RUN</div>;
  }
  if (animation === "hero-flash") {
    return <div className="movement-hero" aria-hidden="true">SHIELD</div>;
  }
  if (animation === "head-bounce") {
    return <div className="movement-body-icon" aria-hidden="true">HEAD</div>;
  }
  if (animation === "nose-bounce") {
    return <div className="movement-body-icon movement-nose" aria-hidden="true">NOSE</div>;
  }
  return <div className="movement-color-gem" aria-hidden="true" />;
}

export function MovementOverlay({ presentation, canonical = false }: MovementOverlayProps) {
  if (!presentation) return null;
  return <MovementInstance key={presentation.id} presentation={presentation} canonical={canonical} />;
}
function MovementInstance({ presentation, canonical }: { presentation: MovementPresentation; canonical: boolean }) {
  const [elapsed] = useState(() => Math.max(0, Date.now() - presentation.startedAt));
  const [expired, setExpired] = useState(() => movementRemaining(presentation, Date.now()) === 0);
  useEffect(() => {
    const timeout = window.setTimeout(() => setExpired(true), movementRemaining(presentation, Date.now()));
    return () => window.clearTimeout(timeout);
  }, [presentation.id]);
  if (expired) return null;
  const event = presentation.event;
  const gifUrl = event.gifRelativePath ? movementMediaUrl(event.gifRelativePath, presentation.id) : null;
  return (
    <div
      data-movement-id={presentation.id}
      className={`movement-overlay movement-${event.animation}`}
      style={{
        "--movement-elapsed": `${elapsed}ms`,
        ...(canonical ? { "--movement-vw": `${presentation.frame.width / 100}px` } : {}),
        "--movement-duration": `${event.durationSeconds}s`,
        "--movement-overlay-opacity": event.overlayOpacity ?? 0.72,
        "--movement-ring-speed": `${event.ringSpeedSeconds ?? 1.5}s`,
        "--movement-intensity": event.intensity ?? 1,
        "--movement-primary": event.primaryColor || "#ff4094",
        "--movement-secondary": event.secondaryColor || "#44dcff",
        "--movement-accent": event.accentColor || "#ffea5c",
        "--movement-gif-scale": event.gifScale ?? 1,
      } as CSSProperties}
    >
      <div className="movement-burst-rings" aria-hidden="true" />
      <div className="movement-overlay-card">
        <MovementIcon animation={event.animation} gifUrl={gifUrl} />
        <div className="movement-overlay-name">{event.name}</div>
        <div className="movement-overlay-instruction">{event.instruction}</div>
      </div>
    </div>
  );
}
