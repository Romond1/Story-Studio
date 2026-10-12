import { useEffect, useRef, useState } from "react";

interface Dice3DProps {
  value: number;
  spinning: boolean;
  side?: "hero" | "villain" | "neutral";
}

// Rotation that brings each face toward the viewer (front=1, back=6, etc.).
const FACE_REST: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: -90, y: 0 },
  3: { x: 0, y: -90 },
  4: { x: 0, y: 90 },
  5: { x: 90, y: 0 },
  6: { x: 0, y: 180 },
};

// 3x3 pip slots (top-left -> bottom-right) used per face value.
const PIP_LAYOUT: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function Face({ value, className }: { value: number; className: string }) {
  return (
    <div className={`dice3d-face ${className}`}>
      <div className="dice3d-pips">
        {Array.from({ length: 9 }, (_, slot) => (
          <span key={slot} className={`dice3d-pip ${PIP_LAYOUT[value].includes(slot) ? "is-on" : ""}`} />
        ))}
      </div>
    </div>
  );
}

export function Dice3D({ value, spinning, side = "neutral" }: Dice3DProps) {
  // Accumulate extra full turns each settle so the die visibly tumbles to rest.
  const spinsRef = useRef(0);
  const [resting, setResting] = useState({ x: -20, y: 20 });

  useEffect(() => {
    if (spinning) return;
    const safeValue = FACE_REST[value] ? value : 1;
    spinsRef.current += 1;
    const turns = spinsRef.current;
    setResting({
      x: FACE_REST[safeValue].x - 360 * turns,
      y: FACE_REST[safeValue].y + 360 * turns,
    });
  }, [spinning, value]);

  const transform = spinning
    ? undefined
    : `translateZ(-32px) rotateX(${resting.x}deg) rotateY(${resting.y}deg)`;

  return (
    <div className={`dice3d dice3d--${side} ${spinning ? "is-rolling" : ""}`} aria-label={`Dice showing ${value}`}>
      <div className="dice3d-cube" style={transform ? { transform } : undefined}>
        <Face value={1} className="dice3d-face--front" />
        <Face value={6} className="dice3d-face--back" />
        <Face value={3} className="dice3d-face--right" />
        <Face value={4} className="dice3d-face--left" />
        <Face value={2} className="dice3d-face--top" />
        <Face value={5} className="dice3d-face--bottom" />
      </div>
    </div>
  );
}
