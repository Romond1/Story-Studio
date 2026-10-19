import type { LessonProject, LessonProjectState } from './lesson/model';
export interface DerivedSourceRequest { leaseId: string; revision: number; sourceAssetId: string; generation?: number }
export interface PublishDerivedRequest extends DerivedSourceRequest { sourceDigest: string; key: string; png: Uint8Array }
export interface DerivedMediaApi {
 begin(request: { leaseId: string; revision: number; keepUrls: string[] }): Promise<{ generation: number }>;
 getSource(request: DerivedSourceRequest): Promise<{ url: string; digest: string }>;
 publish(request: PublishDerivedRequest): Promise<{ url: string }>;
}
export type EpisodeConversionResult = LessonProjectState & { migrationReport: string; backupPath: string };
export type EpisodeAdventure = { id: string; version: string };
export type ConvertEpisode = (data: LessonProject, adventure: EpisodeAdventure, expectedFolder: string) => Promise<EpisodeConversionResult | null>;
