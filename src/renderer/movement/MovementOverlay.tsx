import type { CSSProperties } from "react";
import type { MovementEventConfig } from "../../shared/types";
import "./movement.css";

interface MovementOverlayProps {
  event: MovementEventConfig | null;
  signal: number;
  getMediaUrl: (relativePath: string) => string;
}

function MovementIcon({
  animation,
  gifUrl,
}: {
  animation: MovementEventConfig["animation"];
  gifUrl: string | null;
}) {
  if (gifUrl) {
    return (
      <div className="movement-gif-frame">
        <img src={gifUrl} alt="" className="movement-gif" />
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

export function MovementOverlay({ event, signal, getMediaUrl }: MovementOverlayProps) {
  if (!event) return null;
  const gifUrl = event.gifRelativePath ? getMediaUrl(event.gifRelativePath) : null;

  return (
    <div
      key={`${event.id}-${signal}`}
      className={`movement-overlay movement-${event.animation}`}
      style={{
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
