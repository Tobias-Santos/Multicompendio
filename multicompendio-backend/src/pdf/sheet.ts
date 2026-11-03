import { CharacterValue, CharacterValues } from '../types/character';
import { SystemAttribute } from '../types/system';
import { BoolCell, Cell, Flow, GridRow, LongRow, NumCell, Row, ShortCell, drawSection } from './kit';
import { formatNumber, formatValue, isEmptyValue, sanitize } from './text';

// Layout genérico da ficha: qualquer sistema, qualquer campo. As seções seguem a ordem em que aparecem
// e, dentro de cada uma, os campos consecutivos do mesmo "jeito" são agrupados:
//   - 3 ou mais números seguidos: caixas em grade (até 6 por linha);
//   - campos curtos (texto, lista, número solto, verdadeiro ou falso): 2 colunas, ou 3 quando os campos
//     seguem um padrão de 3 que se repete (ex.: nome, bônus e dano de cada ataque);
//   - 3 ou mais verdadeiro ou falso seguidos: caixinhas compactas em 3 colunas;
//   - texto longo e "texto com número": largura toda.

export interface SheetOptions {
  blank: boolean; // ficha em branco: mesma estrutura, sem valores
  hideEmpty: boolean; // não mostra os campos sem valor
}

type Kind = 'num' | 'bool' | 'text' | 'long';

const kindOf = (a: SystemAttribute): Kind => {
  switch (a.data_type) {
    case 'number':
      return 'num';
    case 'boolean':
      return 'bool';
    case 'longtext':
    case 'text_number':
      return 'long';
    default:
      return 'text';
  }
};

interface Segment {
  kind: 'num' | 'short' | 'bools' | 'long';
  items: SystemAttribute[];
}

export function segments(attrs: SystemAttribute[]): Segment[] {
  const segs: Segment[] = [];
  for (const a of attrs) {
    const k = kindOf(a);
    const kind: Segment['kind'] = k === 'num' ? 'num' : k === 'long' ? 'long' : 'short';
    const last = segs[segs.length - 1];
    if (last && last.kind === kind && kind !== 'long') last.items.push(a);
    else segs.push({ kind, items: [a] });
  }
  // números isolados ou em dupla viram campos curtos (e se juntam aos curtos vizinhos)
  for (const s of segs) if (s.kind === 'num' && s.items.length < 3) s.kind = 'short';
  const merged: Segment[] = [];
  for (const s of segs) {
    const last = merged[merged.length - 1];
    if (last && last.kind === 'short' && s.kind === 'short') last.items.push(...s.items);
    else merged.push(s);
  }
  for (const s of merged) {
    if (s.kind === 'short' && s.items.length >= 3 && s.items.every((a) => kindOf(a) === 'bool')) s.kind = 'bools';
  }
  return merged;
}

// 2 colunas por padrão; 3 quando os campos repetem um padrão de 3 (cada grupo fica numa linha só).
export function chooseCols(items: SystemAttribute[]): 2 | 3 {
  const kinds = items.map((a) => a.data_type);
  for (const p of [2, 3] as const) {
    if (kinds.length >= 2 * p && kinds.every((k, i) => k === kinds[i % p])) return p;
  }
  return 2;
}

function numberText(value: CharacterValue | undefined): string {
  return typeof value === 'number' ? formatNumber(value) : '';
}

export function buildRows(attrs: SystemAttribute[], values: CharacterValues, opts: SheetOptions): Row[] {
  const get = (a: SystemAttribute): CharacterValue | undefined => (opts.blank ? undefined : values[a.id]);
  const visible = opts.hideEmpty && !opts.blank ? attrs.filter((a) => !isEmptyValue(get(a))) : attrs;
  const rows: Row[] = [];
  const longMin = opts.blank ? 5 : 3;

  for (const { kind, items } of segments(visible)) {
    if (kind === 'num') {
      for (let i = 0; i < items.length; i += 6) {
        rows.push(new GridRow(items.slice(i, i + 6).map((a) => new NumCell(sanitize(a.name), numberText(get(a))) as Cell), 6));
      }
    } else if (kind === 'bools') {
      for (let i = 0; i < items.length; i += 3) {
        rows.push(new GridRow(items.slice(i, i + 3).map((a) => new BoolCell(sanitize(a.name), get(a) === true, 18) as Cell), 3));
      }
    } else if (kind === 'short') {
      const ncols = chooseCols(items);
      for (let i = 0; i < items.length; i += ncols) {
        const cells = items.slice(i, i + ncols).map((a): Cell => {
          const v = get(a);
          if (a.data_type === 'boolean') return new BoolCell(sanitize(a.name), v === true);
          return new ShortCell(sanitize(a.name), a.data_type === 'number' ? numberText(v) : formatValue(v));
        });
        rows.push(new GridRow(cells, ncols));
      }
    } else {
      for (const a of items) {
        const v = get(a);
        if (a.data_type === 'text_number') {
          const pair = typeof v === 'object' && v !== null ? v : null;
          rows.push(new LongRow(sanitize(a.name), pair ? sanitize(pair.text) : '', 2, { text: pair && pair.number !== null ? formatNumber(pair.number) : '' }));
        } else {
          rows.push(new LongRow(sanitize(a.name), formatValue(v), longMin));
        }
      }
    }
  }
  return rows;
}

// Agrupa os atributos em seções, na ordem em que cada seção aparece pela primeira vez.
export function groupSections(attrs: SystemAttribute[]): Array<{ title: string | null; items: SystemAttribute[] }> {
  const order: string[] = [];
  const groups = new Map<string, SystemAttribute[]>();
  for (const a of attrs) {
    const g = a.group_name ?? '';
    if (!groups.has(g)) {
      groups.set(g, []);
      order.push(g);
    }
    groups.get(g)?.push(a);
  }
  // os campos sem seção vêm primeiro, num bloco sem título
  order.sort((a, b) => (a === '' ? -1 : b === '' ? 1 : 0));
  return order.map((g) => ({ title: g === '' ? null : sanitize(g), items: groups.get(g) ?? [] }));
}

export function drawSheet(flow: Flow, attrs: SystemAttribute[], values: CharacterValues, opts: SheetOptions): void {
  for (const { title, items } of groupSections(attrs)) {
    const rows = buildRows(items, values, opts);
    if (rows.length > 0) drawSection(flow, title, rows);
  }
}
