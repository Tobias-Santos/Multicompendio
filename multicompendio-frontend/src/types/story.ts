import type { JSONContent } from '@tiptap/react';

// História de origem do personagem (RF08). O documento é o JSON do editor.
export type StoryDocument = JSONContent;

// Mesmo limite e mesma forma de contar do servidor (utils/storyDocument.ts)
export const MAX_STORY_LENGTH = 20000;

export interface StoryRecord {
  content: StoryDocument | null;
  revision: number; // 0 = o personagem ainda não tem história
  updated_at: string | null;
}

export interface StorySaveResult {
  revision: number;
  updated_at: string;
}
