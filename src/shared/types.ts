export type TransitionType = 'fade' | 'crossfade' | 'fade-black' | 'cinematic' | 'pixel' | 'blur' | 'card-slide';

export type MediaType = 'image' | 'video' | 'audio';

export interface AudioClip {
  url: string;
  volume: number;
  name?: string;
  shortcut?: string;
  color?: string;
  fadeEnabled?: boolean;
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
  bgm?: AudioClip;
}

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
}

export interface ProjectData {
  version: 1;
  createdAt: string;
  updatedAt: string;
  slides: Slide[];
  assets: AssetItem[];
  sections: Section[];
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
