import type {StudentSnapshot,ProfileInput,ProfileUpdate,LegacyMappingInput,LegacyImportInput} from './model';
export interface StudentsApi {
 createClass(input:{name:string}):Promise<StudentSnapshot>;
 updateClass(input:{id:string;name?:string;studentIds?:string[]}):Promise<StudentSnapshot>;
 setClassArchived(input:{id:string;archived:boolean}):Promise<StudentSnapshot>;
 selectClass(input:{id:string|null}):Promise<StudentSnapshot>;
 getSnapshot():Promise<StudentSnapshot>;
 createProfile(input:ProfileInput):Promise<StudentSnapshot>;
 updateProfile(input:ProfileUpdate):Promise<StudentSnapshot>;
 setArchived(input:{id:string;archived:boolean}):Promise<StudentSnapshot>;
 mapLegacy(input:LegacyMappingInput):Promise<StudentSnapshot>;
 importProfile(input:LegacyImportInput):Promise<StudentSnapshot>;
}
