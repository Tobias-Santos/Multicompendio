// História de origem do personagem (RF08).
// O documento segue o formato do editor (nós e marcas), mas só com o subconjunto
// que o servidor aceita e que o PDF consegue desenhar (ver utils/storyDocument.ts).

export type StoryMarkType = 'bold' | 'italic';

export interface StoryMark {
  type: StoryMarkType;
}

export interface StoryNode {
  type: string;
  attrs?: { level?: number; start?: number };
  content?: StoryNode[];
  marks?: StoryMark[];
  text?: string;
}

export interface StoryDocument {
  type: 'doc';
  content: StoryNode[];
}

// O que a API devolve ao abrir a história. Sem linha no banco = revisão 0 e conteúdo nulo.
export interface StoryRecord {
  content: StoryDocument | null;
  revision: number;
  updated_at: string | null;
}

export interface StorySaveInput {
  content: unknown;
  base_revision: unknown;
}

export interface StorySaveResult {
  revision: number;
  updated_at: string;
}
