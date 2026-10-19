import type { AssetItem, MediaType } from './types';
export type MediaLease = { id: string; revision?: number };
export type MediaFailureCode = 'missing' | 'ambiguous' | 'wrong-type' | 'stale-project' | 'unsafe-path' | 'unregistered';
export type MediaDiagnostic = { code: MediaFailureCode; assetId?: string; path?: string };
export type MediaManifestRequest = { leaseId: string; expectedFolder: string; revision: number; assets: readonly AssetItem[]; legacyPaths: readonly string[] };
export type MediaResolveRequest = { leaseId: string; revision: number; assetId?: string; legacyPath?: string; expectedType?: MediaType };
export type MediaResolveResult = { ok: true; url: string; assetId?: string; mediaType?: MediaType } | { ok: false; code: MediaFailureCode };
export interface MediaRegistryApi {
 getLease(expectedFolder: string): Promise<MediaLease | null>;
 register(request: MediaManifestRequest): Promise<{ ok: boolean; diagnostics: MediaDiagnostic[] }>;
 resolve(request: MediaResolveRequest): Promise<MediaResolveResult>;
}
