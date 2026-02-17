// src/shared/types.ts
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

export interface Section {
  id: string;
  name: string;
}

export interface Slide {
  id: string;
  assetId: string;
  sectionId: string;
  transition: TransitionType;
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
