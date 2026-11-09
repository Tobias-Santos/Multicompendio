import { BAR, BAR_GAP, CW, DEFAULT_SIZE, MAX_BODY_H, MIN_SEC_H, MIN_SEC_W, SEC_GAP, USABLE, ceil1, clamp, floor1, outerHeight, pageTop, r1 } from './constants';
import {
  freeSpotInSection, freeSpotOnPage, itemCollides, itemsBounds, pageCollides, pageFits, pageSections, sectionGrowth,
} from './geometry';
import { allowedShapes, minSize, shapeAllowed } from './shapes';
import { LayoutAttribute, LayoutItem, LayoutSection, SheetLayout, ShapeKey } from './types';

// Operações de edição do layout (v1.8). Funções puras sobre um SheetLayout: cada uma altera o layout recebido (clone antes, se
// precisar do original) e devolve se conseguiu. O editor usa estas funções para tudo o que a pessoa faz; assim, o que ele aceita
// é exatamente o que o servidor aceita (o servidor valida com as mesmas regras).

export type AttrIndex = Map<string, LayoutAttribute>;
export const indexAttrs = (attrs: LayoutAttribute[]): AttrIndex => new Map(attrs.map((a) => [a.id, a]));

export function locate(layout: SheetLayout, attributeId: string): { sec: LayoutSection; item: LayoutItem; index: number } | null {
  for (const sec of layout.sections) {
    const index = sec.items.findIndex((x) => x.attributeId === attributeId);
    if (index >= 0) return { sec, item: sec.items[index], index };
  }
  return null;
}
export const findSection = (layout: SheetLayout, id: string): LayoutSection | undefined => layout.sections.find((s) => s.id === id);

function removeItem(layout: SheetLayout, attributeId: string): void {
  layout.sections.forEach((s) => { s.items = s.items.filter((x) => x.attributeId !== attributeId); });
}

function growSection(layout: SheetLayout, sec: LayoutSection, needR: number, needB: number): boolean {
  const g = sectionGrowth(layout, sec, needR, needB);
  if (!g) return false;
  sec.w = g.w;
  sec.h = g.h;
  return true;
}

// ------------------------------------------------------------------ campos
export interface PlaceResult { ok: boolean; note: '' | 'nogrow' | 'full' }

// Põe o campo na seção perto de (px, py). A seção cresce (para a direita e para baixo) se precisar e houver espaço na folha.
// Se não der de jeito nenhum, o campo volta ao lugar de onde saiu (ou à gaveta, se veio de lá) e devolve ok = false.
export function placeItem(layout: SheetLayout, attrs: AttrIndex, attributeId: string, sectionId: string, px: number, py: number, size?: { w: number; h: number }): PlaceResult {
  const a = attrs.get(attributeId);
  const sec = findSection(layout, sectionId);
  if (!a || !sec) return { ok: false, note: 'full' };
  const prev = locate(layout, attributeId);
  const memo = layout.memo[attributeId] ?? {};
  const back = prev ? { secId: prev.sec.id, item: { ...prev.item } } : null;
  const w0 = sec.w;
  const h0 = sec.h;
  let note: PlaceResult['note'] = '';
  const fail = (n: PlaceResult['note']): PlaceResult => {
    sec.w = w0;
    sec.h = h0;
    removeItem(layout, attributeId);
    const ps = back ? findSection(layout, back.secId) : undefined;
    if (back && ps) ps.items.push(back.item);
    return { ok: false, note: n || note || 'full' };
  };
  const shape: ShapeKey = prev ? prev.item.shape : memo.shape && shapeAllowed(a.type, memo.shape) ? memo.shape : 'rect';
  const [mw, mh] = minSize(a.type, shape);
  let w = clamp(size ? size.w : prev ? prev.item.w : memo.w ?? DEFAULT_SIZE[a.type][0], mw, CW);
  let h = clamp(size ? size.h : prev ? prev.item.h : memo.h ?? DEFAULT_SIZE[a.type][1], mh, USABLE);
  if (shape === 'circle') { w = Math.max(Math.min(w, h), mw); h = w; }
  removeItem(layout, attributeId);
  const x = Math.max(0, px);
  const y = Math.max(0, py);
  let spot = { x: floor1(x), y: floor1(y) };
  if (w > sec.w || h > sec.h) { if (!growSection(layout, sec, w, h)) return fail('nogrow'); }
  if (spot.x + w > sec.w || spot.y + h > sec.h) {
    if (!growSection(layout, sec, spot.x + w, spot.y + h)) {
      note = 'nogrow';
      spot = { x: floor1(clamp(x, 0, Math.max(0, sec.w - w))), y: floor1(clamp(y, 0, Math.max(0, sec.h - h))) };
    }
  }
  if (itemCollides(sec.items, { x: spot.x, y: spot.y, w, h })) {
    const fs = freeSpotInSection(sec, w, h, spot.x, spot.y);
    if (fs.needR || fs.needB) { if (!growSection(layout, sec, fs.needR, fs.needB)) return fail('nogrow'); }
    spot = { x: fs.x, y: fs.y };
  }
  sec.items.push({ attributeId, x: spot.x, y: spot.y, w: r1(w), h: r1(h), shape });
  delete layout.memo[attributeId];
  return { ok: true, note };
}

// Tira o campo da folha e o guarda na gaveta, lembrando o tamanho e o formato para quando voltar.
export function sendToTray(layout: SheetLayout, attributeId: string): void {
  const l = locate(layout, attributeId);
  if (l) layout.memo[attributeId] = { w: l.item.w, h: l.item.h, shape: l.item.shape };
  removeItem(layout, attributeId);
}

// Muda posição e/ou tamanho de um campo. A seção cresce se preciso e houver folha; recusa (false) se sobrepuser outro campo.
export function setItemRect(layout: SheetLayout, attrs: AttrIndex, attributeId: string, patch: Partial<Pick<LayoutItem, 'x' | 'y' | 'w' | 'h'>>): boolean {
  const l = locate(layout, attributeId);
  const a = attrs.get(attributeId);
  if (!l || !a) return false;
  const [mw, mh] = minSize(a.type, l.item.shape);
  const r = { ...l.item, ...patch };
  r.w = clamp(r.w, mw, CW);
  r.h = clamp(r.h, mh, USABLE);
  r.x = Math.max(0, r.x);
  r.y = Math.max(0, r.y);
  if (l.item.shape === 'circle') {
    if ('w' in patch && !('h' in patch)) r.h = r.w;
    else r.w = r.h = 'h' in patch ? r.h : r.w;
  }
  if (r.x + r.w > l.sec.w || r.y + r.h > l.sec.h) { if (!growSection(layout, l.sec, r.x + r.w, r.y + r.h)) return false; }
  if (itemCollides(l.sec.items, r, attributeId)) return false;
  Object.assign(l.item, { x: r1(r.x), y: r1(r.y), w: r1(r.w), h: r1(r.h) });
  return true;
}

// Troca o formato do campo. O círculo vira o maior quadrado que cabe na caixa atual (o centro se mantém).
export function setItemShape(layout: SheetLayout, attrs: AttrIndex, attributeId: string, shape: ShapeKey): boolean {
  const l = locate(layout, attributeId);
  const a = attrs.get(attributeId);
  if (!l || !a || !shapeAllowed(a.type, shape)) return false;
  if (shape === 'circle') {
    const [mw] = minSize(a.type, 'circle');
    const s = Math.max(mw, Math.min(l.item.w, l.item.h));
    const nx = Math.max(0, l.item.x + (l.item.w - s) / 2);
    const ny = Math.max(0, l.item.y + (l.item.h - s) / 2);
    const next = { x: r1(nx), y: r1(ny), w: r1(s), h: r1(s) };
    if (next.x + next.w > l.sec.w || next.y + next.h > l.sec.h) { if (!growSection(layout, l.sec, next.x + next.w, next.y + next.h)) return false; }
    if (itemCollides(l.sec.items, next, attributeId)) return false;
    Object.assign(l.item, next);
  }
  l.item.shape = shape;
  return true;
}

// ------------------------------------------------------------------ seções
// O id que a próxima seção criada terá (o editor usa para selecioná-la depois de criar).
export const nextSectionId = (layout: SheetLayout): string => {
  const max = layout.sections.reduce((m, s) => Math.max(m, Number(s.id.replace(/\D/g, '')) || 0), 0);
  return `s${max + 1}`;
};

// Cria uma seção de 90 × 30 mm no primeiro espaço livre perto de `near` (ou no fim, se não houver referência).
export function addSection(layout: SheetLayout, near?: string): LayoutSection {
  const ref = near ? findSection(layout, near) : undefined;
  const w = 90;
  const h = 30;
  const o = BAR + BAR_GAP + h;
  let pg = ref ? ref.page : layout.pages;
  let spot: { x: number; y: number } | null = null;
  const px = ref ? ref.x : 0;
  const py = ref ? ref.y + outerHeight(ref) + SEC_GAP : pageTop(pg);
  for (let p = pg; p <= layout.pages && !spot; p++) {
    spot = freeSpotOnPage(layout, p, w, o, p === pg ? px : 0, p === pg ? py : pageTop(p));
    if (spot) pg = p;
  }
  if (!spot) {
    layout.pages++;
    pg = layout.pages;
    spot = { x: 0, y: pageTop(pg) };
  }
  const s: LayoutSection = { id: nextSectionId(layout), title: 'Nova seção', page: pg, x: spot.x, y: spot.y, w, h, items: [] };
  layout.sections.push(s);
  return s;
}

export function deleteSection(layout: SheetLayout, id: string): void {
  const s = findSection(layout, id);
  if (!s) return;
  s.items.slice().forEach((it) => sendToTray(layout, it.attributeId));
  layout.sections = layout.sections.filter((x) => x.id !== id);
}

// Muda posição, tamanho e/ou página de uma seção. O mínimo vem dos campos (que não saem do lugar); recusa se sobrepuser outra seção.
export function setSectionRect(layout: SheetLayout, id: string, patch: Partial<Pick<LayoutSection, 'x' | 'y' | 'w' | 'h' | 'page'>>): boolean {
  const s = findSection(layout, id);
  if (!s) return false;
  const b = itemsBounds(s.items);
  const page = patch.page ?? s.page;
  const next = { x: patch.x ?? s.x, y: patch.y ?? s.y, w: patch.w ?? s.w, h: patch.h ?? s.h };
  next.w = clamp(next.w, Math.max(MIN_SEC_W, ceil1(b.r)), CW);
  next.h = clamp(next.h, Math.max(MIN_SEC_H, ceil1(b.b)), MAX_BODY_H);
  next.x = clamp(next.x, 0, floor1(CW - next.w));
  next.y = Math.max(pageTop(page), next.y);
  const rect = { x: next.x, y: next.y, w: next.w, h: BAR + BAR_GAP + next.h };
  if (!pageFits(page, rect) || pageCollides(layout, page, rect, id)) return false;
  Object.assign(s, { page, x: r1(next.x), y: r1(next.y), w: r1(next.w), h: r1(next.h) });
  layout.pages = Math.max(layout.pages, page);
  return true;
}

// Passa a seção para outra página, no espaço livre mais perto da posição atual. Falso se a página não tem lugar.
export function moveSectionToPage(layout: SheetLayout, id: string, page: number): boolean {
  const s = findSection(layout, id);
  if (!s) return false;
  const target = Math.min(page, layout.pages + 1);
  const spot = freeSpotOnPage(layout, target, s.w, outerHeight(s), s.x, Math.max(pageTop(target), s.y), id);
  if (!spot) return false;
  s.page = target;
  s.x = spot.x;
  s.y = spot.y;
  layout.pages = Math.max(layout.pages, target);
  return true;
}

// Leva a seção para (x, y) numa página. Se o ponto estiver ocupado ou fora da folha, vai para o espaço livre mais perto; falso se não houver.
// Uma página que ainda não existe (a seguinte à última) é criada.
export function moveSectionTo(layout: SheetLayout, id: string, page: number, x: number, y: number): boolean {
  const s = findSection(layout, id);
  if (!s) return false;
  const o = outerHeight(s);
  const target = Math.min(Math.max(1, page), layout.pages + 1);
  const px = clamp(floor1(x), 0, floor1(CW - s.w));
  const py = Math.max(pageTop(target), floor1(y));
  let spot = { x: px, y: py };
  const rect = { x: px, y: py, w: s.w, h: o };
  if (!pageFits(target, rect) || pageCollides(layout, target, rect, id)) {
    const f = freeSpotOnPage(layout, target, s.w, o, px, py, id);
    if (!f) return false;
    spot = f;
  }
  s.page = target;
  s.x = r1(spot.x);
  s.y = r1(spot.y);
  layout.pages = Math.max(layout.pages, target);
  return true;
}

// Muda a moldura da seção (posição e tamanho do corpo) sem mexer nos campos: eles ficam onde estão na folha, e a posição deles
// dentro da seção é recalculada. Falso se a nova moldura não conter os campos, sair da folha ou bater em outra seção.
export function resizeSectionFrame(layout: SheetLayout, id: string, next: { x: number; y: number; w: number; h: number }): boolean {
  const s = findSection(layout, id);
  if (!s) return false;
  const shx = next.x - s.x;
  const shy = next.y - s.y;
  const items = s.items.map((it) => ({ ...it, x: r1(it.x - shx), y: r1(it.y - shy) }));
  const frame = { x: r1(next.x), y: r1(next.y), w: r1(next.w), h: r1(next.h) };
  if (frame.w < MIN_SEC_W - 0.01 || frame.h < MIN_SEC_H - 0.01 || frame.h > MAX_BODY_H + 0.01) return false;
  const rect = { x: frame.x, y: frame.y, w: frame.w, h: BAR + BAR_GAP + frame.h };
  if (!pageFits(s.page, rect) || pageCollides(layout, s.page, rect, id)) return false;
  if (items.some((it) => it.x < -0.01 || it.y < -0.01 || it.x + it.w > frame.w + 0.01 || it.y + it.h > frame.h + 0.01)) return false;
  Object.assign(s, frame);
  s.items = items;
  return true;
}

// Remove uma página vazia (as seguintes sobem um número). Só se houver mais de uma página.
export function removePage(layout: SheetLayout, page: number): boolean {
  if (layout.pages <= 1 || layout.sections.some((s) => s.page === page)) return false;
  layout.sections.forEach((s) => { if (s.page > page) s.page--; });
  layout.pages--;
  return true;
}

export const addPage = (layout: SheetLayout): void => { layout.pages++; };

// ------------------------------------------------------------------ ímã (usado ao arrastar)
export interface Guide { v: boolean; at: number }

export function snapVal(v: number, targets: number[], tol: number): { d: number; line: number } | null {
  let best: { d: number; line: number } | null = null;
  for (const t of targets) {
    const d = t - v;
    if (Math.abs(d) <= tol && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, line: t };
  }
  return best;
}

// Linhas de alinhamento dentro de uma seção: bordas e centros dos outros campos, bordas da seção e a folga padrão ao lado dos vizinhos.
function itemLines(sec: Pick<LayoutSection, 'w' | 'h' | 'items'>, ignore: string | undefined, near: { x: number; y: number; w: number; h: number } | null) {
  const GAP = 1.8;
  const xs = [0, sec.w / 2, sec.w];
  const ys = [0, sec.h / 2, sec.h];
  const xa: Array<{ left: number; right: number; line: number }> = [];
  const ya: Array<{ top: number; bottom: number; line: number }> = [];
  sec.items.filter((o) => o.attributeId !== ignore).forEach((o) => {
    xs.push(o.x, o.x + o.w / 2, o.x + o.w);
    ys.push(o.y, o.y + o.h / 2, o.y + o.h);
    const sameRow = near && near.y < o.y + o.h + 3 && near.y + near.h > o.y - 3;
    const sameCol = near && near.x < o.x + o.w + 3 && near.x + near.w > o.x - 3;
    if (sameRow) xa.push({ left: o.x + o.w + GAP, right: o.x - GAP, line: o.x + o.w });
    if (sameCol) ya.push({ top: o.y + o.h + GAP, bottom: o.y - GAP, line: o.y + o.h });
  });
  return { xs, ys, xa, ya };
}

// Encaixa um campo que está sendo movido nas linhas próximas (ou na grade de 1 mm).
export function snapItemMove(sec: Pick<LayoutSection, 'w' | 'h' | 'items'>, r: { x: number; y: number; w: number; h: number }, ignore: string | undefined, tol: number): { rect: { x: number; y: number; w: number; h: number }; guides: Guide[] } {
  const L = itemLines(sec, ignore, r);
  const guides: Guide[] = [];
  let bx: { d: number; line: number } | null = null;
  let by: { d: number; line: number } | null = null;
  for (const m of [r.x, r.x + r.w / 2, r.x + r.w]) { const s = snapVal(m, L.xs, tol); if (s && (!bx || Math.abs(s.d) < Math.abs(bx.d))) bx = s; }
  for (const a of L.xa) for (const [m, t] of [[r.x, a.left], [r.x + r.w, a.right]]) { const d = t - m; if (Math.abs(d) <= tol && (!bx || Math.abs(d) < Math.abs(bx.d))) bx = { d, line: a.line }; }
  for (const m of [r.y, r.y + r.h / 2, r.y + r.h]) { const s = snapVal(m, L.ys, tol); if (s && (!by || Math.abs(s.d) < Math.abs(by.d))) by = s; }
  for (const a of L.ya) for (const [m, t] of [[r.y, a.top], [r.y + r.h, a.bottom]]) { const d = t - m; if (Math.abs(d) <= tol && (!by || Math.abs(d) < Math.abs(by.d))) by = { d, line: a.line }; }
  const out = { ...r };
  if (bx) { out.x = r.x + bx.d; guides.push({ v: true, at: bx.line }); } else out.x = Math.round(r.x);
  if (by) { out.y = r.y + by.d; guides.push({ v: false, at: by.line }); } else out.y = Math.round(r.y);
  out.x = r1(out.x);
  out.y = r1(out.y);
  return { rect: out, guides };
}

// Encaixa uma borda de campo que está sendo puxada. edge: 'min' (esquerda ou cima) ou 'max' (direita ou baixo).
export function snapItemEdge(sec: Pick<LayoutSection, 'w' | 'h' | 'items'>, ignore: string | undefined, axis: 'x' | 'y', v: number, edge: 'min' | 'max', tol: number, near: { x: number; y: number; w: number; h: number }): { v: number; line: number | null } {
  const L = itemLines(sec, ignore, near);
  const targets = axis === 'x' ? [...L.xs] : [...L.ys];
  if (axis === 'x') L.xa.forEach((a) => targets.push(edge === 'min' ? a.left : a.right));
  else L.ya.forEach((a) => targets.push(edge === 'min' ? a.top : a.bottom));
  const s = snapVal(v, targets, tol);
  return s ? { v: v + s.d, line: s.line } : { v: Math.round(v), line: null };
}

// Linhas de ímã das seções de uma página: bordas da folha e bordas e centros das outras seções.
export function sectionSnapLines(layout: SheetLayout, page: number, ignoreId?: string): { xs: number[]; ys: number[] } {
  const xs = [0, CW / 2, CW];
  const ys = [pageTop(page), USABLE];
  pageSections(layout, page, ignoreId).forEach((o) => {
    const h = outerHeight(o);
    xs.push(o.x, o.x + o.w / 2, o.x + o.w, o.x + o.w + SEC_GAP, o.x - SEC_GAP);
    ys.push(o.y, o.y + h, o.y + h + SEC_GAP, o.y - SEC_GAP);
  });
  return { xs, ys };
}

export { allowedShapes };
