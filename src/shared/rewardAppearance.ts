export const REWARD_POSITIONS = ['topRight', 'topLeft', 'bottomRight', 'bottomLeft', 'center'] as const;
export interface RewardAppearance {
  position: typeof REWARD_POSITIONS[number];
  size: number;
  intensity: number;
}
export const DEFAULT_REWARD_APPEARANCE: RewardAppearance = { position: 'topRight', size: 1, intensity: 1 };
export function parseRewardAppearance(value: unknown): RewardAppearance | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some(key => !['position', 'size', 'intensity'].includes(key))
    || !REWARD_POSITIONS.includes(v.position as RewardAppearance['position'])
    || typeof v.size !== 'number' || !Number.isFinite(v.size) || v.size < .5 || v.size > 1.75
    || typeof v.intensity !== 'number' || !Number.isFinite(v.intensity) || v.intensity < 0 || v.intensity > 2) return null;
  return { position: v.position as RewardAppearance['position'], size: v.size, intensity: v.intensity };
}
/** Logical-scene coordinates and transforms are identical in Control and Present. */
export function rewardAnchorStyle(appearance: RewardAppearance | undefined, fallback: { positionTop: number; positionRight: number }) {
  if (!appearance) return { top: fallback.positionTop, right: fallback.positionRight };
  const { position, size } = appearance;
  if (position === 'center') return { top: '50%', left: '50%', right: 'auto', transform: `translate(-50%, -50%) scale(${size})`, transformOrigin: 'center center' };
  const left = position.endsWith('Left'), bottom = position.startsWith('bottom');
  return { top: bottom ? 'auto' : fallback.positionTop, bottom: bottom ? 120 : 'auto',
    left: left ? fallback.positionRight : 'auto', right: left ? 'auto' : fallback.positionRight,
    transform: `scale(${size})`, transformOrigin: `${left ? 'left' : 'right'} ${bottom ? 'bottom' : 'top'}` };
}
