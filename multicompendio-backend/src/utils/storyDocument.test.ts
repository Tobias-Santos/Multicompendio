import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ValidationError } from '../errors';
import {
  MAX_STORY_LENGTH,
  countStoryCharacters,
  extractPlainText,
  validateStoryDocument,
} from './storyDocument';

const p = (text: string, marks?: string[]) => ({
  type: 'paragraph',
  content: [{ type: 'text', text, ...(marks ? { marks: marks.map((type) => ({ type })) } : {}) }],
});
const doc = (...content: unknown[]) => ({ type: 'doc', content });
const rejects = (input: unknown, pattern?: RegExp) =>
  assert.throws(() => validateStoryDocument(input), (err: unknown) => {
    assert.ok(err instanceof ValidationError, 'deveria ser ValidationError');
    if (pattern) assert.match((err as Error).message, pattern);
    return true;
  });

test('aceita um documento com tudo o que o editor oferece', () => {
  const input = doc(
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Infância' }] },
    p('Nasceu em um vilarejo.', ['bold', 'italic']),
    { type: 'bulletList', content: [{ type: 'listItem', content: [p('um')] }] },
    { type: 'orderedList', attrs: { start: 3 }, content: [{ type: 'listItem', content: [p('três')] }] },
    { type: 'blockquote', content: [p('Uma fala.')] },
    { type: 'horizontalRule' },
    { type: 'paragraph', content: [{ type: 'text', text: 'a' }, { type: 'hardBreak' }, { type: 'text', text: 'b' }] },
  );
  const clean = validateStoryDocument(input);
  assert.deepEqual(clean, input);
});

test('um documento vazio vira um parágrafo vazio', () => {
  assert.deepEqual(validateStoryDocument({ type: 'doc' }), { type: 'doc', content: [{ type: 'paragraph' }] });
  assert.deepEqual(validateStoryDocument(doc()), { type: 'doc', content: [{ type: 'paragraph' }] });
});

test('recusa o que não é um documento', () => {
  rejects(null);
  rejects('texto solto');
  rejects([]);
  rejects({ type: 'paragraph' });
  rejects({ type: 'doc', content: 'x' });
});

test('recusa elementos que o PDF não sabe desenhar', () => {
  for (const type of ['image', 'codeBlock', 'table', 'script', 'youtube']) {
    rejects(doc({ type }), /não é aceito/);
  }
  rejects(doc({ type: 'paragraph', content: [{ type: 'image' }] }), /fora do lugar/);
});

test('recusa formatações fora de negrito e itálico', () => {
  for (const mark of ['link', 'code', 'strike', 'underline', 'highlight', 'textStyle']) {
    rejects(doc(p('x', [mark])), /negrito e itálico/);
  }
});

test('só aceita títulos de nível 1 e 2', () => {
  rejects(doc({ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'x' }] }), /2 níveis/);
  rejects(doc({ type: 'heading', content: [{ type: 'text', text: 'x' }] }), /2 níveis/);
});

test('descarta atributos desconhecidos em vez de gravá-los', () => {
  const clean = validateStoryDocument(
    doc({ type: 'paragraph', attrs: { onclick: 'x()' }, extra: 1, content: [{ type: 'text', text: 'oi', href: 'http://x' }] }),
  );
  assert.deepEqual(clean, doc({ type: 'paragraph', content: [{ type: 'text', text: 'oi' }] }));
});

test('valida a estrutura de listas', () => {
  rejects(doc({ type: 'bulletList', content: [p('solto')] }), /malformada/);
  rejects(doc({ type: 'bulletList', content: [] }), /vazia/);
  rejects(doc({ type: 'blockquote', content: [] }), /vazia/);
  rejects(doc({ type: 'orderedList', attrs: { start: 0 }, content: [{ type: 'listItem', content: [p('a')] }] }), /número inválido/);
});

test('limpa caracteres que o PostgreSQL recusaria, sem perder o texto', () => {
  const clean = validateStoryDocument(doc(p('a\u0000b\u0007c')));
  assert.equal((clean.content[0].content ?? [])[0].text, 'abc');
  const lone = validateStoryDocument(doc(p('x\uD83Dy')));
  assert.equal((lone.content[0].content ?? [])[0].text, 'x\uFFFDy');
  // emoji válido (par substituto completo) é preservado
  assert.equal((validateStoryDocument(doc(p('🙂'))).content[0].content ?? [])[0].text, '🙂');
  // texto que só tinha lixo some
  assert.deepEqual(validateStoryDocument(doc(p('\u0000'))).content[0], { type: 'paragraph', content: [] });
});

test('limita o tamanho do texto e a profundidade', () => {
  assert.doesNotThrow(() => validateStoryDocument(doc(p('a'.repeat(MAX_STORY_LENGTH)))));
  rejects(doc(p('a'.repeat(MAX_STORY_LENGTH + 1))), /no máximo/);

  let nested: unknown = p('fundo');
  for (let i = 0; i < 12; i++) nested = { type: 'blockquote', content: [nested] };
  rejects(doc(nested), /aninhadas/);
});

test('o contador do servidor conta como o do editor', () => {
  // texto + 1 por quebra de linha + 1 por separador; a estrutura entre blocos não conta
  const d = validateStoryDocument(
    doc(p('abc'), { type: 'horizontalRule' }, { type: 'paragraph', content: [{ type: 'text', text: 'de' }, { type: 'hardBreak' }] }),
  );
  assert.equal(countStoryCharacters(d), 3 + 1 + 2 + 1);
});

test('extrai texto puro, com marcadores nas listas', () => {
  const d = validateStoryDocument(
    doc(
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Título' }] },
      p('Primeira linha', ['bold']),
      { type: 'bulletList', content: [{ type: 'listItem', content: [p('maçã')] }, { type: 'listItem', content: [p('pera')] }] },
      { type: 'orderedList', attrs: { start: 2 }, content: [{ type: 'listItem', content: [p('dois')] }] },
      { type: 'blockquote', content: [p('citação')] },
    ),
  );
  assert.equal(extractPlainText(d), 'Título\nPrimeira linha\n• maçã\n• pera\n2. dois\ncitação');
});
