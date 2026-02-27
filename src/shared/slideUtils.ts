import { Section, Slide } from './types';

export function getSectionSlideLabel(
    sections: Section[],
    slides: Slide[],
    slideId: string
): {
    sectionNumber: number;
    slideNumber: number;
    title: string;
} {
    const slide = slides.find(s => s.id === slideId);
    if (!slide) {
        return { sectionNumber: 0, slideNumber: 0, title: '' };
    }

    const title = slide.title || '';

    // Find the exact section object
    const sectionIdx = sections.findIndex(s => s.id === slide.sectionId);
    if (sectionIdx === -1) {
        return { sectionNumber: 0, slideNumber: 0, title };
    }

    // Find the slide's index within its section
    const sectionSlides = slides.filter(s => s.sectionId === slide.sectionId);
    const slideIdx = sectionSlides.findIndex(s => s.id === slideId);

    return {
        sectionNumber: sectionIdx + 1,
        slideNumber: slideIdx + 1,
        title
    };
}
