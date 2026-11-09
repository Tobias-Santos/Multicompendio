import { BAR, BAR_GAP, CW, LIMITS, MAX_BODY_H, MIN_SEC_H, MIN_SEC_W, USABLE, ceil1, clamp, floor1, outerHeight, pageTop, r1, r2 } from './constants';
import { freeSpotInSection, freeSpotOnPage, itemCollides, itemsBounds, overlap, pageFits, sectionRect } from './geometry';
import { SHAPE_KEYS, minSize, shapeAllowed } from './shapes';
import { LayoutAttribute, LayoutItem, LayoutSection, MemoEntry, SheetLayout, ShapeKey } from './types';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const ID_PATTERN = /^[A-Za-z0-9_-]{1,24}$/;
const TOL = 0.01;

// ------------------------------------------------------------------ 1) ler o que chegou (formato, sem olhar a geometria)
export interface ParseResult {
  layout: SheetLayout | null;
  errors: string[];
}

export function parseLayout(raw: unknown): ParseResult {
  const errors: string[] = [];
  const bad = (m: string) => { if (errors.length < 20) errors.push(m); };
  const num = (v: unknown, label: string): number => {
    if (typeof v !== 'number' || !Number.isFinite(v)) { bad(`${label} precisa ser um número.`); return 0; }
    return r2(v);
  };
  if (!isObj(raw)) return { layout: null, errors: ['O layout precisa ser um objeto.'] };
  const pages = typeof raw.pages === 'number' && Number.isInteger(raw.pages) && raw.pages >= 1 && raw.pages <= LIMITS.pages ? raw.pages : 0;
  if (!pages) bad(`O número de páginas precisa ser um inteiro de 1 a ${LIMITS.pages}.`);
  if (!Array.isArray(raw.sections)) return { layout: null, errors: [...errors, 'Faltou a lista de seções.'] };
  if (raw.sections.length > LIMITS.sections) return { layout: null, errors: [...errors, `Há seções demais (o máximo é ${LIMITS.sections}).`] };

  if (raw.sections.reduce((n: number, s) => n + (isObj(s) && Array.isArray(s.items) ? s.items.length : 0), 0) > LIMITS.totalItems) {
    return { layout: null, errors: [...errors, `Há campos demais no layout (o máximo é ${LIMITS.totalItems}).`] };
  }
  const sections: LayoutSection[] = [];
  const seenIds = new Set<string>();
  raw.sections.forEach((s, i) => {
    const label = `A seção ${i + 1}`;
    if (!isObj(s)) { bad(`${label} está em formato inválido.`); return; }
    const id = typeof s.id === 'string' && ID_PATTERN.test(s.id) ? s.id : '';
    if (!id) bad(`${label} precisa de um identificador de até 24 letras, números, "-" ou "_".`);
    if (id && seenIds.has(id)) bad(`${label} repete o identificador "${id}".`);
    seenIds.add(id);
    const title = typeof s.title === 'string' ? s.title.trim() : '';
    if (!title || title.length > LIMITS.titleLength) bad(`${label} precisa de um nome de 1 a ${LIMITS.titleLength} letras.`);
    const page = typeof s.page === 'number' && Number.isInteger(s.page) && s.page >= 1 ? s.page : 0;
    if (!page) bad(`${label} está numa página inválida.`);
    const items: LayoutItem[] = [];
    if (!Array.isArray(s.items)) bad(`${label} precisa de uma lista de campos.`);
    else if (s.items.length > LIMITS.itemsPerSection) bad(`${label} tem campos demais (o máximo é ${LIMITS.itemsPerSection}).`);
    else {
      s.items.forEach((it, j) => {
        const l2 = `O campo ${j + 1} da seção "${title}"`;
        if (!isObj(it)) { bad(`${l2} está em formato inválido.`); return; }
        const attributeId = typeof it.attributeId === 'string' && it.attributeId.length >= 1 && it.attributeId.length <= LIMITS.idLength ? it.attributeId : '';
        if (!attributeId) bad(`${l2} não tem o identificador do atributo.`);
        const shape = typeof it.shape === 'string' && (SHAPE_KEYS as string[]).includes(it.shape) ? (it.shape as ShapeKey) : null;
        if (!shape) bad(`${l2} tem um formato desconhecido.`);
        items.push({ attributeId, x: num(it.x, `${l2}: a posição X`), y: num(it.y, `${l2}: a posição Y`), w: num(it.w, `${l2}: a largura`), h: num(it.h, `${l2}: a altura`), shape: shape ?? 'rect' });
      });
    }
    sections.push({ id, title, page, x: num(s.x, `${label}: a posição X`), y: num(s.y, `${label}: a posição Y`), w: num(s.w, `${label}: a largura`), h: num(s.h, `${label}: a altura`), items });
  });

  const memo: Record<string, MemoEntry> = {};
  if (raw.memo !== undefined) {
    if (!isObj(raw.memo)) bad('A memória da gaveta está em formato inválido.');
    else {
      for (const [k, v] of Object.entries(raw.memo)) {
        if (k.length > LIMITS.idLength || !isObj(v)) { bad('A memória da gaveta está em formato inválido.'); break; }
        const e: MemoEntry = {};
        if (typeof v.w === 'number' && Number.isFinite(v.w)) e.w = r2(v.w);
        if (typeof v.h === 'number' && Number.isFinite(v.h)) e.h = r2(v.h);
        if (typeof v.shape === 'string' && (SHAPE_KEYS as string[]).includes(v.shape)) e.shape = v.shape as ShapeKey;
        memo[k] = e;
      }
    }
  }
  if (errors.length) return { layout: null, errors };
  return { layout: { pages, sections, memo }, errors };
}

// ------------------------------------------------------------------ 2) acertar com os atributos que existem hoje
// Tira o que aponta para atributo inexistente (apagado depois) ou repetido. O que sobrar de atributos fica "na gaveta".
export function reconcile(layout: SheetLayout, attrs: LayoutAttribute[]): { layout: SheetLayout; dropped: string[] } {
  const ids = new Set(attrs.map((a) => a.id));
  const seen = new Set<string>();
  const dropped: string[] = [];
  const sections = layout.sections.map((s) => ({
    ...s,
    items: s.items.filter((it) => {
      if (!ids.has(it.attributeId) || seen.has(it.attributeId)) { dropped.push(it.attributeId); return false; }
      seen.add(it.attributeId);
      return true;
    }),
  }));
  const memo: Record<string, MemoEntry> = {};
  for (const [k, v] of Object.entries(layout.memo)) if (ids.has(k) && !seen.has(k)) memo[k] = v;
  return { layout: { pages: layout.pages, sections, memo }, dropped };
}

// Os atributos que não estão em nenhuma seção: a "gaveta", na ordem do cadastro.
export function trayOf(layout: SheetLayout, attrs: LayoutAttribute[]): string[] {
  const placed = new Set(layout.sections.flatMap((s) => s.items.map((i) => i.attributeId)));
  return [...attrs].sort((a, b) => a.order - b.order).filter((a) => !placed.has(a.id)).map((a) => a.id);
}

// ------------------------------------------------------------------ 3) conferir a geometria (estrito: quem grava não pode mandar layout inválido)
export function validateLayout(layout: SheetLayout, attrs: LayoutAttribute[]): string[] {
  const byId = new Map(attrs.map((a) => [a.id, a]));
  const problems: string[] = [];
  const add = (m: string) => { if (problems.length < 30) problems.push(m); };
  const seenAttr = new Set<string>();
  layout.sections.forEach((s, si) => {
    const label = `A seção "${s.title}"`;
    if (s.page > layout.pages) add(`${label} está na página ${s.page}, que não existe.`);
    if (s.w < MIN_SEC_W - TOL || s.w > CW + TOL) add(`${label} precisa ter de ${MIN_SEC_W} a ${CW} mm de largura.`);
    if (s.h < MIN_SEC_H - TOL || s.h > MAX_BODY_H + TOL) add(`${label} precisa ter de ${MIN_SEC_H} a ${MAX_BODY_H} mm de altura.`);
    if (!pageFits(s.page, sectionRect(s))) add(`${label} ultrapassa a folha na página ${s.page}.`);
    for (let sj = 0; sj < si; sj++) {
      const t = layout.sections[sj];
      if (t.page === s.page && overlap(sectionRect(s), sectionRect(t))) add(`${label} se sobrepõe à seção "${t.title}".`);
    }
    s.items.forEach((it, ii) => {
      const a = byId.get(it.attributeId);
      if (!a) { add(`${label} tem um campo que não existe mais no sistema.`); return; }
      const l2 = `O campo "${a.name}"`;
      if (seenAttr.has(it.attributeId)) add(`${l2} aparece mais de uma vez.`);
      seenAttr.add(it.attributeId);
      if (!shapeAllowed(a.type, it.shape)) add(`${l2} não aceita o formato escolhido: o texto não caberia.`);
      const [mw, mh] = minSize(a.type, it.shape);
      if (it.w < mw - TOL || it.h < mh - TOL) add(`${l2} é pequeno demais (o mínimo é ${mw} × ${mh} mm).`);
      if (it.shape === 'circle' && Math.abs(it.w - it.h) > TOL) add(`${l2} é um círculo: largura e altura precisam ser iguais.`);
      if (it.x < -TOL || it.y < -TOL || it.x + it.w > s.w + TOL || it.y + it.h > s.h + TOL) add(`${l2} sai da seção "${s.title}".`);
      for (let ij = 0; ij < ii; ij++) {
        const o = s.items[ij];
        if (overlap(it, o)) add(`${l2} se sobrepõe a outro campo na seção "${s.title}".`);
      }
    });
  });
  return problems;
}

// ------------------------------------------------------------------ 4) consertar (para ler um layout salvo que deixou de ser válido, por exemplo quando um atributo mudou de tipo)
export function repairLayout(input: SheetLayout, attrs: LayoutAttribute[]): SheetLayout {
  const byId = new Map(attrs.map((a) => [a.id, a]));
  const seen = new Set<string>();
  const out: SheetLayout = { pages: Math.max(1, Math.min(LIMITS.pages, input.pages || 1)), sections: [], memo: {} };
  for (const [k, m] of Object.entries(input.memo || {})) {
    const a = byId.get(k);
    if (a) out.memo[k] = { w: m.w, h: m.h, shape: m.shape && shapeAllowed(a.type, m.shape) ? m.shape : undefined };
  }

  for (const s of input.sections) {
    const page = clamp(Math.round(s.page) || 1, 1, LIMITS.pages);
    const sec: LayoutSection = { id: s.id, title: s.title, page, x: floor1(Math.max(0, s.x)), y: floor1(Math.max(pageTop(page), s.y)), w: r1(clamp(s.w, MIN_SEC_W, CW)), h: r1(clamp(s.h, MIN_SEC_H, MAX_BODY_H)), items: [] };
    for (const it of s.items) {
      const a = byId.get(it.attributeId);
      if (!a || seen.has(it.attributeId)) continue;
      seen.add(it.attributeId);
      const shape: ShapeKey = shapeAllowed(a.type, it.shape) ? it.shape : 'rect';
      const [mw, mh] = minSize(a.type, shape);
      let w = clamp(it.w, mw, CW);
      let h = clamp(it.h, mh, MAX_BODY_H);
      if (shape === 'circle') { w = Math.max(Math.min(w, h), mw); h = w; }
      sec.items.push({ attributeId: it.attributeId, x: floor1(Math.max(0, it.x)), y: floor1(Math.max(0, it.y)), w: r1(w), h: r1(h), shape });
    }
    // a seção cresce para conter os campos (dentro dos limites da folha)
    const b = itemsBounds(sec.items);
    sec.w = clamp(Math.max(sec.w, ceil1(b.r)), MIN_SEC_W, CW);
    sec.h = clamp(Math.max(sec.h, ceil1(b.b)), MIN_SEC_H, MAX_BODY_H);
    sec.x = clamp(sec.x, 0, floor1(CW - sec.w));
    for (const it of sec.items) { it.x = clamp(it.x, 0, Math.max(0, floor1(sec.w - it.w))); it.y = clamp(it.y, 0, Math.max(0, floor1(sec.h - it.h))); }
    // campos que se sobrepõem vão para o espaço livre mais perto (a seção cresce se precisar); se nem assim couber, saem para a gaveta
    const placed: LayoutItem[] = [];
    for (const it of [...sec.items].sort((p, q) => p.y - q.y || p.x - q.x)) {
      if (itemCollides(placed, it)) {
        const spot = freeSpotInSection({ w: sec.w, h: sec.h, items: placed }, it.w, it.h, it.x, it.y);
        if (spot.needR || spot.needB) {
          const nw = Math.max(sec.w, ceil1(spot.needR)), nh = Math.max(sec.h, ceil1(spot.needB));
          if (nw > CW + TOL || nh > MAX_BODY_H + TOL) continue;
          sec.w = nw; sec.h = nh; sec.x = clamp(sec.x, 0, floor1(CW - sec.w));
        }
        it.x = spot.x; it.y = spot.y;
      }
      placed.push(it);
    }
    // ordem estável (de cima para baixo, da esquerda para a direita): reparar de novo não pode mudar nada
    sec.items = placed.sort((p, q) => p.y - q.y || p.x - q.x || (p.attributeId < q.attributeId ? -1 : 1));
    out.sections.push(sec);
  }

  // seções sobrepostas ou fora da folha vão para o espaço livre mais perto, na mesma página ou nas seguintes
  const done: SheetLayout = { pages: out.pages, sections: [], memo: out.memo };
  for (const s of out.sections) {
    sec_place: {
      const o = outerHeight(s);
      s.y = Math.min(s.y, floor1(USABLE - o));
      s.y = Math.max(s.y, pageTop(s.page));
      const r = { x: s.x, y: s.y, w: s.w, h: o };
      if (pageFits(s.page, r) && !done.sections.some((t) => t.page === s.page && overlap(r, sectionRect(t)))) break sec_place;
      for (let pg = s.page; pg <= done.pages + 1; pg++) {
        const spot = freeSpotOnPage(done, pg, s.w, o, s.x, pg === s.page ? s.y : pageTop(pg));
        if (spot) { s.page = pg; s.x = spot.x; s.y = spot.y; done.pages = Math.max(done.pages, pg); break sec_place; }
      }
      done.pages++;
      s.page = done.pages; s.x = 0; s.y = pageTop(s.page);
    }
    done.sections.push(s);
    done.pages = Math.max(done.pages, s.page);
  }
  void BAR; void BAR_GAP;
  return done;
}
