import { StoryDocument } from '../types/story';

// Compara duas versões da história pelo conteúdo, ignorando diferenças que não são de conteúdo
// (atributos que o editor acrescenta, ordem das formatações, parágrafo vazio com ou sem lista).
// Usado para saber se um rascunho local já foi salvo: a gravação feita ao fechar a aba chega ao
// servidor, mas a aba já não consegue apagar o rascunho depois.

const EMPTY: StoryDocument = { type: 'doc', content: [{ type: 'paragraph' }] };

type Canonical = { type?: string; attrs?: Record<string, number>; text?: string; marks?: string[]; content?: Canonical[] };

function canon(node: StoryDocument): Canonical {
  const out: Canonical = { type: node.type };
  if (node.type === 'heading' && node.attrs?.level) out.attrs = { level: Number(node.attrs.level) };
  if (node.type === 'orderedList') out.attrs = { start: Number(node.attrs?.start ?? 1) };
  if (node.text !== undefined) out.text = node.text;
  const marks = (node.marks ?? []).map((m) => m.type).filter((t): t is string => t === 'bold' || t === 'italic');
  if (marks.length) out.marks = [...new Set(marks)].sort();
  if (node.content?.length) out.content = node.content.map(canon);
  return out;
}

export function sameStory(a: StoryDocument | null, b: StoryDocument | null): boolean {
  return JSON.stringify(canon(a ?? EMPTY)) === JSON.stringify(canon(b ?? EMPTY));
}
