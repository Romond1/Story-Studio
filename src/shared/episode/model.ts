import type {AdventureDefinition} from '../definitions/model';
import type {EpisodeActivity,ActivityOccurrence} from '../modules/model';
import type { SceneDocumentFields } from '../lesson/model';
export interface ImageTransformV1 {
  version: 1;
  crop?: { x: number; y: number; width: number; height: number };
  flipX?: boolean; rotation?: 0 | 90 | 180 | 270;
  brightness?: number; contrast?: number; saturation?: number;
}
export interface ImagePresentation { fit: 'cover' | 'contain'; aspectRatio?: number; focalX?: number; focalY?: number }
export interface DerivedImage { id: string; kind: 'derived-image'; label?: string; sourceAssetId: string; transform: ImageTransformV1; presentation: ImagePresentation }
export interface ContentEntity {
  id: string; adventureId: string; kind: 'character' | 'location' | 'item' | 'other';
  name: string; tags: string[]; assetIds: string[];
  tagAnnotations?: {tag: string; source: 'manual' | 'imported'; author?: string}[];
}
export interface ContentCollection { id: string; adventureId: string; name: string; entityIds: string[] }
export interface EpisodeProject extends SceneDocumentFields {
  format: 'story-studio-episode'; version: 1;
  adventure: { id: string; version: string };
  requiredCapabilities: ('derived-images-v1' | 'manual-catalog-v1' | 'bundled-modules-v1' | 'adventure-definitions-v1')[];
  adventureDefinition?: AdventureDefinition;
  activities?: EpisodeActivity[];
  occurrences?: ActivityOccurrence[];
  derivedImages: DerivedImage[];
  catalog: { entities: ContentEntity[]; collections?: ContentCollection[] };
}
