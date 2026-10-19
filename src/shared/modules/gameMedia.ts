import type { EpisodeActivity } from './model';

export function addGameMedia(activity: EpisodeActivity, media: { id: string; mediaType: string; label: string }[]): EpisodeActivity {
  if (!media.length) throw new Error('Select media from the pool first.');
  if (activity.moduleType === 'language-snake') {
    if (media.length !== 1 || media[0].mediaType !== 'image') throw new Error('Choose one image for the Challenge background.');
    return { ...activity, config: { ...activity.config, backgroundImage: `asset:${media[0].id}` } };
  }
  if (activity.moduleType !== 'final-boss-hero' || media.some(item => !['image', 'video'].includes(item.mediaType))) throw new Error('Choose images for cards or videos for cutscenes.');
  const cards = media.filter(item => item.mediaType === 'image').map(item => ({ id: crypto.randomUUID(), title: item.label, image: `asset:${item.id}`, value: 1, pairId: crypto.randomUUID(), tags: [] }));
  const clips = media.filter(item => item.mediaType === 'video').map(item => ({ id: crypto.randomUUID(), name: item.label, mediaSource: `asset:${item.id}`, mediaType: 'video' as const, tags: [] }));
  return { ...activity, config: { ...activity.config, cardLibrary: [...activity.config.cardLibrary, ...cards], encounter: { ...activity.config.encounter,
    selectedCardIds: [...activity.config.encounter.selectedCardIds, ...cards.map(card => card.id)],
    boardDashCardIds: [...activity.config.encounter.boardDashCardIds, ...cards.map(card => card.id)],
    cutscenes: [...activity.config.encounter.cutscenes, ...clips],
  } } };
}
