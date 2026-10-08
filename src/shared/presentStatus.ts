/** Teacher-facing lifecycle; transport detail remains available for diagnostics. */
export interface PresentStatus {
  state: 'closed' | 'connecting' | 'ready' | 'error';
  generation: number;
  sequence: number;
  needsReshare: boolean;
  detail?: string;
  viewport?: { width: number; height: number };
}
