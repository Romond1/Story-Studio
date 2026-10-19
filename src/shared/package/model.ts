export interface PackageFile {path:string;bytes:number;sha256:string}
export interface PackageDefinitionRef {kind:'adventure';adventureId:string;version:string;bundledPath:string;sha256:string}
export interface PackageManifestV1 {
 format:'story-studio-package';version:1;episodeId:string;adventure:{id:string;version:string};requiredCapabilities:string[];
 materializedBuiltins?:{ref:string;moduleVersion:1;assetId:string;sha256:string}[];
 files:PackageFile[];definitions:PackageDefinitionRef[];
 adventureDependencies:{adventureId:string;version:string;bundledPath:string;sha256:string}[];
}
export const ADVENTURE_DEFINITION_PATH='definitions/adventure.json';
export const PACKAGE_CAPABILITIES=['derived-images-v1','manual-catalog-v1','bundled-modules-v1','adventure-definitions-v1'] as const;
export const PACKAGE_LIMITS={maxFiles:10000,maxFileBytes:1024*1024*1024,maxTotalBytes:4*1024*1024*1024,maxJsonBytes:16*1024*1024} as const;

export const BOSS_BUILTIN_REFS=['start','finish','move','bonus','back3','roll-again','steal'].map(key=>`builtin:final-boss-hero/assets/board-dash/${key}.png`);
