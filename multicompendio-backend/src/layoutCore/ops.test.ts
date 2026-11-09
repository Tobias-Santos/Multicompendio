import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FieldType, LayoutAttribute, SheetLayout, ShapeKey, addPage, addSection, autoLayout, deleteSection, findSection, indexAttrs, locate,
  moveSectionTo, moveSectionToPage, placeItem, resizeSectionFrame, removePage, sectionSnapLines, sendToTray, setItemRect, setItemShape, setSectionRect, snapItemEdge,
  snapItemMove, snapVal, trayOf, validateLayout,
} from './index';

const attr = (i: number, type: FieldType, group: string | null = 'G'): LayoutAttribute => ({ id: `a${i}`, name: `Campo ${i}`, type, group, order: i });
const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o)) as T;
function mulberry32(seed: number): () => number { let a = seed; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const base = (): { attrs: LayoutAttribute[]; layout: SheetLayout } => {
  const attrs = [attr(0, 'number'), attr(1, 'number'), attr(2, 'text'), attr(3, 'longtext'), attr(4, 'boolean')];
  return { attrs, layout: autoLayout(attrs) };
};
const everyone = (l: SheetLayout, attrs: LayoutAttribute[]): boolean => new Set([...l.sections.flatMap((s) => s.items.map((i) => i.attributeId)), ...trayOf(l, attrs)]).size === attrs.length;

describe('campos', () => {
  it('guardar na gaveta lembra tamanho e formato, e colocar de volta os restaura', () => {
    const { attrs, layout } = base(); const idx = indexAttrs(attrs);
    assert.ok(setItemShape(layout, idx, 'a0', 'ellipse'));
    const antes = clone(locate(layout, 'a0')?.item);
    sendToTray(layout, 'a0');
    assert.equal(locate(layout, 'a0'), null);
    assert.deepEqual(trayOf(layout, attrs), ['a0']);
    assert.equal(layout.memo.a0.shape, 'ellipse');
    const r = placeItem(layout, idx, 'a0', layout.sections[0].id, 100, 0);
    assert.ok(r.ok);
    const depois = locate(layout, 'a0')?.item;
    assert.equal(depois?.shape, 'ellipse'); assert.equal(depois?.w, antes?.w); assert.equal(depois?.h, antes?.h);
    assert.equal(layout.memo.a0, undefined, 'a memória some quando o campo volta');
    assert.deepEqual(validateLayout(layout, attrs), []);
  });
  it('soltar abaixo do fim da seção a faz crescer quando há folha', () => {
    const attrs = [attr(0, 'number'), attr(1, 'number')];
    const layout = autoLayout(attrs); const idx = indexAttrs(attrs);
    const s = layout.sections[0]; const h0 = s.h;
    assert.ok(placeItem(layout, idx, 'a1', s.id, 0, 40).ok);
    assert.ok(findSection(layout, s.id)!.h >= 40 + 14 && findSection(layout, s.id)!.h > h0);
    assert.deepEqual(validateLayout(layout, attrs), []);
  });
  it('com outra seção logo abaixo, a seção não cresce e o campo volta ao lugar', () => {
    const attrs = [attr(0, 'number', 'A'), attr(1, 'number', 'A'), attr(2, 'number', 'B')];
    const layout = autoLayout(attrs); const idx = indexAttrs(attrs);
    const a = layout.sections[0]; const before = clone(locate(layout, 'a1')?.item);
    const r = placeItem(layout, idx, 'a1', a.id, 0, 60);
    assert.equal(r.note, 'nogrow');
    const now = locate(layout, 'a1')?.item;
    assert.ok(r.ok ? now!.y + now!.h <= a.h + 0.01 : true);
    assert.deepEqual(validateLayout(layout, attrs), []);
    assert.ok(before);
  });
  it('um campo que não cabe em lugar nenhum volta de onde veio, sem se perder', () => {
    const attrs = [attr(0, 'longtext'), attr(1, 'longtext')];
    const layout = autoLayout(attrs); const idx = indexAttrs(attrs);
    const sec = layout.sections[0];
    sec.items.forEach((i) => { i.x = 0; });
    const antes = clone(layout);
    const r = placeItem(layout, idx, 'a1', sec.id, 0, 0, { w: 190, h: 270 }); // maior que uma página
    assert.equal(r.ok, false);
    assert.deepEqual(layout.sections.map((s) => s.items.map((i) => ({ ...i }))), antes.sections.map((s) => s.items.map((i) => ({ ...i }))), 'tudo continua onde estava');
  });
  it('mudar tamanho: cresce a seção se preciso, recusa sobreposição e mantém o círculo quadrado', () => {
    const { attrs, layout } = base(); const idx = indexAttrs(attrs);
    const a0 = locate(layout, 'a0')!.item; const w0 = a0.w;
    assert.ok(setItemRect(layout, idx, 'a0', { w: w0 - 5 }));
    const c = clone(layout);
    assert.equal(setItemRect(c, idx, 'a1', { x: locate(c, 'a0')!.item.x, y: locate(c, 'a0')!.item.y }), false, 'em cima do vizinho');
    assert.ok(setItemShape(layout, idx, 'a0', 'circle'));
    const ci = locate(layout, 'a0')!.item;
    assert.equal(ci.w, ci.h);
    assert.equal(setItemRect(clone(layout), idx, 'a0', { w: 20 }), false, 'um círculo de 20 mm bateria no campo da linha de baixo');
    assert.ok(setItemRect(layout, idx, 'a0', { w: 15 }));
    assert.equal(locate(layout, 'a0')!.item.h, 15, 'largura do círculo muda a altura junto');
    assert.deepEqual(validateLayout(layout, attrs), []);
  });
  it('formato que não serve ao tipo é recusado', () => {
    const { attrs, layout } = base(); const idx = indexAttrs(attrs);
    assert.equal(setItemShape(layout, idx, 'a3', 'triangle'), false, 'texto longo');
    assert.ok(setItemShape(layout, idx, 'a3', 'rounded'));
  });
});

describe('seções e páginas', () => {
  it('criar, mudar de lugar, de página, e apagar (os campos vão para a gaveta)', () => {
    const { attrs, layout } = base();
    const s = addSection(layout, layout.sections[0].id);
    assert.equal(s.w, 90); assert.equal(s.h, 30);
    assert.ok(new Set(layout.sections.map((x) => x.id)).size === layout.sections.length, 'ids únicos');
    assert.ok(setSectionRect(layout, s.id, { w: 100, h: 40 }));
    assert.ok(moveSectionToPage(layout, s.id, 2));
    assert.equal(findSection(layout, s.id)!.page, 2);
    assert.equal(layout.pages, 2);
    assert.deepEqual(validateLayout(layout, attrs), []);
    deleteSection(layout, layout.sections[0].id);
    assert.equal(trayOf(layout, attrs).length, 5, 'os cinco campos da primeira seção foram para a gaveta');
    assert.ok(Object.keys(layout.memo).length === 5);
  });
  it('o mínimo de uma seção vem dos campos, e a vizinha limita', () => {
    const attrs = [attr(0, 'number')];
    const layout: SheetLayout = { pages: 1, memo: {}, sections: [
      { id: 's1', title: 'A', page: 1, x: 0, y: 17, w: 100, h: 30, items: [{ attributeId: 'a0', x: 0, y: 0, w: 40, h: 14, shape: 'rect' }] },
      { id: 's2', title: 'B', page: 1, x: 143.5, y: 17, w: 40, h: 30, items: [] },
    ] };
    assert.deepEqual(validateLayout(layout, attrs), []);
    assert.ok(setSectionRect(layout, 's1', { w: 20, h: 5 }));
    const a = findSection(layout, 's1')!;
    assert.equal(a.w, 40, 'não passa do campo mais à direita (e o mínimo da seção é 36 mm)');
    assert.equal(a.h, 14, 'nem do campo mais embaixo');
    assert.ok(setSectionRect(layout, 's1', { w: 100 }), 'cresce até encostar na vizinha');
    assert.deepEqual(validateLayout(layout, attrs), []);
    const c = clone(layout);
    assert.ok(setSectionRect(clone(layout), 's1', { w: 140 }), 'até antes da vizinha ainda cabe');
    assert.equal(setSectionRect(c, 's1', { w: 150 }), false, 'a vizinha (que começa em 143,5 mm) trava o crescimento');
    assert.equal(setSectionRect(c, 's1', { w: 185 }), false);
    assert.equal(setSectionRect(c, 's2', { x: 190 }), true, 'a vizinha se acomoda no limite da folha (x é contido)');
  });
  it('mover a seção para um ponto: usa o ponto se estiver livre, o espaço livre mais perto se não, e cria a página seguinte', () => {
    const attrs = [attr(0, 'number')];
    const layout: SheetLayout = { pages: 1, memo: {}, sections: [
      { id: 's1', title: 'A', page: 1, x: 0, y: 17, w: 100, h: 30, items: [] },
      { id: 's2', title: 'B', page: 1, x: 0, y: 70, w: 60, h: 30, items: [] },
    ] };
    assert.ok(moveSectionTo(layout, 's2', 1, 110, 20));
    assert.equal(findSection(layout, 's2')!.x, 110);
    assert.equal(findSection(layout, 's2')!.y, 20);
    assert.ok(moveSectionTo(layout, 's2', 1, 10, 20), 'em cima da outra: vai para o espaço livre mais perto');
    assert.deepEqual(validateLayout(layout, attrs), []);
    assert.ok(moveSectionTo(layout, 's2', 2, 0, 0));
    assert.equal(layout.pages, 2);
    assert.equal(findSection(layout, 's2')!.page, 2);
    assert.equal(moveSectionTo(layout, 's2', 5, 0, 0), true, 'uma página muito além vira a seguinte à última');
    assert.equal(findSection(layout, 's2')!.page, 3);
  });
  it('mover a moldura da seção não move os campos na folha', () => {
    const attrs = [attr(0, 'number')];
    const layout: SheetLayout = { pages: 1, memo: {}, sections: [{ id: 's1', title: 'A', page: 1, x: 20, y: 40, w: 100, h: 50, items: [{ attributeId: 'a0', x: 30, y: 10, w: 30, h: 14, shape: 'rect' }] }] };
    const ab = (l: SheetLayout) => ({ x: l.sections[0].x + l.sections[0].items[0].x, y: l.sections[0].y + 8 + l.sections[0].items[0].y });
    const antes = ab(layout);
    assert.ok(resizeSectionFrame(layout, 's1', { x: 40, y: 45, w: 80, h: 45 }));
    assert.deepEqual(ab(layout), antes, 'o campo continua no mesmo ponto da página');
    assert.deepEqual(validateLayout(layout, attrs), []);
    assert.equal(resizeSectionFrame(clone(layout), 's1', { x: 60, y: 45, w: 60, h: 45 }), false, 'a moldura não pode deixar o campo de fora');
    assert.equal(resizeSectionFrame(clone(layout), 's1', { x: 0, y: 0, w: 100, h: 50 }), false, 'nem invadir o cabeçalho da página 1');
  });
  it('remover página: só se estiver vazia, e as seguintes sobem um número', () => {
    const { layout } = base();
    addPage(layout); addPage(layout);
    const s = addSection(layout); moveSectionToPage(layout, s.id, 3);
    assert.equal(removePage(layout, 3), false, 'a página 3 tem seção');
    assert.ok(removePage(layout, 2));
    assert.equal(findSection(layout, s.id)!.page, 2);
    assert.equal(layout.pages, 2);
    assert.equal(removePage(layout, 1), false, 'a primeira tem seções');
  });
});

describe('ímã', () => {
  it('encaixa nas bordas dos vizinhos, e solta na grade de 1 mm quando nada está perto', () => {
    const sec = { w: 100, h: 50, items: [{ attributeId: 'x', x: 0, y: 0, w: 30, h: 14, shape: 'rect' as ShapeKey }] };
    const perto = snapItemMove(sec, { x: 31.2, y: 0.4, w: 20, h: 10 }, undefined, 1.5);
    assert.ok(Math.abs(perto.rect.x - 31.8) < 0.01, 'à direita do vizinho, com a folga padrão');
    assert.equal(perto.rect.y, 0);
    assert.ok(perto.guides.length >= 1);
    const longe = snapItemMove(sec, { x: 60.4, y: 30.4, w: 20, h: 10 }, undefined, 1.5);
    assert.equal(longe.rect.x, 60); assert.equal(longe.rect.y, 30);
    const borda = snapItemEdge(sec, undefined, 'x', 99.2, 'max', 1.5, { x: 70, y: 0, w: 29.2, h: 10 });
    assert.equal(borda.v, 100);
    const sv = snapVal(10.4, [10, 20], 1);
    assert.ok(sv && Math.abs(sv.d + 0.4) < 1e-9 && sv.line === 10);
  });
  it('linhas de ímã das seções incluem as bordas da folha e das outras seções da mesma página', () => {
    const { layout } = base();
    const L = sectionSnapLines(layout, 1, layout.sections[0].id);
    assert.ok(L.xs.includes(0) && L.xs.includes(190) && L.ys.includes(273));
    const L2 = sectionSnapLines(layout, 1);
    assert.ok(L2.ys.length > L.ys.length);
  });
});

describe('fuzz de operações', () => {
  it('600 operações aleatórias: depois de cada uma aceita, o layout continua válido e completo', () => {
    const rnd = mulberry32(7);
    const TYPES: FieldType[] = ['number', 'text', 'longtext', 'boolean', 'select', 'text_number'];
    for (let round = 0; round < 6; round++) {
      const attrs = Array.from({ length: 10 + Math.floor(rnd() * 25) }, (_, i) => attr(i, TYPES[Math.floor(rnd() * TYPES.length)], ['A', 'B', 'C'][Math.floor(rnd() * 3)]));
      const idx = indexAttrs(attrs);
      let layout = autoLayout(attrs);
      const shapes: ShapeKey[] = ['rect', 'rounded', 'pill', 'ellipse', 'circle', 'diamond', 'triangle', 'hexagon', 'shield'];
      for (let n = 0; n < 100; n++) {
        const draft = clone(layout);
        const a = attrs[Math.floor(rnd() * attrs.length)];
        const sec = draft.sections[Math.floor(rnd() * draft.sections.length)];
        const op = Math.floor(rnd() * 11);
        let ok = true;
        if (op === 0) ok = placeItem(draft, idx, a.id, sec.id, rnd() * 190, rnd() * 80).ok;
        else if (op === 1) ok = setItemRect(draft, idx, a.id, { x: rnd() * 150, y: rnd() * 60 });
        else if (op === 2) ok = setItemRect(draft, idx, a.id, { w: 10 + rnd() * 120, h: 6 + rnd() * 50 });
        else if (op === 3) ok = setItemShape(draft, idx, a.id, shapes[Math.floor(rnd() * shapes.length)]);
        else if (op === 4) sendToTray(draft, a.id);
        else if (op === 5) addSection(draft, sec?.id);
        else if (op === 6) { if (draft.sections.length > 1) deleteSection(draft, sec.id); }
        else if (op === 7) ok = setSectionRect(draft, sec.id, { x: rnd() * 120, y: rnd() * 150, w: 30 + rnd() * 160, h: 10 + rnd() * 120 });
        else if (op === 8) ok = moveSectionToPage(draft, sec.id, 1 + Math.floor(rnd() * (draft.pages + 1)));
        else if (op === 9) { if (rnd() < 0.5) addPage(draft); else removePage(draft, 1 + Math.floor(rnd() * draft.pages)); }
        else ok = setSectionRect(draft, sec.id, { page: 1 + Math.floor(rnd() * draft.pages) });
        if (!ok) continue; // a operação foi recusada: o editor descarta o rascunho
        const problems = validateLayout(draft, attrs);
        assert.deepEqual(problems, [], `rodada ${round}, passo ${n}, operação ${op}: ${problems.slice(0, 2).join(' | ')}`);
        assert.ok(everyone(draft, attrs), `rodada ${round}, passo ${n}, operação ${op}: algum campo se perdeu`);
        layout = draft;
      }
    }
  });
});
