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
}

export type BackgroundConfig = {
  imageSrc?: string | null;
  color?: string;
  posX?: number;
  posY?: number;
  scale?: number;
  blur?: number;
};

export type LayoutItem = {
  id: string;              // e.g. T001
  type: "textSlot" | "flashcardSlot" | "coverSlot" | "shapeSlot";
  x: number;
  y: number;
  width: number;
  height: number;
  rotationDeg?: number;
  styleDefaults?: {
    fontSize?: number;
    align?: "left" | "center" | "right";
    color?: string;
    fontWeight?: number;
    italic?: boolean;
    fontFamily?: string;
    fillColor?: string;
    opacity?: number;
    borderRadius?: number;
    shapeType?: "circle" | "square" | "rectangle" | "oval" | "star" | "diamond" | "heart";
    borderWidth?: number;
    padding?: number;
    borderColor?: string;
    noFill?: boolean;
    verticalAlign?: "top" | "center" | "bottom";
    frontColor?: string;
    backColor?: string;
    frontTextColor?: string;
    backTextColor?: string;
    flipAnimation?: "none" | "flip" | "fade" | "slide";
    flipSpeed?: number;
    frontFontSize?: number;
    backFontSize?: number;
    frontFontWeight?: number;
    backFontWeight?: number;
    frontItalic?: boolean;
    backItalic?: boolean;
    frontAlign?: "left" | "center" | "right";
    backAlign?: "left" | "center" | "right";
    frontVerticalAlign?: "top" | "center" | "bottom";
    backVerticalAlign?: "top" | "center" | "bottom";
  };
  text?: string;
  frontText?: string;
  backText?: string;
};

export type LanguageBoardTemplate = {
  background: BackgroundConfig;
  layoutItems: LayoutItem[];
  defaultViewMode: "slide" | "split" | "board";
  nextItemSeq?: number;
};

export type ContentItem = {
  layoutId: string;   // links to LayoutItem.id
  text?: string;
  frontText?: string;
  backText?: string;
  visibleInTeach?: boolean;
  flippedInTeach?: boolean;
};

export type SlideLanguageContent = {
  items: ContentItem[];
};

export interface Slide {
  id: string;
  assetId: string;
  sectionId: string;
  transition: TransitionType;
  transitionDuration?: number;
  transitionDirection?: 'left' | 'right' | 'up' | 'down';
  markerStrokes?: MarkerStroke[];
  dialogue?: AudioClip[];
  sfx?: AudioClip[];
  bgm?: AudioClip;
  tags?: string[];
  overlays?: OverlayItem[];
  audioCues?: AudioCue[];
  languageBoard?: any; // kept for legacy migration only
  languageContent?: SlideLanguageContent;
}

export type ProjectSchemaVersion = 1 | 2 | 3;

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

export interface SlideRefItem {
  id: string;
  type: 'slideRef';
  slideId: string;
  viewOverride?: {
    zoom?: number;
    panX?: number;
    panY?: number;
  };
}

export interface BreakRefItem {
  id: string;
  type: 'breakRef';
  breakId: string;
  textOverride?: string;
}

export interface PromptCardItem {
  id: string;
  type: 'promptCard';
  title?: string;
  body: string;
  durationMs?: number;
}

export interface MiniGameItem {
  id: string;
  type: 'miniGame';
  gameType: 'placeholder';
  config?: Record<string, unknown>;
}

export type SequenceItem = SlideRefItem | BreakRefItem | PromptCardItem | MiniGameItem;

export interface BoostPack {
  activationSequence: SequenceItem[];
  languageSequence: SequenceItem[];
  gamesSequence: SequenceItem[];
}

export interface BadgeConfig {
  congratsText?: string;
  showStudentName?: boolean;
  showFinalScore?: boolean;
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
}

export interface ProjectData {
  version: ProjectSchemaVersion;
  createdAt: string;
  updatedAt: string;
  slides: Slide[];
  assets: AssetItem[];
  sections: Section[];
  boostPack?: BoostPack;
  languageBoardTemplate?: LanguageBoardTemplate;
  bubbleDefinitions?: BubbleTemplate[];
  sparkConfig?: SparkConfig;
  badgeConfig?: BadgeConfig;
  badgeImageAssetId?: string;
}

export interface ProjectState {
  folderPath: string;
  data: ProjectData;
  lastSavedAt?: string;
}

export interface ImportResult {
  importedAssets: AssetItem[];
  createdSlides: Slide[];
}
