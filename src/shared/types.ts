export type TransitionType = 'fade' | 'crossfade';

export type MediaType = 'image' | 'video';

export interface AssetItem {
  id: string;
  relativePath: string;
  filename: string;
  originalName: string;
  mediaType: MediaType;
  sizeBytes: number;
  importedAt: string;
}

export interface Slide {
  id: string;
  assetId: string;
  transition: TransitionType;
}

export interface ProjectData {
  version: 1;
  createdAt: string;
  updatedAt: string;
  slides: Slide[];
  assets: AssetItem[];
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
