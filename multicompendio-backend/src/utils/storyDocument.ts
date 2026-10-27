import { ValidationError } from '../errors';
import { StoryDocument, StoryMark, StoryMarkType, StoryNode } from '../types/story';

// ------------------------------------------------------------------
// Limites. O contador do editor (front-end) usa o mesmo valor e a mesma forma de contar.
// ------------------------------------------------------------------
export const MAX_STORY_LENGTH = 20000; // caracteres de texto (sem contar a estrutura)
const MAX_NODES = 5000;
const MAX_DEPTH = 8;
const MAX_JSON_BYTES = 400_000;

// Elementos de bloco aceitos e onde cada um pode aparecer.
// Espelha o que o editor consegue produzir (inclusive citação dentro de item de lista),
// para o salvamento automático nunca ser recusado por um documento legítimo.
const BLOCKS = new Set(['paragraph', 'heading', 'bulletList', 'orderedList', 'blockquote', 'horizontalRule']);
const INLINE = new Set(['text', 'hardBreak']);
const MARKS = new Set<StoryMarkType>(['bold', 'italic']);

// Texto com caracteres que o PostgreSQL recusa em JSONB (NUL) ou que quebram o JSON
// (par substituto solto) é limpo, não recusado: a pessoa não deve perder o que escreveu por isso.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

function cleanText(text: string): string {
  return text.replace(CONTROL_CHARS, '').replace(LONE_SURROGATE, '\uFFFD');
}

interface Counter {
  nodes: number;
  chars: number;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(message: string): never {
  throw new ValidationError(message);
}

function sanitizeMarks(raw: unknown): StoryMark[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) fail('A história tem uma formatação inválida.');
  const found = new Set<StoryMarkType>();
  for (const mark of raw) {
    const type = isObject(mark) ? mark.type : undefined;
    if (typeof type !== 'string' || !MARKS.has(type as StoryMarkType)) {
      fail('A história usa uma formatação que não é aceita (só negrito e itálico).');
    }
    found.add(type as StoryMarkType);
  }
  if (found.size === 0) return undefined;
  // ordem fixa, para o mesmo texto sempre gerar o mesmo JSON
  return (['bold', 'italic'] as const).filter((t) => found.has(t)).map((type) => ({ type }));
}

// Reconstrói o nó só com o que é aceito: o que não está na lista não passa,
// e atributos desconhecidos são descartados.
function sanitizeNode(raw: unknown, parent: string, depth: number, counter: Counter): StoryNode | null {
  if (!isObject(raw) || typeof raw.type !== 'string') fail('A história tem um trecho inválido.');
  const type = raw.type;

  if (depth > MAX_DEPTH) fail('A história tem listas ou citações aninhadas demais.');
  if (++counter.nodes > MAX_NODES) fail('A história tem elementos demais.');

  // quais filhos cada pai aceita
  const inlineParent = parent === 'paragraph' || parent === 'heading';
  const blockParent = parent === 'doc' || parent === 'blockquote' || parent === 'listItem';
  const listParent = parent === 'bulletList' || parent === 'orderedList';

  if (inlineParent && !INLINE.has(type)) fail('A história tem um elemento fora do lugar.');
  if (blockParent && !BLOCKS.has(type)) fail('A história tem um elemento que não é aceito.');
  if (listParent && type !== 'listItem') fail('A história tem uma lista malformada.');

  switch (type) {
    case 'text': {
      if (typeof raw.text !== 'string') fail('A história tem um texto inválido.');
      const text = cleanText(raw.text);
      if (text === '') return null; // texto que ficou vazio depois da limpeza
      counter.chars += text.length;
      const marks = sanitizeMarks(raw.marks);
      return marks ? { type: 'text', text, marks } : { type: 'text', text };
    }
    case 'hardBreak':
    case 'horizontalRule': {
      counter.chars += 1; // o contador do editor conta folhas (quebra de linha, separador) como 1
      return { type };
    }
    case 'heading': {
      const level = isObject(raw.attrs) ? raw.attrs.level : undefined;
      if (level !== 1 && level !== 2) fail('Os títulos da história só podem ter 2 níveis.');
      return { type, attrs: { level }, content: sanitizeChildren(raw.content, type, depth, counter) };
    }
    case 'orderedList': {
      const rawStart = isObject(raw.attrs) ? raw.attrs.start : undefined;
      const start = rawStart === undefined || rawStart === null ? 1 : rawStart;
      if (typeof start !== 'number' || !Number.isInteger(start) || start < 1 || start > 9999) {
        fail('A lista numerada da história começa em um número inválido.');
      }
      return { type, attrs: { start }, content: sanitizeChildren(raw.content, type, depth, counter) };
    }
    case 'paragraph':
    case 'bulletList':
    case 'listItem':
    case 'blockquote':
      return { type, content: sanitizeChildren(raw.content, type, depth, counter) };
    default:
      return fail('A história tem um elemento que não é aceito.');
  }
}

function sanitizeChildren(raw: unknown, parent: string, depth: number, counter: Counter): StoryNode[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) fail('A história tem um trecho inválido.');
  const children: StoryNode[] = [];
  for (const child of raw) {
    const node = sanitizeNode(child, parent, depth + 1, counter);
    if (node) children.push(node);
  }
  return children;
}

// Confere o documento enviado e devolve uma cópia limpa, que é a que vai para o banco.
export function validateStoryDocument(raw: unknown): StoryDocument {
  if (!isObject(raw) || raw.type !== 'doc') fail('A história enviada é inválida.');

  const counter: Counter = { nodes: 0, chars: 0 };
  const content = sanitizeChildren(raw.content, 'doc', 0, counter);
  // um documento sem nada é um parágrafo vazio, como o editor o representa
  const doc: StoryDocument = { type: 'doc', content: content.length > 0 ? content : [{ type: 'paragraph' }] };

  // lista ou citação sem conteúdo não é um documento válido para o editor
  assertNoEmptyContainers(doc.content);

  if (counter.chars > MAX_STORY_LENGTH) {
    fail(`A história pode ter no máximo ${MAX_STORY_LENGTH.toLocaleString('pt-BR')} caracteres (tem ${counter.chars.toLocaleString('pt-BR')}).`);
  }
  if (Buffer.byteLength(JSON.stringify(doc), 'utf8') > MAX_JSON_BYTES) {
    fail('A história é grande demais para ser salva.');
  }
  return doc;
}

function assertNoEmptyContainers(nodes: StoryNode[]): void {
  for (const node of nodes) {
    const container = ['bulletList', 'orderedList', 'listItem', 'blockquote'].includes(node.type);
    if (container && (!node.content || node.content.length === 0)) {
      fail('A história tem uma lista ou citação vazia.');
    }
    if (node.content) assertNoEmptyContainers(node.content);
  }
}

// Quantos caracteres a história tem, contando como o contador do editor.
export function countStoryCharacters(doc: StoryDocument): number {
  let total = 0;
  const walk = (nodes: StoryNode[]) => {
    for (const node of nodes) {
      if (node.type === 'text') total += node.text?.length ?? 0;
      else if (node.type === 'hardBreak' || node.type === 'horizontalRule') total += 1;
      if (node.content) walk(node.content);
    }
  };
  walk(doc.content);
  return total;
}

// Texto puro da história, para campos que não aceitam formatação (como o campo de
// formulário "História do Personagem" do PDF, no RF11). Um bloco por linha.
export function extractPlainText(doc: StoryDocument): string {
  const blockLines = (nodes: StoryNode[]): string[] => {
    const out: string[] = [];
    for (const node of nodes) {
      switch (node.type) {
        case 'paragraph':
        case 'heading': {
          // a quebra de linha (hardBreak) vira nova linha
          const text = (node.content ?? []).map((c) => (c.type === 'text' ? c.text ?? '' : '\n')).join('');
          out.push(...text.split('\n'));
          break;
        }
        case 'horizontalRule':
          out.push('* * *');
          break;
        case 'bulletList':
        case 'orderedList': {
          const start = node.type === 'orderedList' ? node.attrs?.start ?? 1 : 0;
          (node.content ?? []).forEach((item, i) => {
            const marker = node.type === 'orderedList' ? `${start + i}. ` : '• ';
            // o marcador só na primeira linha do item; as demais ficam recuadas
            blockLines(item.content ?? []).forEach((line, j) => {
              out.push((j === 0 ? marker : ' '.repeat(marker.length)) + line);
            });
          });
          break;
        }
        default: // citação: o conteúdo sai como texto comum
          out.push(...blockLines(node.content ?? []));
      }
    }
    return out;
  };

  return blockLines(doc.content).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
