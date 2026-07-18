import type { AudioMeterReading } from "./AudioController";

function toDb(value: number): number {
  return value <= 0 ? -60 : Math.max(-60, 20 * Math.log10(value));
}

export function AudioMeter({
  label,
  reading,
  compact = false,
}: {
  label: string;
  reading: AudioMeterReading;
  compact?: boolean;
}) {
  const peakDb = toDb(reading.peak);
  const rmsDb = toDb(reading.rms);
  const percent = Math.max(0, Math.min(100, ((peakDb + 60) / 60) * 100));
  const level = peakDb >= -1 ? "clipping" : peakDb >= -9 ? "hot" : "normal";

  return (
    <div
      className={`audio-meter ${compact ? "audio-meter--compact" : ""}`}
      aria-label={`${label}: peak ${peakDb.toFixed(1)} decibels, RMS ${rmsDb.toFixed(1)} decibels`}
    >
      <div className="audio-meter__heading">
        <span>{label}</span>
        {!compact && <span>{peakDb.toFixed(1)} dB peak · {rmsDb.toFixed(1)} dB RMS</span>}
      </div>
      <div className="audio-meter__track">
        <span
          className={`audio-meter__fill audio-meter__fill--${level}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
