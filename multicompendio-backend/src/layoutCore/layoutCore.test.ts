import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CW, MAX_BODY_H, USABLE, FieldType, LayoutAttribute, SheetLayout, ShapeKey, autoLayout, freeSpotInSection, outerHeight, parseLayout,
  reconcile, repairLayout, sectionGrowth, trayOf, validateLayout,
} from './index';

// ---------------------------------------------------------------- apoio
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const TYPES: FieldType[] = ['number', 'text', 'longtext', 'boolean', 'select', 'text_number'];
function attr(i: number, type: FieldType, group: string | null = 'Seção'): LayoutAttribute { return { id: `a${i}`, name: `Campo ${i}`, type, group, order: i }; }
// um sistema parecido com o D&D: 12 seções, 144 atributos, uma delas (Magias) mais alta que uma página
function bigSystem(): LayoutAttribute[] {
  const out: LayoutAttribute[] = []; let i = 0;
  const add = (g: string, types: FieldType[]) => types.forEach((t) => out.push(attr(i++, t, g)));
  add('Identificação', ['text', 'text', 'text', 'text', 'select', 'number']);
  add('Atributos', ['boolean', ...Array<FieldType>(13).fill('number')]);
  add('Salvaguardas', Array.from({ length: 12 }, (_, k) => (k % 2 ? 'boolean' : 'number')));
  add('Perícias', Array.from({ length: 37 }, (_, k) => (k % 2 ? 'boolean' : 'number')));
  add('Combate', ['number', 'number', 'text', 'number', 'number', 'number', 'text', 'text', 'number', 'number']);
  add('Personalidade', ['longtext', 'longtext', 'longtext', 'longtext']);
  add('Magias', ['text', 'select', 'number', 'number', ...Array.from({ length: 28 }, (_, k) => (k % 3 === 0 ? 'longtext' : 'number'))]);
  add('Notas', ['text_number', 'text_number']);
  return out;
}
const ids = (l: SheetLayout) => l.sections.flatMap((s) => s.items.map((x) => x.attributeId));

describe('layout automático', () => {
  const attrs = bigSystem();
  const layout = autoLayout(attrs);
  it('é sempre válido, mesmo com uma seção mais alta que uma página', () => {
    assert.deepEqual(validateLayout(layout, attrs), []);
    assert.ok(layout.sections.every((s) => s.h <= MAX_BODY_H + 0.01));
    assert.ok(layout.sections.some((s) => /\(continuação\)$/.test(s.title)), 'a seção Magias deveria ter sido dividida');
  });
  it('põe cada atributo uma vez só, e a primeira seção logo abaixo do cabeçalho', () => {
    assert.equal(new Set(ids(layout)).size, attrs.length);
    assert.equal(ids(layout).length, attrs.length);
    assert.equal(layout.sections[0].page, 1);
    assert.equal(layout.sections[0].y, 17);
    assert.ok(layout.pages >= 2 && layout.pages === Math.max(...layout.sections.map((s) => s.page)));
  });
  it('as páginas seguintes começam na margem de cima', () => {
    const first = layout.sections.find((s) => s.page === 2);
    assert.ok(first && first.y === 0);
  });
  it('usa as regras do PDF: grade de números, 3 campos que se repetem, caixinhas de verdadeiro ou falso', () => {
    const nums = autoLayout(Array.from({ length: 6 }, (_, i) => attr(i, 'number')));
    const it = nums.sections[0].items;
    assert.ok(it.every((x) => x.y === 0 && x.h === 14 && Math.abs(x.w - 30.1) < 0.2));
    const trio = autoLayout(Array.from({ length: 6 }, (_, i) => attr(i, (['text', 'number', 'text'] as FieldType[])[i % 3])));
    assert.ok(trio.sections[0].items.slice(0, 3).every((x) => x.y === 0) && trio.sections[0].items[3].y > 0, 'três por linha');
    const bools = autoLayout(Array.from({ length: 6 }, (_, i) => attr(i, 'boolean')));
    assert.equal(bools.sections[0].items.filter((x) => x.y === 0).length, 3);
    const long = autoLayout([attr(0, 'longtext'), attr(1, 'text_number')]);
    assert.ok(long.sections[0].items.every((x) => x.x === 0 && x.w === CW));
  });
  it('pares número + verdadeiro ou falso ficam dois por linha, com o número estreito e o verdadeiro ou falso largo', () => {
    const pares = Array.from({ length: 8 }, (_, i) => attr(i, i % 2 ? 'boolean' : 'number'));
    const l = autoLayout(pares);
    const it = l.sections[0].items;
    assert.equal(it.filter((x) => x.y === 0).length, 4, 'quatro campos (dois pares) na primeira linha');
    assert.ok(it[0].w < 31 && it[1].w > 60, 'número ~30 mm, verdadeiro ou falso ~62 mm');
    assert.equal(l.sections[0].h, 14 + 1.8 + 14, 'oito campos em duas linhas');
    assert.deepEqual(validateLayout(l, pares), []);
    const impar = autoLayout(pares.slice(0, 7));
    assert.deepEqual(validateLayout(impar, pares.slice(0, 7)), [], 'um número solto no fim não quebra nada');
  });
  it('trios número + número + texto longo ficam numa linha: números à esquerda, texto à direita', () => {
    const trios = Array.from({ length: 6 }, (_, i) => attr(i, (['number', 'number', 'longtext'] as FieldType[])[i % 3]));
    const l = autoLayout(trios);
    const it = l.sections[0].items;
    assert.ok(it[0].y === it[1].y && it[1].y === it[2].y && it[3].y > it[0].y, 'um trio por linha');
    assert.ok(it[0].w < 31 && it[1].w < 31 && it[2].w > 120 && it[2].x > 60, 'dois números estreitos e o texto largo');
    assert.equal(it[0].h, it[2].h, 'os números ganham a altura do texto longo da linha');
    assert.ok(it[2].h >= 28, 'e o texto longo tem altura para umas 5 linhas');
    assert.deepEqual(validateLayout(l, trios), []);
    const um = autoLayout(trios.slice(0, 3));
    assert.ok(um.sections[0].items[2].w === CW, 'um trio só (sem repetição) segue a regra comum: texto longo na largura toda');
  });
  it('ao dividir uma seção, nenhuma das partes fica com menos de 2 linhas', () => {
    const l = autoLayout(bigSystem());
    const cont = l.sections.filter((s) => /\(continuação\)$/.test(s.title));
    assert.ok(cont.length > 0);
    for (const s of l.sections.filter((x) => /\(continuação\)$/.test(x.title) || l.sections.some((o) => o.title === x.title + ' (continuação)'))) {
      const linhas = new Set(s.items.map((i) => i.y)).size;
      assert.ok(linhas >= 2, `"${s.title}" ficou com ${linhas} linha(s)`);
    }
  });
  it('campos sem seção vêm primeiro, numa seção "Geral"', () => {
    const l = autoLayout([attr(0, 'text', 'Combate'), attr(1, 'text', null)]);
    assert.equal(l.sections[0].title, 'Geral');
    assert.equal(l.sections[1].title, 'Combate');
  });
  it('aceita ajustes de altura e formato por atributo, ignorando os que não servem', () => {
    const l = autoLayout([attr(0, 'number'), attr(1, 'longtext'), attr(2, 'number')], { overrides: { a0: { h: 22, shape: 'shield' }, a1: { shape: 'shield' }, a2: { shape: 'circle' } } });
    const [a, b, c] = l.sections[0].items;
    assert.equal(a.shape, 'shield'); assert.equal(a.h, 22);
    assert.equal(b.shape, 'rect', 'texto longo não aceita escudo');
    assert.equal(c.shape, 'rect', 'o círculo precisa ser quadrado e não vem por ajuste de linha');
    assert.deepEqual(validateLayout(l, [attr(0, 'number'), attr(1, 'longtext'), attr(2, 'number')]), []);
  });
});

describe('leitura do que chega', () => {
  const ok = (): unknown => JSON.parse(JSON.stringify(autoLayout([attr(0, 'number'), attr(1, 'text')])));
  it('aceita um layout bem formado e arredonda as medidas', () => {
    const raw = ok() as SheetLayout; raw.sections[0].items[0].x = 1.23456; (raw as unknown as Record<string, unknown>).extra = 'x';
    const r = parseLayout(raw);
    assert.deepEqual(r.errors, []);
    assert.equal(r.layout?.sections[0].items[0].x, 1.23);
    assert.ok(!('extra' in (r.layout as object)));
  });
  it('recusa formato inválido com mensagens em português', () => {
    assert.ok(parseLayout(null).errors[0].includes('objeto'));
    assert.ok(parseLayout({ pages: 0, sections: [] }).errors.some((e) => e.includes('páginas')));
    const a = ok() as SheetLayout; a.sections[0].id = 'tem espaço';
    assert.ok(parseLayout(a).errors.some((e) => e.includes('identificador')));
    const b = ok() as SheetLayout; b.sections.push({ ...b.sections[0] });
    assert.ok(parseLayout(b).errors.some((e) => e.includes('repete')));
    const c = ok() as SheetLayout; (c.sections[0].items[0] as unknown as Record<string, unknown>).x = 'oi';
    assert.ok(parseLayout(c).errors.some((e) => e.includes('número')));
    const d = ok() as SheetLayout; (d.sections[0].items[0] as unknown as Record<string, unknown>).shape = 'estrela';
    assert.ok(parseLayout(d).errors.some((e) => e.includes('formato')));
    const e = ok() as SheetLayout; e.sections[0].title = '  ';
    assert.ok(parseLayout(e).errors.some((m) => m.includes('nome')));
    const f = { pages: 1, sections: Array.from({ length: 81 }, (_, i) => ({ id: 's' + i, title: 'x', page: 1, x: 0, y: 0, w: 40, h: 10, items: [] })) };
    assert.ok(parseLayout(f).errors.some((m) => m.includes('demais')));
  });
});

describe('conciliação com os atributos', () => {
  const attrs = [attr(0, 'number'), attr(1, 'text'), attr(2, 'boolean')];
  it('tira o que aponta para atributo apagado ou repetido e devolve a gaveta na ordem do cadastro', () => {
    const l = autoLayout(attrs); l.sections[0].items.push({ ...l.sections[0].items[0] });
    l.sections[0].items.push({ attributeId: 'fantasma', x: 0, y: 0, w: 20, h: 10, shape: 'rect' });
    const r = reconcile(l, attrs.slice(0, 2));
    assert.deepEqual(r.layout.sections[0].items.map((i) => i.attributeId), ['a0', 'a1']);
    assert.equal(r.dropped.length, 3); // o repetido, o fantasma e o a2 (que saiu do sistema)
    assert.deepEqual(trayOf(r.layout, attrs), ['a2'], 'um atributo novo cai na gaveta');
  });
});

describe('validação geométrica', () => {
  const attrs = [attr(0, 'number'), attr(1, 'text'), attr(2, 'longtext')];
  const base = (): SheetLayout => autoLayout(attrs);
  const has = (l: SheetLayout, part: string) => validateLayout(l, attrs).some((p) => p.includes(part));
  it('aceita o layout automático', () => assert.deepEqual(validateLayout(base(), attrs), []));
  it('pega campo fora da seção', () => { const l = base(); l.sections[0].items[0].x = 500; assert.ok(has(l, 'sai da seção')); });
  it('pega campos sobrepostos', () => { const l = base(); l.sections[0].items[1].x = l.sections[0].items[0].x; l.sections[0].items[1].y = l.sections[0].items[0].y; assert.ok(has(l, 'se sobrepõe a outro campo')); });
  it('pega formato que não serve para o tipo', () => { const l = base(); l.sections[0].items[2].shape = 'triangle'; assert.ok(has(l, 'não aceita o formato')); });
  it('pega círculo que não é quadrado', () => { const l = base(); const i = l.sections[0].items[0]; i.shape = 'circle'; i.w = 20; i.h = 14; assert.ok(has(l, 'círculo')); });
  it('pega campo menor que o mínimo do tipo', () => { const l = base(); l.sections[0].items[0].w = 5; assert.ok(has(l, 'pequeno demais')); });
  it('pega seção que passa da folha e a que invade o cabeçalho da primeira página', () => {
    const l = base(); l.sections[0].y = 270; assert.ok(has(l, 'ultrapassa a folha'));
    const m = base(); m.sections[0].y = 5; assert.ok(has(m, 'ultrapassa a folha'), 'o cabeçalho ocupa o alto da página 1');
  });
  it('pega seções sobrepostas, mas aceita lado a lado', () => {
    const l = base(); l.sections.push({ id: 's9', title: 'Outra', page: 1, x: 0, y: l.sections[0].y, w: 100, h: 20, items: [] }); assert.ok(has(l, 'se sobrepõe à seção'));
    const m = base(); m.sections[0].w = 90; m.sections.push({ id: 's9', title: 'Ao lado', page: 1, x: 94, y: m.sections[0].y, w: 90, h: 20, items: [] });
    assert.ok(!validateLayout(m, attrs).some((p) => p.includes('se sobrepõe à seção')));
  });
  it('pega página que não existe', () => { const l = base(); l.sections[0].page = 3; assert.ok(has(l, 'não existe')); });
});

describe('reparo', () => {
  const attrs = bigSystem();
  it('não altera um layout que já é válido (reabrir não pode mudar nada)', () => {
    const l = autoLayout(attrs);
    assert.deepEqual(repairLayout(l, attrs), l);
    const once = repairLayout(l, attrs);
    assert.deepEqual(repairLayout(once, attrs), once);
  });
  it('conserta um layout quebrado de várias formas, sem perder campo nenhum', () => {
    const small = [attr(0, 'number'), attr(1, 'text'), attr(2, 'longtext'), attr(3, 'boolean')];
    const broken: SheetLayout = { pages: 1, memo: {}, sections: [
      { id: 's1', title: 'A', page: 1, x: -5, y: -3, w: 10, h: 3, items: [
        { attributeId: 'a0', x: 300, y: 200, w: 2, h: 2, shape: 'circle' },
        { attributeId: 'a1', x: 300, y: 200, w: 62, h: 12, shape: 'rect' },
        { attributeId: 'a2', x: 0, y: 0, w: 150, h: 28, shape: 'shield' },
        { attributeId: 'a3', x: 0, y: 0, w: 44, h: 8, shape: 'rect' },
        { attributeId: 'ninguem', x: 0, y: 0, w: 20, h: 10, shape: 'rect' },
      ] },
      { id: 's2', title: 'B', page: 1, x: 0, y: 0, w: 190, h: 40, items: [] },
    ] };
    const fixed = repairLayout(broken, small);
    assert.deepEqual(validateLayout(fixed, small), []);
    const kept = new Set([...ids(fixed), ...trayOf(fixed, small)]);
    assert.equal(kept.size, 4, 'nenhum campo some');
  });
  it('fuzz: 300 layouts aleatórios e malucos sempre voltam válidos', () => {
    const rnd = mulberry32(42);
    const shapes: ShapeKey[] = ['rect', 'rounded', 'pill', 'ellipse', 'circle', 'diamond', 'triangle', 'hexagon', 'shield'];
    for (let n = 0; n < 300; n++) {
      const attrs2 = Array.from({ length: 4 + Math.floor(rnd() * 20) }, (_, i) => attr(i, TYPES[Math.floor(rnd() * TYPES.length)], null));
      const pages = 1 + Math.floor(rnd() * 3);
      const layout: SheetLayout = { pages, memo: {}, sections: Array.from({ length: 1 + Math.floor(rnd() * 5) }, (_, si) => ({
        id: 's' + si, title: 'S' + si, page: 1 + Math.floor(rnd() * pages), x: rnd() * 220 - 15, y: rnd() * 300 - 10, w: rnd() * 250, h: rnd() * 300, items: [],
      })) };
      attrs2.forEach((a) => { if (rnd() < 0.85) layout.sections[Math.floor(rnd() * layout.sections.length)].items.push({ attributeId: a.id, x: rnd() * 220 - 10, y: rnd() * 120 - 10, w: rnd() * 200, h: rnd() * 60, shape: shapes[Math.floor(rnd() * shapes.length)] }); });
      const fixed = repairLayout(layout, attrs2);
      const problems = validateLayout(fixed, attrs2);
      assert.deepEqual(problems, [], `caso ${n}: ${problems.slice(0, 2).join(' | ')}`);
      assert.deepEqual(repairLayout(fixed, attrs2), fixed, `caso ${n}: reparar duas vezes não pode mudar nada`);
    }
  });
});

describe('espaço livre e crescimento', () => {
  it('acha o espaço livre mais perto, ou diz o quanto a seção precisa crescer', () => {
    const sec = { w: 100, h: 30, items: [{ attributeId: 'a', x: 0, y: 0, w: 100, h: 30, shape: 'rect' as ShapeKey }] };
    const spot = freeSpotInSection(sec, 20, 10, 0, 0);
    assert.ok(spot.needB > 30, 'cheia: precisa crescer para baixo');
    const roomy = { w: 100, h: 30, items: [{ attributeId: 'a', x: 0, y: 0, w: 40, h: 30, shape: 'rect' as ShapeKey }] };
    const s2 = freeSpotInSection(roomy, 20, 10, 0, 0);
    assert.ok(s2.x >= 41.8 - 0.01 && s2.needB === 0, 'ao lado, com a folga padrão');
  });
  it('a seção só cresce se houver folha e nenhuma vizinha no caminho', () => {
    const l: SheetLayout = { pages: 1, memo: {}, sections: [
      { id: 's1', title: 'A', page: 1, x: 0, y: 17, w: 100, h: 30, items: [] },
      { id: 's2', title: 'B', page: 1, x: 0, y: 17 + outerHeight({ h: 30 }) + 3.5, w: 100, h: 30, items: [] },
    ] };
    assert.equal(sectionGrowth(l, l.sections[0], 50, 40), null, 'a vizinha de baixo bloqueia');
    assert.deepEqual(sectionGrowth(l, l.sections[0], 150, 30), { w: 150, h: 30 }, 'para a direita há folha livre');
    assert.equal(sectionGrowth(l, l.sections[1], 100, MAX_BODY_H), null, 'passaria do fim da página');
    assert.ok(USABLE > 0);
  });
});
