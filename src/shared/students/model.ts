import type {StudentRosterSettings} from '../types';
export const STUDENT_AVATARS = ['star','rocket','leaf','sun','moon','cat','⭐','🚀','🌱','☀️','🌙','🐱'] as const;
export interface LegacyStudentMapping {source:string;sourceStudentId:string;targetStudentId:string;createdAt:string}
export interface StudentClass {id:string;name:string;studentIds:string[];archived:boolean;createdAt:string;updatedAt:string}
export interface StudentSnapshot extends StudentRosterSettings {legacyMappings:LegacyStudentMapping[];classes:StudentClass[];activeClassId:string|null}
export interface ProfileInput {name:string;nickname?:string;avatar?:string}
export interface ProfileUpdate {id:string;name?:string;nickname?:string|null;avatar?:string|null}
export interface LegacyMappingInput {source:string;sourceStudentId:string;targetStudentId:string}
export interface LegacyImportInput extends ProfileInput {source:string;sourceStudentId:string}
