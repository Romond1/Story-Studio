import type { AudioSettingsV1 } from "./audioSettings";

export type TransitionType = 'fade' | 'crossfade' | 'fade-black' | 'cinematic' | 'pixel' | 'blur' | 'card-slide';

export type MediaType = 'image' | 'video' | 'audio';

export interface AudioClip {
  url: string;
  volume: number;
  name?: string;
  shortcut?: string;
  color?: string;
  fadeEnabled?: boolean;
  tags?: string[];
}

export interface VideoAudioSettings {
  enabled: boolean;
  volume: number;
}

export interface VideoTrimSettings {
  inSec: number;
  outSec?: number;
}

export interface ImageAdjustmentSettings {
  flipX?: boolean;
  brightness?: number;
  contrast?: number;
  saturate?: number;
}

export interface DrawPoint {
  x: number;
  y: number;
  t: number;
  h?: number;
}

export interface MarkerStroke {
  id: string;
  color: string;
  size: number;
  opacity: number;
  rainbow: boolean;
  points: DrawPoint[];
}

export interface AssetItem {
  id: string;
  relativePath: string;
  filename: string;
  originalName: string;
  referenceCode?: string;
  referenceDescription?: string;
  canonicalLabel?: string;
  referenceContext?: 'section' | 'break' | 'general';
  referenceContextId?: string;
  referenceOrdinal?: number;
  mediaType: MediaType;
  sizeBytes: number;
  importedAt: string;
}

export interface BreakMedia {
  id: string;
  slideId: string;
  fit: 'cover' | 'contain';
  x?: number;
  y?: number;
  scale?: number;
}

export interface Section {
  id: string;
  name: string;
  type?: 'section' | 'break'; // Defaults to 'section'
  // Break-specific content
  questions?: string;
  timer?: boolean;
  timerMode?: 'countup' | 'countdown';
  timerDuration?: number; // in seconds
  thumbnailSize?: number;
  font?: string;
  fontSize?: number;
  isBold?: boolean;
  isItalic?: boolean;
  align?: 'left' | 'center' | 'right';
  position?: 'top' | 'center' | 'bottom';
  background?: string;
  backgroundOpacity?: number;
  breakMedia?: BreakMedia[];
  markerStrokes?: MarkerStroke[];
  bgm?: AudioClip[];
  breakViewport?: { zoom: number; panX: number; panY: number };
  bgTransform?: { x: number; y: number; scale: number; blur: number };
  titleFontSize?: number;
  timerSize?: number;
  tags?: string[];
  bCardInstances?: BCardInstance[];
  storyReferences?: StoryReferenceItem[];
}

export interface Slide {
  id: string;
  assetId: string;
  sectionId: string;
  name?: string;
  transition: TransitionType;
  transitionDuration?: number;
  transitionDirection?: 'left' | 'right' | 'up' | 'down';
  markerStrokes?: MarkerStroke[];
  dialogue?: AudioClip[];
  sfx?: AudioClip[];
  bgm?: AudioClip;
  videoAudio?: VideoAudioSettings;
  videoTrim?: VideoTrimSettings;
  imageAdjustments?: ImageAdjustmentSettings;
  tags?: string[];
  overlays?: OverlayItem[];
  audioCues?: AudioCue[];
  bCardInstances?: BCardInstance[];
  storyReferences?: StoryReferenceItem[];
}

export type ProjectSchemaVersion = 1 | 2 | 3 | 4;

export interface BubbleDef {
  bubbleDefId: string;
  name: string;
  templateName?: string;
  src: string; // png src
  type?: 'speech' | 'thought' | 'text' | 'normal';
  textRect?: { x: number, y: number, width: number, height: number }; // Normalized 0..1 relative to image bounds
  defaultStyle?: Record<string, unknown>;
}

export interface BubbleTemplate {
  templateName: string;
  imageSrc: string;
  defaultTextRect: { x: number; y: number; width: number; height: number };
}

export interface OverlayItem {
  id: string;
  type: 'speechBubble' | 'textBox';
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  align?: 'left' | 'center' | 'right';
  theme?: 'light' | 'dark' | 'accent';
  visible?: boolean;
  zIndex?: number;
  bubbleId?: string; // Human-readable reference ID (e.g., B1, B2)
  bubbleDefId?: string; // Reference to BubbleDef
  locked?: boolean;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  textColor?: string;
  flipX?: boolean;
  flipY?: boolean;
  lineHeight?: number;
  fontStyle?: 'normal' | 'italic';
  textShadow?: boolean;
  tailAngleDeg?: number;
  tailOffsetX?: number;
  tailOffsetY?: number;
  // Normalized text rectangle mapping
  textRect?: { x: number, y: number, width: number, height: number };
  tags?: string[];
  customImageSrc?: string;
}

export interface AudioCue {
  id: string;
  kind: 'dialogue' | 'sfx' | 'bgm' | 'music' | 'voiceover';
  label: string;
  timeSec: number;
  targetAssetId?: string;
  targetUrl?: string;
  volume?: number;
  fadeMs?: number;
  tags?: string[];
}

export interface BoostSceneItemBase {
  bCardInstances?: BCardInstance[];
}

export interface SlideRefItem extends BoostSceneItemBase {
  id: string;
  type: 'slideRef';
  slideId: string;
  viewOverride?: {
    zoom?: number;
    panX?: number;
    panY?: number;
  };
}

export interface BreakRefItem extends BoostSceneItemBase {
  id: string;
  type: 'breakRef';
  breakId: string;
  textOverride?: string;
}

export interface PromptCardItem extends BoostSceneItemBase {
  id: string;
  type: 'promptCard';
  title?: string;
  body: string;
  durationMs?: number;
}

export interface MiniGameItem extends BoostSceneItemBase {
  id: string;
  type: 'miniGame';
  gameType: 'placeholder';
  config?: Record<string, unknown>;
}

export interface ACardRefItem extends BoostSceneItemBase {
  id: string;
  type: 'aCardRef';
  aCardId: string;
}

export type SequenceItem = SlideRefItem | BreakRefItem | PromptCardItem | MiniGameItem | ACardRefItem;
export type StoryReferenceItem = ACardRefItem;

export interface BoostPack {
  activationSequence: SequenceItem[];
  languageSequence: SequenceItem[];
  gamesSequence: SequenceItem[];
}

export interface BadgeConfig {
  congratsText?: string;
  showStudentName?: boolean;
  showFinalScore?: boolean;
  alwaysDisplay?: boolean;
  fontSize?: number;
  celebrationDurationMs?: number;
  confettiCount?: number;
  // Background setting
  background?: {
    assetId?: string;
    posX?: number;
    posY?: number;
    scale?: number;
    blur?: number;
    brightness?: number;
  };
  tabBackground?: {
    assetId?: string;
    posX?: number;
    posY?: number;
    scale?: number;
    blur?: number;
    brightness?: number;
  };
  // Animation settings
  animation?: {
    durationMs?: number;
    rotationDeg?: number;
    motionType?: 'zoomPop' | 'slideUp' | 'fadeIn' | 'spinPop';
    colorIntensity?: number;
    glowIntensity?: number;
    motionIntensity?: number;
  };
  previewShield?: {
    size?: number;
    posX?: number;
    posY?: number;
    spinDirection?: 'cw' | 'ccw';
    spinIntensity?: number;
    visible?: boolean;
  };
  badgeSprites?: BadgeStudentSprite[];
  badgeSparkAssetIds?: {
    gold?: string;
    blue?: string;
    pink?: string;
    crown?: string;
  };
  badgeSpriteMotion?: 'spin' | 'breathe' | 'zoom';
  badgeSpriteAnimDurationMs?: number;
  badgeSpriteAnimIntensity?: number;
}

export type SparkAwardVariant = 'gold' | 'blue' | 'pink' | 'crown';

export interface BadgeStudentSprite {
  id: string;
  studentId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex?: number;
  variant?: SparkAwardVariant;
  assetId?: string; // legacy fallback
}

export type SparkShape = 'star' | 'diamond' | 'circle' | 'heart' | 'crown';

export interface SparkStudent {
  id: string;
  name: string;
  yellowSparks: number;
  blueSparks: number;
  pinkSparks: number;
  crowns: number;
  stars: number;
  badgeVisible: boolean;
  badgeSparkVariant?: SparkAwardVariant;
}

export interface SparkConfig {
  burstDurationMs: number;
  particleCount: number;
  glowIntensity: number;
  colorIntensity: number;
  counterVisibleMs: number;
  scalePopIntensity: number;
  counterSize: number;
  sparkSize: number;
  positionTop: number;
  positionRight: number;
  shapeByVariant?: {
    gold?: SparkShape;
    blue?: SparkShape;
    pink?: SparkShape;
    crown?: SparkShape;
  };
}

export type MovementAnimationStyle =
  | "color-burst"
  | "runner"
  | "hero-flash"
  | "head-bounce"
  | "nose-bounce";

export interface MovementEventConfig {
  id: string;
  name: string;
  instruction: string;
  enabled: boolean;
  shortcut: string;
  durationSeconds: number;
  animation: MovementAnimationStyle;
  gifRelativePath?: string | null;
  overlayOpacity?: number;
  ringSpeedSeconds?: number;
  intensity?: number;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  gifScale?: number;
  soundId?: string | null;
}

export interface MovementConfig {
  randomEnabled: boolean;
  randomShortcut?: string;
  jingleEnabled?: boolean;
  jingleVolume?: number;
  jingleRelativePath?: string | null;
  events: MovementEventConfig[];
  deletedEventIds?: string[];
}

export interface ProjectData {
  version: ProjectSchemaVersion;
  createdAt: string;
  updatedAt: string;
  slides: Slide[];
  assets: AssetItem[];
  sections: Section[];
  boostPack?: BoostPack;
  bubbleDefinitions?: BubbleTemplate[];
  sparkConfig?: SparkConfig;
  badgeConfig?: BadgeConfig;
  badgeImageAssetId?: string;
  sparkStudents?: SparkStudent[];
  activeStudentId?: string;
  relicSystem?: RelicSystem;
  movement?: MovementConfig;
  aCardLibrary?: ACardLibrary;
  bCardLibrary?: BCardLibrary;
}

export interface ProjectState {
  folderPath: string;
  data: ProjectData;
  lastSavedAt?: string;
}

export interface StudentRosterEntry {
  id: string;
  name: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StudentRosterSettings {
  version: 1;
  studentRoster: StudentRosterEntry[];
}

export interface StoryStudioSettings {
  version: 1;
  studentRoster: StudentRosterEntry[];
  audio: AudioSettingsV1;
}

export type RelicWidgetPosition =
  | "topLeft"
  | "topRight"
  | "bottomLeft"
  | "bottomRight"
  | "centerBottom";

export type RelicAnimationStyle =
  | "none"
  | "glowPulse"
  | "sparkle"
  | "stageUnlockBurst"
  | "completeCeremony";

export type RelicWidgetEntranceAnimation = "none" | "fade" | "pop" | "slideUp" | "zoom";

export type RelicStage = "notStarted" | "stage1" | "stage2" | "stage3" | "complete";

export interface RelicStudentProgress {
  progress: number;
  active: boolean;
  notes?: string;
}

export interface RelicSystem {
  enabled: boolean;
  relicTitle: string;
  relicDescription: string;
  mainImageAssetId: string | null;
  stageImageAssetIds: {
    stage1: string | null;
    stage2: string | null;
    stage3: string | null;
  };
  stageTitles: {
    stage1: string;
    stage2: string;
    stage3: string;
  };
  studentProgress: Record<string, RelicStudentProgress>;
  showOnStage: boolean;
  widgetPosition: RelicWidgetPosition;
  widgetOffset: { x: number; y: number };
  widgetScale: number;
  widgetOpacity: number;
  animationStyle: RelicAnimationStyle;
  animationDurationMs: number;
  animationIntensity: number;
  rgbFlowEnabled: boolean;
  widgetEntranceAnimation: RelicWidgetEntranceAnimation;
  hotkeys: {
    toggleWidget: string;
    increaseProgress: string;
    decreaseProgress: string;
  };
  animateOnProgress: boolean;
  animateOnStageChange: boolean;
  animateOnComplete: boolean;
}

export interface ImportResult {
  importedAssets: AssetItem[];
  createdSlides: Slide[];
}

// --- NEW SYSTEM (Phase 1): ACards and BCards ---

// --- GLOBAL LIBRARIES ---
export interface ACardLibrary {
  [aCardId: string]: ACard;
}

export interface BCardLibrary {
  [bCardId: string]: BCard;
}

// --- ACARD (The Stage) ---
export interface ACard {
  id: string;
  name: string;
  stageMode: 'half' | 'full';
  background: {
    mode?: 'transparent' | 'solid' | 'gradient' | 'image';
    color?: string;
    gradientStart?: string;
    gradientEnd?: string;
    gradientDirection?: string;
    imageId?: string;
    offsetX: number;
    offsetY: number;
    scale: number;
    blur: number;
  };
  title?: string;
  questions?: string;
  font?: string;
  fontSize?: number;
  titleFontSize?: number;
  timerSize?: number;
  textColor?: string;
  isBold?: boolean;
  isItalic?: boolean;
  align?: 'left' | 'center' | 'right';
  position?: 'top' | 'center' | 'bottom';
  timer?: boolean;
  timerMode?: 'countup' | 'countdown';
  timerDuration?: number;
  bCardInstances: BCardInstance[];
}

export interface BCardInstance {
  id: string;
  bCardId: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  displayMode?: 'overlay' | 'board';
  flags?: Record<string, boolean>; // Local overrides for future phases
}

// --- BCARD (The Content) ---
export interface BCard {
  id: string;
  name: string;
  front: BCardSideConfig;
  back: BCardSideConfig;
  audioRefId?: string | null;
  animationPreset?: string | null;
}

export interface BCardSideConfig {
  imageId?: string | null;
  text?: string;
  backgroundColor?: string;
  textStyle?: {
    fontFamily: string;
    fontSize: number;
    color: string;
    textAlign: 'left' | 'center' | 'right';
    verticalAlign: 'top' | 'middle' | 'bottom';
  };
  emoji?: string | null;
}

// --- VOLATILE TEACH STATE ---
// (Not saved to project files, resets continuously)
export interface BCardTeachState {
  isFlipped: boolean;
  isBlurred: boolean;
  isCovered: boolean;
  isZoomed: boolean;
}
