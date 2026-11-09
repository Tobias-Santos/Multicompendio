import { BAR, BAR_GAP, CW, GAP, LIMITS, MIN_SEC_H, SEC_GAP, USABLE, outerHeight, pageTop, r1 } from './constants';
import { shapeAllowed } from './shapes';
import { FieldType, LayoutAttribute, LayoutItem, LayoutSection, SheetLayout, ShapeKey } from './types';

// Layout automático: as mesmas regras do PDF de linhas (v1.7), agora como posição e tamanho de cada campo.
//   - 3 ou mais números seguidos viram uma grade de caixas (até 6 por linha);
//   - campos curtos (texto, lista, número solto, verdadeiro ou falso) ficam em 2 colunas, ou 3 quando seguem um padrão de 3;
//   - pares "número + verdadeiro ou falso" repetidos ficam dois por linha (número estreito, verdadeiro ou falso largo);
//   - trios "número + número + texto longo" repetidos ficam numa linha só (os números à esquerda, o texto à direita);
//   - 3 ou mais verdadeiro ou falso seguidos viram caixinhas compactas em 3 colunas;
//   - texto longo e "texto com número" ocupam a largura toda.
// Uma seção tem de caber numa página, por isso as muito altas são divididas ("… (continuação)").

export interface AutoOptions {
  // Ajustes por atributo (usados no layout curado do sistema pré-instalado): altura da linha e formato.
  overrides?: Record<string, { h?: number; shape?: ShapeKey }>;
}

function defaultHeight(type: FieldType): number {
  switch (type) {
    case 'number': return 14;
    case 'boolean': return 8;
    case 'longtext': // umas 5 linhas de escrita à mão
    case 'text_number': return 30;
    default: return 12;
  }
}

function pickCols(types: FieldType[]): 2 | 3 {
  for (const p of [2, 3] as const) {
    if (types.length >= 2 * p && types.every((t, i) => t === types[i % p])) return p;
  }
  return 2;
}

interface Cell { attr: LayoutAttribute; span: number }

function regularCells(list: LayoutAttribute[]): Cell[] {
  const kind = (a: LayoutAttribute): 'num' | 'long' | 'short' => (a.type === 'number' ? 'num' : a.type === 'longtext' || a.type === 'text_number' ? 'long' : 'short');
  const segs: Array<{ k: 'num' | 'long' | 'short'; items: LayoutAttribute[] }> = [];
  for (const a of list) {
    const k = kind(a);
    const last = segs[segs.length - 1];
    if (last && last.k === k && k !== 'long') last.items.push(a);
    else segs.push({ k, items: [a] });
  }
  segs.forEach((s) => { if (s.k === 'num' && s.items.length < 3) s.k = 'short'; });
  const merged: typeof segs = [];
  for (const s of segs) {
    const l = merged[merged.length - 1];
    if (l && l.k === 'short' && s.k === 'short') l.items.push(...s.items);
    else merged.push(s);
  }
  const out: Cell[] = [];
  for (const s of merged) {
    if (s.k === 'num') s.items.forEach((attr) => out.push({ attr, span: 1 }));
    else if (s.k === 'long') s.items.forEach((attr) => out.push({ attr, span: 6 }));
    else if (s.items.length >= 3 && s.items.every((a) => a.type === 'boolean')) s.items.forEach((attr) => out.push({ attr, span: 2 }));
    else {
      const types = s.items.map((a) => a.type);
      // Pares "número + verdadeiro ou falso" (ex.: o valor de uma perícia e se há proficiência): o número numa coluna estreita e o
      // verdadeiro ou falso numa larga, dois pares por linha. Metade da altura, e continua legível.
      const pairs = types.length >= 4 && new Set([types[0], types[1]]).size === 2 && types.every((t, i) => t === types[i % 2])
        && types.includes('number') && types.includes('boolean');
      if (pairs) s.items.forEach((attr) => out.push({ attr, span: attr.type === 'number' ? 1 : 2 }));
      else {
        const cols = pickCols(types);
        s.items.forEach((attr) => out.push({ attr, span: 6 / cols }));
      }
    }
  }
  return out;
}

// Trios "número + número + texto longo" repetidos (ex.: espaços de magia e a lista de magias de cada círculo) ficam numa linha só:
// os dois números à esquerda, estreitos, e o texto longo à direita. As demais sequências seguem as regras acima.
function toCells(list: LayoutAttribute[]): Cell[] {
  const out: Cell[] = [];
  let buf: LayoutAttribute[] = [];
  const flush = () => { if (buf.length) { out.push(...regularCells(buf)); buf = []; } };
  let i = 0;
  while (i < list.length) {
    let j = i;
    while (j + 2 < list.length && list[j].type === 'number' && list[j + 1].type === 'number' && list[j + 2].type === 'longtext') j += 3;
    if ((j - i) / 3 >= 2) {
      flush();
      for (let k = i; k < j; k += 3) out.push({ attr: list[k], span: 1 }, { attr: list[k + 1], span: 1 }, { attr: list[k + 2], span: 4 });
      i = j;
      continue;
    }
    buf.push(list[i]);
    i++;
  }
  flush();
  return out;
}

export function autoLayout(attrs: LayoutAttribute[], opts: AutoOptions = {}): SheetLayout {
  const sorted = [...attrs].sort((a, b) => a.order - b.order);
  const groups = new Map<string, LayoutAttribute[]>();
  for (const a of sorted) {
    const g = (a.group ?? '').trim();
    if (!groups.has(g)) groups.set(g, []);
    (groups.get(g) as LayoutAttribute[]).push(a);
  }
  const titles = [...groups.keys()].sort((a, b) => (a === '' ? -1 : b === '' ? 1 : 0)); // os campos sem seção vêm primeiro
  const col = (CW - 5 * GAP) / 6;
  const sections: LayoutSection[] = [];
  let n = 0;
  let page = 1;
  let top = pageTop(1); // onde a próxima seção começa na página atual

  for (const title of titles) {
    const baseTitle = (title || 'Geral').slice(0, LIMITS.titleLength - 14);
    const cells = toCells(groups.get(title) as LayoutAttribute[]);
    const rows: Cell[][] = [];
    let row: Cell[] = [];
    let sum = 0;
    for (const c of cells) {
      if (sum + c.span > 6) { rows.push(row); row = []; sum = 0; }
      row.push(c);
      sum += c.span;
    }
    if (row.length) rows.push(row);

    // As seções fluem pelas páginas como um texto: se a próxima linha não cabe no que sobra da página, a seção termina ali e continua
    // na página seguinte como "… (continuação)". Nunca fica uma linha só de um lado: cada parte tem pelo menos 2 linhas.
    let cur: LayoutSection = { id: 's' + ++n, title: baseTitle, page, x: 0, y: r1(top), w: CW, h: MIN_SEC_H, items: [] };
    let y = 0; // altura já usada no corpo da seção atual
    let marks: Array<{ start: number; y: number; h: number }> = []; // onde cada linha da seção atual começa
    const finish = () => {
      cur.h = Math.max(MIN_SEC_H, r1(y - GAP));
      sections.push(cur);
      top += outerHeight(cur) + SEC_GAP;
    };
    for (let ri = 0; ri < rows.length; ri++) {
      const r = rows[ri];
      const rowH = Math.max(...r.map((c) => opts.overrides?.[c.attr.id]?.h ?? defaultHeight(c.attr.type)));
      const fits = () => top + BAR + BAR_GAP + y + rowH <= USABLE + 0.01;
      if (!fits()) {
        const remaining = rows.length - ri; // linhas que faltam, contando esta
        if (marks.length >= 2) {
          // se só esta linha ficaria para a próxima página, leva junto a última que já estava aqui (restam 2 de cada lado)
          let carried: LayoutItem[] = [];
          let carriedH = 0;
          if (remaining === 1 && marks.length >= 3) {
            const m = marks.pop() as { start: number; y: number; h: number };
            carried = cur.items.splice(m.start);
            carriedH = m.h;
            y = m.y;
          }
          finish();
          page++;
          top = 0;
          cur = { id: 's' + ++n, title: `${baseTitle} (continuação)`, page, x: 0, y: 0, w: CW, h: MIN_SEC_H, items: [] };
          y = 0;
          marks = [];
          if (carried.length) {
            marks.push({ start: 0, y: 0, h: carriedH });
            carried.forEach((it) => { it.y = 0; cur.items.push(it); });
            y = carriedH + GAP;
          }
        } else if (top > pageTop(page)) {
          // quase nada da seção coube: ela inteira vai para a página seguinte
          page++;
          top = 0;
          cur.page = page;
          cur.y = 0;
        }
      }
      marks.push({ start: cur.items.length, y, h: rowH });
      let x = 0;
      for (const c of r) {
        const wRaw = col * c.span + (c.span - 1) * GAP;
        const wanted = opts.overrides?.[c.attr.id]?.shape;
        const shape: ShapeKey = wanted && wanted !== 'circle' && shapeAllowed(c.attr.type, wanted) ? wanted : 'rect';
        const item: LayoutItem = { attributeId: c.attr.id, x: r1(x), y: r1(y), w: Math.floor((wRaw + 1e-9) * 10) / 10, h: rowH, shape };
        cur.items.push(item);
        x += wRaw + GAP;
      }
      y += rowH + GAP;
    }
    finish();
  }
  void BAR_GAP;
  return { pages: Math.max(1, ...sections.map((s) => s.page)), sections, memo: {} };
}
