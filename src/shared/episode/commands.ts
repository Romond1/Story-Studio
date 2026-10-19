import type { SceneLessonProject } from '../lesson/model';
import { clone } from '../lesson/model';
import { parseLessonProject } from '../lesson/validation';
import { parseEpisodeProject } from './validation';
import type { ContentCollection, ContentEntity, DerivedImage, EpisodeProject } from './model';
/** Pure projection for an explicitly approved conversion; filesystem backup belongs to main. */
export function createEpisodeFromScene(scene:SceneLessonProject,adventure:EpisodeProject['adventure']):EpisodeProject {
 const p=parseLessonProject(scene);
 return parseEpisodeProject({format:'story-studio-episode',version:1,id:p.id,title:p.title,createdAt:p.createdAt,updatedAt:p.updatedAt,assets:p.assets,mediaBins:p.mediaBins,scenes:p.scenes,sequences:p.sequences,...(p.sections?{sections:p.sections}:{}),cards:p.cards,library:p.library,cardSets:p.cardSets,adventure:clone(adventure),requiredCapabilities:['derived-images-v1','manual-catalog-v1'],derivedImages:[],catalog:{entities:[],collections:[]}});
}
export function putDerivedImage(project:EpisodeProject,image:DerivedImage):EpisodeProject {
 return parseEpisodeProject({...project,derivedImages:[...project.derivedImages.filter(item=>item.id!==image.id),clone(image)]});
}
export function putCatalogEntity(project:EpisodeProject,entity:ContentEntity):EpisodeProject {
 const annotations=entity.tags.map(tag=>entity.tagAnnotations?.find(item=>item.tag===tag)??{tag,source:'manual' as const});
 return parseEpisodeProject({...project,catalog:{...project.catalog,entities:[...project.catalog.entities.filter(item=>item.id!==entity.id),{...clone(entity),tagAnnotations:annotations}]}});
}
export function putCatalogCollection(project:EpisodeProject,collection:ContentCollection):EpisodeProject {
 return parseEpisodeProject({...project,catalog:{...project.catalog,collections:[...(project.catalog.collections??[]).filter(item=>item.id!==collection.id),clone(collection)]}});
}
export function removeCatalogEntity(project:EpisodeProject,id:string):EpisodeProject {
 if(project.catalog.collections?.some(collection=>collection.entityIds.includes(id)))throw new Error('Entity is referenced by a collection. Reassign its membership first.');
 return parseEpisodeProject({...project,catalog:{...project.catalog,entities:project.catalog.entities.filter(entity=>entity.id!==id)}});
}
export function removeCatalogCollection(project:EpisodeProject,id:string):EpisodeProject {
 return parseEpisodeProject({...project,catalog:{...project.catalog,collections:(project.catalog.collections??[]).filter(collection=>collection.id!==id)}});
}

export function putEpisodeActivity(project:EpisodeProject,activity:import('../modules/model').EpisodeActivity):EpisodeProject {
 return parseEpisodeProject({...project,requiredCapabilities:[...new Set([...project.requiredCapabilities,'bundled-modules-v1'])],activities:[...(project.activities??[]).filter(item=>item.id!==activity.id),clone(activity)],occurrences:project.occurrences??[]});
}
export function putActivityOccurrence(project:EpisodeProject,occurrence:import('../modules/model').ActivityOccurrence):EpisodeProject {
 const existing=project.occurrences??[],index=existing.findIndex(item=>item.id===occurrence.id);const occurrences=existing.map(item=>item.id===occurrence.id?clone(occurrence):item);if(index<0)occurrences.push(clone(occurrence));
 return parseEpisodeProject({...project,occurrences});
}
export function removeEpisodeActivity(project:EpisodeProject,id:string):EpisodeProject {
 if(project.occurrences?.some(item=>item.activityId===id))throw new Error('Activity is referenced by an occurrence');
 return parseEpisodeProject({...project,activities:project.activities?.filter(item=>item.id!==id)});
}
export function removeActivityOccurrence(project:EpisodeProject,id:string):EpisodeProject {return parseEpisodeProject({...project,occurrences:project.occurrences?.filter(item=>item.id!==id)});}
export function reorderActivityOccurrences(project:EpisodeProject,ids:string[]):EpisodeProject {
 const current=project.occurrences??[];if(ids.length!==current.length||new Set(ids).size!==ids.length||ids.some(id=>!current.some(item=>item.id===id)))throw new Error('Invalid occurrence ordering');
 return parseEpisodeProject({...project,occurrences:ids.map(id=>current.find(item=>item.id===id)!)});
}

export function putAdventureDefinition(project:EpisodeProject,definition:import('../definitions/model').AdventureDefinition):EpisodeProject {
 return parseEpisodeProject({...project,requiredCapabilities:[...new Set([...project.requiredCapabilities,'adventure-definitions-v1'])],adventureDefinition:clone(definition)});
}
