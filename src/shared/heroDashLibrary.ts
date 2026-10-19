import type {DashConfig} from './heroDash';
export interface DashLibraryImage {id:string;name:string;url:string}
export interface DashCollection {id:string;title:string;updatedAt:string}
export interface DashLibrarySnapshot {images:DashLibraryImage[];collections:DashCollection[]}
export interface DashLibraryApi {
 list():Promise<DashLibrarySnapshot>;
 importImages(paths?:string[]):Promise<{images:DashLibraryImage[];failures:{name:string;reason:string}[]}>;
 saveCollection(id:string|undefined,config:DashConfig,mediaMap:Record<string,string>):Promise<{id:string;config:DashConfig}>;
 loadCollection(id:string):Promise<DashConfig>;
}
