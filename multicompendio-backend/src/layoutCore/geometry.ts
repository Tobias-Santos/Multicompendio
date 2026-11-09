import { CW, GAP, MAX_BODY_H, MIN_SEC_H, SEC_GAP, USABLE, BAR, BAR_GAP, ceil1, clamp, floor1, outerHeight, pageTop, r1 } from './constants';
import { LayoutItem, LayoutSection, SheetLayout } from './types';

export interface Rect { x: number; y: number; w: number; h: number }

// Encostar não é sobrepor: só conta quando as áreas realmente se cruzam.
export const overlap = (a: Rect, b: Rect): boolean => a.x < b.x + b.w - 0.01 && a.x + a.w > b.x + 0.01 && a.y < b.y + b.h - 0.01 && a.y + a.h > b.y + 0.01;

export const sectionRect = (s: LayoutSection): Rect => ({ x: s.x, y: s.y, w: s.w, h: outerHeight(s) });

// O retângulo que envolve os campos de uma seção: é o mínimo que ela pode ter.
export function itemsBounds(items: LayoutItem[], ignoreId?: string): { l: number; t: number; r: number; b: number; any: boolean } {
  const its = items.filter((o) => o.attributeId !== ignoreId);
  if (!its.length) return { l: 0, t: 0, r: 0, b: 0, any: false };
  return {
    l: Math.min(...its.map((o) => o.x)),
    t: Math.min(...its.map((o) => o.y)),
    r: Math.max(...its.map((o) => o.x + o.w)),
    b: Math.max(...its.map((o) => o.y + o.h)),
    any: true,
  };
}

export const itemCollides = (items: LayoutItem[], r: Rect, ignoreId?: string): boolean => items.some((o) => o.attributeId !== ignoreId && overlap(r, o));

// O espaço livre dentro da seção mais perto de (px, py) onde cabe w × h. Se não houver, devolve o ponto embaixo de tudo
// e o quanto a seção precisaria crescer (needR, needB).
export function freeSpotInSection(sec: Pick<LayoutSection, 'w' | 'h' | 'items'>, w: number, h: number, px: number, py: number, ignoreId?: string): { x: number; y: number; needR: number; needB: number } {
  const others = sec.items.filter((o) => o.attributeId !== ignoreId);
  const xs = new Set<number>([px, 0, sec.w - w]);
  const ys = new Set<number>([py, 0, sec.h - h]);
  others.forEach((o) => {
    [o.x + o.w + GAP, o.x - GAP - w, o.x, o.x + o.w - w].forEach((v) => xs.add(v));
    [o.y + o.h + GAP, o.y - GAP - h, o.y, o.y + o.h - h].forEach((v) => ys.add(v));
  });
  let best: { x: number; y: number; d: number } | null = null;
  for (const x of xs) {
    for (const y of ys) {
      const r = { x: floor1(Math.max(0, x)), y: floor1(Math.max(0, y)), w, h };
      if (x < -0.01 || y < -0.01 || r.x + w > sec.w + 0.01 || r.y + h > sec.h + 0.01) continue;
      if (itemCollides(others, r)) continue;
      const d = (r.x - px) ** 2 + (r.y - py) ** 2;
      if (!best || d < best.d) best = { x: r.x, y: r.y, d };
    }
  }
  if (best) return { x: best.x, y: best.y, needR: 0, needB: 0 };
  const bottom = others.reduce((m, o) => Math.max(m, o.y + o.h), 0);
  const y = others.length ? r1(bottom + GAP) : 0;
  const x = floor1(clamp(px, 0, Math.max(0, sec.w - w)));
  return { x, y, needR: x + w, needB: y + h };
}

export const pageFits = (page: number, r: Rect): boolean => r.x >= -0.01 && r.y >= pageTop(page) - 0.01 && r.x + r.w <= CW + 0.01 && r.y + r.h <= USABLE + 0.01;

export const pageSections = (layout: SheetLayout, page: number, ignoreId?: string): LayoutSection[] => layout.sections.filter((s) => s.page === page && s.id !== ignoreId);

export const pageCollides = (layout: SheetLayout, page: number, r: Rect, ignoreId?: string): boolean => pageSections(layout, page, ignoreId).some((o) => overlap(r, sectionRect(o)));

// O espaço livre da página mais perto de (px, py) onde cabe uma seção de w × h (altura total, com a faixa). Nulo se a página está cheia.
export function freeSpotOnPage(layout: SheetLayout, page: number, w: number, h: number, px: number, py: number, ignoreId?: string): { x: number; y: number } | null {
  const others = pageSections(layout, page, ignoreId).map(sectionRect);
  const xs = new Set<number>([px, 0, CW - w]);
  const ys = new Set<number>([py, pageTop(page), USABLE - h]);
  others.forEach((o) => {
    [o.x + o.w + SEC_GAP, o.x - SEC_GAP - w, o.x, o.x + o.w - w].forEach((v) => xs.add(v));
    [o.y + o.h + SEC_GAP, o.y - SEC_GAP - h, o.y, o.y + o.h - h].forEach((v) => ys.add(v));
  });
  let best: { x: number; y: number; d: number } | null = null;
  for (const x of xs) {
    for (const y of ys) {
      const r = { x: floor1(Math.max(0, x)), y: floor1(Math.max(pageTop(page), y)), w, h };
      if (!pageFits(page, r) || others.some((o) => overlap(r, o))) continue;
      const d = (r.x - px) ** 2 + (r.y - py) ** 2;
      if (!best || d < best.d) best = { x: r.x, y: r.y, d };
    }
  }
  return best ? { x: best.x, y: best.y } : null;
}

// A seção pode crescer (para a direita e para baixo) até caber um retângulo que termina em (needR, needB)? Devolve o novo tamanho.
export function sectionGrowth(layout: SheetLayout, sec: LayoutSection, needR: number, needB: number): { w: number; h: number } | null {
  const w = Math.max(sec.w, ceil1(needR));
  const h = Math.max(sec.h, ceil1(needB));
  if (h > MAX_BODY_H + 0.01 || h < MIN_SEC_H - 0.01) return null;
  const rect = { x: sec.x, y: sec.y, w, h: BAR + BAR_GAP + h };
  if (!pageFits(sec.page, rect) || pageCollides(layout, sec.page, rect, sec.id)) return null;
  return { w, h };
}
