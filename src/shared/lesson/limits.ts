/** Command limits mirror the saved lesson format; Cards use the CardsV2 ceiling. */
export const LESSON_LIMITS = {
  objectsPerScene: 200,
  cards: 2000,
  scenes: 2000,
  entriesPerSequence: 2000,
  sections: 4000,
} as const;
