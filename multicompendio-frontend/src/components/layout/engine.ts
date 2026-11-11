import {
  AttrIndex, BAR, BAR_GAP, CW, DEFAULT_SIZE, Guide, MAX_BODY_H, MIN_SEC_H, MIN_SEC_W, SheetLayout, USABLE, clamp, findSection, itemCollides,
  itemsBounds, locate, minSize, moveSectionTo, outerHeight, pageCollides, pageTop, placeItem, r1, resizeSectionFrame, sectionGrowth,
  sectionSnapLines, sendToTray, setItemRect, setSectionRect, snapItemEdge, snapItemMove, snapVal,
} from '../../layoutCore';
import { Selection, fmt } from './common';
import { EditFnType } from './useLayoutEditor';

// Motor de arrasto do editor: mover campos e seções, puxar as alças de tamanho e as setas do teclado.
// O gesto mexe no DOM (fantasma, caixa de destino, guias, tamanho ao vivo) para ficar fluido e, ao soltar, entrega ao editor UMA edição;
// tudo o que foi alterado à mão é restaurado, e o React redesenha a partir do novo layout.

export interface EngineCtx {
  root: HTMLElement; // o elemento .le (os fantasmas e os rótulos são colocados dentro dele, para valer o CSS do editor)
  layout: SheetLayout;
  attrs: AttrIndex;
  mm: number; // pixels em um milímetro
  editable: boolean;
  edit: EditFnType;
  select: (s: Selection | null) => void;
  openDrawer: (open: boolean) => void;
}

interface Rect { x: number; y: number; w: number; h: number }
type Drop =
  | { kind: 'tray' }
  | { kind: 'newpage' }
  | { kind: 'field'; sec: string; rect: Rect; bad: boolean; grow: boolean; blocked: boolean; guides: Guide[]; body: HTMLElement }
  | { kind: 'sec'; page: number; sheet: HTMLElement; rect: Rect; bad: boolean; guides: Guide[] };

interface Drag {
  kind: 'field' | 'sec';
  id: string;
  sx: number;
  sy: number;
  active: boolean;
  src: HTMLElement;
  ghost: HTMLElement | null;
  drop: Drop | null;
  alt: boolean;
  size: { w: number; h: number };
  gx: number;
  gy: number;
  ox: number;
  oy: number;
}

// O React é dono dos nós de texto das medidas: atualiza o MESMO nó (nodeValue) em vez de trocar o conteúdo (textContent).
// Trocar o conteúdo descarta o nó que o React guarda, e depois ele falha ao atualizá-lo ou removê-lo (tela branca ao abrir a prévia).
function setText(el: HTMLElement, text: string): void {
  const n = el.firstChild;
  if (n && n.nodeType === 3 && el.childNodes.length === 1) n.nodeValue = text;
  else el.textContent = text;
}

const all = (root: HTMLElement, sel: string): HTMLElement[] => Array.from(root.querySelectorAll<HTMLElement>(sel));
const SNAP_PX = 7;

export const failMessage = (note: string): string =>
  note === 'nogrow'
    ? 'A seção não pôde crescer (há outra seção ou o fim da folha logo ao lado) e não há espaço livre nela: o campo voltou ao lugar.'
    : 'Não coube: a seção não tem espaço livre para ele. O campo voltou ao lugar.';

export function createEngine(getCtx: () => EngineCtx) {
  let drag: Drag | null = null;
  let resizeCancel: (() => void) | null = null; // redimensionamento em andamento: Esc ou a perda do ponteiro cancelam e restauram
  let ptr = { x: 0, y: 0 };
  let raf = 0;
  let suppress = false;

  const guardClick = () => { suppress = true; setTimeout(() => { suppress = false; }, 60); };
  const removeVisuals = (root: HTMLElement) => all(root, '.le-dropbox, .le-guide').forEach((n) => n.remove());

  // ------------------------------------------------------------------ entrada
  function onPointerDown(e: PointerEvent): void {
    const c = getCtx();
    if (!c.editable || e.button !== 0) return;
    const t = e.target as HTMLElement;
    const hd = t.closest<HTMLElement>('.le-hd');
    if (hd) {
      if (hd.dataset.sh) startSecResize(e, hd.dataset.h as string, hd.closest<HTMLElement>('.le-sec') as HTMLElement);
      else startResize(e, hd.dataset.h as string, hd.closest<HTMLElement>('.le-card') as HTMLElement);
      return;
    }
    const secEl = t.closest<HTMLElement>('.le-sec');
    if (t.closest('[data-grip="sec"]') && secEl) return startDrag(e, 'sec', secEl.dataset.sec as string, secEl);
    if (t.closest('.le-sec-bar') && !t.closest('button') && e.pointerType === 'mouse' && secEl) return startDrag(e, 'sec', secEl.dataset.sec as string, secEl);
    const card = t.closest<HTMLElement>('.le-card[data-field], .le-dchip[data-field]');
    if (card && !t.closest('button, input, select, textarea')) {
      if (e.pointerType === 'mouse' || t.closest('.le-card-grip, .le-grip')) startDrag(e, 'field', card.dataset.field as string, card);
    }
  }

  // ------------------------------------------------------------------ mover (campo ou seção)
  function startDrag(e: PointerEvent, kind: 'field' | 'sec', id: string, src: HTMLElement): void {
    drag = { kind, id, sx: e.clientX, sy: e.clientY, active: false, src, ghost: null, drop: null, alt: e.altKey, size: { w: 0, h: 0 }, gx: 0, gy: 0, ox: 0, oy: 0 };
    ptr = { x: e.clientX, y: e.clientY };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
    window.addEventListener('pointercancel', cancel, { once: true });
  }

  function activate(): void {
    const c = getCtx();
    const d = drag as Drag;
    d.active = true;
    const r = d.src.getBoundingClientRect();
    if (d.kind === 'field') {
      const l = locate(c.layout, d.id);
      const a = c.attrs.get(d.id);
      const memo = c.layout.memo[d.id] ?? {};
      const def = a ? DEFAULT_SIZE[a.type] : [28, 16];
      d.size = l ? { w: l.item.w, h: l.item.h } : { w: memo.w ?? def[0], h: memo.h ?? def[1] };
      d.gx = l ? (d.sx - r.left) / c.mm : d.size.w / 2;
      d.gy = l ? (d.sy - r.top) / c.mm : d.size.h / 2;
      d.ox = l ? d.sx - r.left : (d.size.w * c.mm) / 2;
      d.oy = l ? d.sy - r.top : (d.size.h * c.mm) / 2;
    } else {
      const s = findSection(c.layout, d.id) as { w: number; h: number };
      d.gx = (d.sx - r.left) / c.mm;
      d.gy = (d.sy - r.top) / c.mm;
      d.size = { w: s.w, h: outerHeight(s) };
      d.ox = 20;
      d.oy = 14;
    }
    let g: HTMLElement;
    if (d.kind === 'sec') {
      g = document.createElement('div');
      g.className = 'le-ghost le-sec-ghost';
      g.textContent = (findSection(c.layout, d.id) as { title: string }).title;
    } else if (d.src.classList.contains('le-dchip')) {
      g = d.src.cloneNode(true) as HTMLElement;
      g.classList.add('le-ghost');
      g.style.width = `${r.width}px`;
    } else {
      g = d.src.cloneNode(true) as HTMLElement;
      g.querySelectorAll('.le-hd, .le-dim, .le-card-grip').forEach((n) => n.remove());
      g.classList.remove('is-sel', 'is-drag');
      g.classList.add('le-ghost');
      g.removeAttribute('data-field');
      g.style.cssText += `;--mm:${c.mm}px;width:${r.width}px;height:${r.height}px`;
    }
    c.root.appendChild(g);
    d.ghost = g;
    d.src.classList.add('is-drag');
    c.root.classList.add('dragging');
    raf = requestAnimationFrame(loop);
  }

  function onMove(e: PointerEvent): void {
    ptr = { x: e.clientX, y: e.clientY };
    if (!drag) return;
    drag.alt = e.altKey;
    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
      activate();
    }
    e.preventDefault();
    place();
  }

  function place(): void {
    const d = drag;
    if (!d || !d.active || !d.ghost) return;
    const c = getCtx();
    d.ghost.style.left = `${ptr.x - d.ox}px`;
    d.ghost.style.top = `${ptr.y - d.oy}px`;
    d.drop = d.kind === 'sec' ? secDropAt(c, d, ptr.x, ptr.y) : fieldDropAt(c, d, ptr.x, ptr.y);
    all(c.root, '.is-drop').forEach((n) => n.classList.remove('is-drop'));
    removeVisuals(c.root);
    const drop = d.drop;
    if (!drop) return;
    if (drop.kind === 'tray') { c.root.querySelector('.le-drawer')?.classList.add('is-drop'); return; }
    if (drop.kind === 'newpage') { c.root.querySelector('.le-add-page')?.classList.add('is-drop'); return; }
    if (drop.kind === 'sec') {
      drop.sheet.classList.add('is-drop');
      const bx = document.createElement('div');
      bx.className = `le-dropbox${drop.bad ? ' bad' : ''}`;
      bx.style.cssText = `left:${(10 + drop.rect.x) * c.mm}px;top:${(10 + drop.rect.y) * c.mm}px;width:${drop.rect.w * c.mm}px;height:${drop.rect.h * c.mm}px`;
      bx.innerHTML = `<span>página ${drop.page} · x ${fmt(drop.rect.x)} · y ${fmt(drop.rect.y)} mm${drop.bad ? ' · ocupado: vai para o espaço livre mais perto' : ''}</span>`;
      drop.sheet.appendChild(bx);
      drop.guides.forEach((g) => {
        const el = document.createElement('div');
        el.className = `le-guide ${g.v ? 'v' : 'h'}`;
        el.style[g.v ? 'left' : 'top'] = `${(10 + g.at) * c.mm}px`;
        drop.sheet.appendChild(el);
      });
      return;
    }
    drop.body.closest('.le-sec')?.classList.add('is-drop');
    const bx = document.createElement('div');
    bx.className = `le-dropbox${drop.bad ? ' bad' : ''}`;
    bx.style.cssText = `left:${drop.rect.x * c.mm}px;top:${drop.rect.y * c.mm}px;width:${drop.rect.w * c.mm}px;height:${drop.rect.h * c.mm}px`;
    const note = drop.blocked ? ' · a seção não pode crescer aqui (há outra seção ou o fim da folha)' : drop.bad ? ' · ocupado: vai para o espaço livre mais perto' : drop.grow ? ' · a seção cresce' : '';
    bx.innerHTML = `<span>x ${fmt(drop.rect.x)} · y ${fmt(drop.rect.y)} mm${note}</span>`;
    drop.body.appendChild(bx);
    drop.guides.forEach((g) => {
      const el = document.createElement('div');
      el.className = `le-guide ${g.v ? 'v' : 'h'}`;
      el.style[g.v ? 'left' : 'top'] = `${g.at * c.mm}px`;
      drop.body.appendChild(el);
    });
  }

  function loop(): void {
    if (!drag || !drag.active) return;
    const h = window.innerHeight;
    if (ptr.y < 80) window.scrollBy(0, -Math.ceil((80 - ptr.y) / 5));
    else if (ptr.y > h - 80) window.scrollBy(0, Math.ceil((ptr.y - (h - 80)) / 5));
    place();
    raf = requestAnimationFrame(loop);
  }

  // A seção que recebe o campo: a mais perto do canto superior esquerdo dele (até 15 mm de distância).
  function pickSection(c: EngineCtx, tl: { x: number; y: number }): { id: string; el: HTMLElement; r: DOMRect } | null {
    let best: { id: string; el: HTMLElement; r: DOMRect; d: number } | null = null;
    all(c.root, '.le-sec-body').forEach((b) => {
      const r = b.getBoundingClientRect();
      const dx = tl.x < r.left ? r.left - tl.x : tl.x > r.right ? tl.x - r.right : 0;
      const dy = tl.y < r.top ? r.top - tl.y : tl.y > r.bottom ? tl.y - r.bottom : 0;
      const dist = Math.hypot(dx, dy);
      if (!best || dist < best.d) best = { id: b.dataset.body as string, el: b, r, d: dist };
    });
    const found = best as { id: string; el: HTMLElement; r: DOMRect; d: number } | null;
    return found && found.d <= 15 * c.mm ? found : null;
  }

  function fieldDropAt(c: EngineCtx, d: Drag, x: number, y: number): Drop | null {
    const under = document.elementFromPoint(x, y);
    if (under && under.closest('.le-drawer, .le-drawerbtn')) return { kind: 'tray' };
    const t = pickSection(c, { x: x - d.gx * c.mm, y: y - d.gy * c.mm });
    if (!t) return null;
    const sec = findSection(c.layout, t.id);
    if (!sec) return null;
    const { w, h } = d.size;
    let rx = Math.max(0, (x - t.r.left) / c.mm - d.gx);
    let ry = Math.max(0, (y - t.r.top) / c.mm - d.gy);
    rx = Math.min(rx, Math.max(0, CW - w));
    ry = Math.min(ry, Math.max(0, USABLE - h));
    let rect: Rect = { x: rx, y: ry, w, h };
    let guides: Guide[] = [];
    if (!d.alt) {
      const sn = snapItemMove(sec, rect, d.id, SNAP_PX / c.mm);
      rect = sn.rect;
      guides = sn.guides;
    } else rect = { x: r1(rx), y: r1(ry), w, h };
    rect.x = Math.max(0, rect.x);
    rect.y = Math.max(0, rect.y);
    const grow = rect.y + h > sec.h + 0.01 || rect.x + w > sec.w + 0.01;
    const blocked = grow && !sectionGrowth(c.layout, sec, rect.x + w, rect.y + h);
    return { kind: 'field', sec: t.id, rect, bad: itemCollides(sec.items, rect, d.id) || blocked, grow, blocked, guides, body: t.el };
  }

  function secDropAt(c: EngineCtx, d: Drag, x: number, y: number): Drop | null {
    const under = document.elementFromPoint(x, y);
    if (under && under.closest('.le-add-page')) return { kind: 'newpage' };
    const sheets = all(c.root, '.le-sheet');
    if (!sheets.length) return null;
    let b = { s: sheets[0], r: sheets[0].getBoundingClientRect(), d: Infinity };
    for (const s of sheets) {
      const r = s.getBoundingClientRect();
      const dist = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
      if (dist < b.d) b = { s, r, d: dist };
    }
    const page = Number(b.s.dataset.page);
    const sec = findSection(c.layout, d.id);
    if (!sec) return null;
    const o = outerHeight(sec);
    const ox = b.r.left + 10 * c.mm;
    const oy = b.r.top + 10 * c.mm;
    const rect: Rect = { x: clamp((x - ox) / c.mm - d.gx, 0, CW - sec.w), y: clamp((y - oy) / c.mm - d.gy, pageTop(page), USABLE - o), w: sec.w, h: o };
    const guides: Guide[] = [];
    if (!d.alt) {
      const L = sectionSnapLines(c.layout, page, d.id);
      const tol = SNAP_PX / c.mm;
      let bx: { d: number; line: number } | null = null;
      let by: { d: number; line: number } | null = null;
      for (const m of [rect.x, rect.x + rect.w / 2, rect.x + rect.w]) { const s = snapVal(m, L.xs, tol); if (s && (!bx || Math.abs(s.d) < Math.abs(bx.d))) bx = s; }
      for (const m of [rect.y, rect.y + rect.h]) { const s = snapVal(m, L.ys, tol); if (s && (!by || Math.abs(s.d) < Math.abs(by.d))) by = s; }
      if (bx) { rect.x = r1(rect.x + bx.d); guides.push({ v: true, at: bx.line }); } else rect.x = Math.round(rect.x);
      if (by) { rect.y = r1(rect.y + by.d); guides.push({ v: false, at: by.line }); } else rect.y = Math.round(rect.y);
    } else { rect.x = r1(rect.x); rect.y = r1(rect.y); }
    rect.x = clamp(rect.x, 0, CW - sec.w);
    rect.y = clamp(rect.y, pageTop(page), USABLE - o);
    return { kind: 'sec', page, sheet: b.s, rect, guides, bad: pageCollides(c.layout, page, rect, d.id) };
  }

  function finishDrag(): void {
    const c = getCtx();
    cancelAnimationFrame(raf);
    window.removeEventListener('pointermove', onMove);
    if (drag?.ghost) drag.ghost.remove();
    if (drag?.src) drag.src.classList.remove('is-drag');
    c.root.classList.remove('dragging');
    removeVisuals(c.root);
    all(c.root, '.is-drop').forEach((n) => n.classList.remove('is-drop'));
  }

  function cancel(): void {
    finishDrag();
    drag = null;
  }

  function onUp(): void {
    const d = drag;
    const c = getCtx();
    const dropped = d && d.active ? d.drop : null;
    finishDrag();
    drag = null;
    if (!d || !d.active) return;
    guardClick();
    if (!dropped) return;
    if (d.kind === 'sec') {
      if (dropped.kind === 'newpage') {
        c.edit('Seção movida para uma página nova', (draft) => moveSectionTo(draft, d.id, draft.pages + 1, 0, 0), { select: { kind: 'sec', id: d.id }, fail: 'Não foi possível criar a página.' });
      } else if (dropped.kind === 'sec') {
        c.edit(`Seção na página ${dropped.page}, posição ${fmt(dropped.rect.x)}, ${fmt(dropped.rect.y)}`, (draft) => moveSectionTo(draft, d.id, dropped.page, dropped.rect.x, dropped.rect.y), {
          select: { kind: 'sec', id: d.id }, fail: 'Não há espaço livre nessa página para a seção.',
        });
      }
      return;
    }
    const name = c.attrs.get(d.id)?.name ?? 'Campo';
    if (dropped.kind === 'tray') {
      c.edit(`${name} foi para a gaveta`, (draft) => { sendToTray(draft, d.id); }, { select: { kind: 'field', id: d.id }, toast: true, undoable: true });
      c.openDrawer(false);
      return;
    }
    if (dropped.kind !== 'field') return;
    c.edit(`${name} movido para ${fmt(dropped.rect.x)}, ${fmt(dropped.rect.y)} mm`, (draft) => {
      const r = placeItem(draft, c.attrs, d.id, dropped.sec, dropped.rect.x, dropped.rect.y, d.size);
      if (!r.ok) return { fail: failMessage(r.note) };
      return r.note === 'nogrow' ? { notice: 'A seção não pôde crescer: há outra seção ou o fim da folha logo ao lado. O campo ficou dentro dela. Mova ou reduza a vizinha.' } : true;
    }, { select: { kind: 'field', id: d.id } });
  }

  // ------------------------------------------------------------------ redimensionar um campo pelas 8 alças
  function startResize(e: PointerEvent, dir: string, card: HTMLElement): void {
    e.preventDefault();
    e.stopPropagation();
    const c = getCtx();
    const id = card.dataset.field as string;
    const l = locate(c.layout, id);
    const a = c.attrs.get(id);
    if (!l || !a) return;
    const sec = l.sec;
    const circle = l.item.shape === 'circle';
    const [mw, mh] = minSize(a.type, l.item.shape);
    const start: Rect = { x: l.item.x, y: l.item.y, w: l.item.w, h: l.item.h };
    const origW = sec.w;
    const origH = sec.h;
    const sx = e.clientX;
    const sy = e.clientY;
    let cur: Rect = { ...start };
    let grow = { w: origW, h: origH };
    const secEl = card.closest<HTMLElement>('.le-sec') as HTMLElement;
    const bodyEl = card.parentElement as HTMLElement;
    const dim = card.querySelector<HTMLElement>('.le-dim');
    const saved = { card: card.getAttribute('style'), sec: secEl.getAttribute('style'), body: bodyEl.getAttribute('style'), dim: dim?.textContent ?? '' };
    c.select({ kind: 'field', id });
    const paint = (guides: Guide[]) => {
      card.style.left = `calc(${cur.x} * var(--mm))`;
      card.style.top = `calc(${cur.y} * var(--mm))`;
      card.style.width = `calc(${cur.w} * var(--mm))`;
      card.style.height = `calc(${cur.h} * var(--mm))`;
      if (dim) setText(dim, `${fmt(cur.w)} × ${fmt(cur.h)} mm`);
      bodyEl.style.setProperty('--h', String(grow.h));
      secEl.style.setProperty('--sw', String(grow.w));
      all(bodyEl, '.le-guide').forEach((n) => n.remove());
      guides.forEach((g) => {
        const el = document.createElement('div');
        el.className = `le-guide ${g.v ? 'v' : 'h'}`;
        el.style[g.v ? 'left' : 'top'] = `${g.at * c.mm}px`;
        bodyEl.appendChild(el);
      });
    };
    const move = (ev: PointerEvent) => {
      const alt = ev.altKey;
      const dx = (ev.clientX - sx) / c.mm;
      const dy = (ev.clientY - sy) / c.mm;
      const tol = SNAP_PX / c.mm;
      let x = start.x, y = start.y, w = start.w, h = start.h;
      const guides: Guide[] = [];
      if (dir.includes('e')) w = start.w + dx;
      if (dir.includes('s')) h = start.h + dy;
      if (dir.includes('w')) { x = start.x + dx; w = start.w - dx; }
      if (dir.includes('n')) { y = start.y + dy; h = start.h - dy; }
      const snap = (axis: 'x' | 'y', v: number, edge: 'min' | 'max'): number => {
        if (alt) return Math.round(v * 2) / 2;
        const s = snapItemEdge(sec, id, axis, v, edge, tol, { x, y, w, h });
        if (s.line !== null) guides.push({ v: axis === 'x', at: s.line });
        return s.v;
      };
      if (dir.includes('e')) w = snap('x', x + w, 'max') - x;
      if (dir.includes('w')) { const left = snap('x', x, 'min'); w += x - left; x = left; }
      if (dir.includes('s')) h = snap('y', y + h, 'max') - y;
      if (dir.includes('n')) { const top = snap('y', y, 'min'); h += y - top; y = top; }
      let circleVars: Rect[] | null = null;
      if (circle) { // o círculo mantém largura = altura; quem manda é a alça puxada
        const drvW = dir === 'e' || dir === 'w' || (dir.length === 2 && Math.abs(dx) >= Math.abs(dy));
        const s = Math.max(mw, drvW ? w : h);
        const right = start.x + start.w;
        const bottom = start.y + start.h;
        x = dir.includes('w') ? right - s : start.x;
        y = dir.includes('n') ? bottom - s : start.y;
        w = s; h = s;
        if (dir === 'e' || dir === 'w') circleVars = [start.y + (start.h - s) / 2, start.y, bottom - s].map((yy) => ({ x, y: Math.max(0, yy), w: s, h: s }));
        else if (dir === 'n' || dir === 's') circleVars = [start.x + (start.w - s) / 2, start.x, right - s].map((xx) => ({ x: Math.max(0, xx), y, w: s, h: s }));
        if (circleVars) { x = circleVars[0].x; y = circleVars[0].y; }
      }
      if (w < mw) { if (dir.includes('w')) x -= mw - w; w = mw; }
      if (h < mh) { if (dir.includes('n')) y -= mh - h; h = mh; }
      if (x < 0) { w += x; x = 0; if (circle) h = w; }
      if (y < 0) { h += y; y = 0; if (circle) w = h; }
      w = Math.max(mw, w);
      const cand: Rect = { x: r1(x), y: r1(y), w: r1(w), h: r1(h) };
      // cada eixo é resolvido separadamente (nos círculos os dois andam juntos): ao esbarrar, o que ainda está livre continua
      const okRect = (r: Rect): boolean => !itemCollides(sec.items, r, id) && (r.x + r.w <= origW + 0.01 && r.y + r.h <= origH + 0.01 ? true : !!sectionGrowth(c.layout, sec, r.x + r.w, r.y + r.h));
      let next = { ...cur };
      if (circle) {
        const opts = (circleVars ?? [cand]).map((v) => ({ x: r1(v.x), y: r1(v.y), w: r1(v.w), h: r1(v.h) }));
        const pick = opts.find(okRect);
        if (pick) next = pick;
      } else {
        const tryX = { ...next, x: cand.x, w: cand.w };
        if (okRect(tryX)) next = tryX;
        const tryY = { ...next, y: cand.y, h: cand.h };
        if (okRect(tryY)) next = tryY;
      }
      cur = next;
      const g = sectionGrowth(c.layout, sec, cur.x + cur.w, cur.y + cur.h) ?? { w: origW, h: origH };
      grow = { w: Math.max(origW, g.w), h: Math.max(origH, g.h) };
      paint(guides);
    };
    let cancelled = false;
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', abort);
      resizeCancel = null;
      guardClick();
      card.setAttribute('style', saved.card ?? '');
      secEl.setAttribute('style', saved.sec ?? '');
      bodyEl.setAttribute('style', saved.body ?? '');
      if (dim) setText(dim, saved.dim);
      all(bodyEl, '.le-guide').forEach((n) => n.remove());
      const changed = !cancelled && (cur.x !== start.x || cur.y !== start.y || cur.w !== start.w || cur.h !== start.h);
      if (changed) c.edit(`${a.name}: ${fmt(cur.w)} por ${fmt(cur.h)} mm`, (draft) => setItemRect(draft, c.attrs, id, cur), { select: { kind: 'field', id }, fail: 'Esse tamanho deixaria o campo sobre outro campo ou além do que a seção pode crescer.' });
    };
    const abort = () => { cancelled = true; up(); };
    resizeCancel = abort;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    window.addEventListener('pointercancel', abort, { once: true });
  }

  // ------------------------------------------------------------------ redimensionar uma seção pelas 8 alças
  // O mínimo vem dos campos; o máximo, da folha e das seções vizinhas. Ao puxar a borda de cima ou da esquerda, a moldura se move
  // e os campos ficam onde estão na folha.
  function startSecResize(e: PointerEvent, dir: string, secEl: HTMLElement): void {
    e.preventDefault();
    e.stopPropagation();
    const c = getCtx();
    const id = secEl.dataset.sec as string;
    const sec = findSection(c.layout, id);
    if (!sec) return;
    const pg = sec.page;
    c.select({ kind: 'sec', id });
    const start: Rect = { x: sec.x, y: sec.y, w: sec.w, h: sec.h };
    const sx = e.clientX;
    const sy = e.clientY;
    const b = itemsBounds(sec.items);
    const bodyEl = secEl.querySelector<HTMLElement>('.le-sec-body') as HTMLElement;
    const dimEl = secEl.querySelector<HTMLElement>('.le-sdim');
    const metaEl = secEl.querySelector<HTMLElement>('.le-sec-meta');
    const cardEls = all(bodyEl, '.le-card');
    const saved = { sec: secEl.getAttribute('style'), body: bodyEl.getAttribute('style'), cards: cardEls.map((el) => el.getAttribute('style')), dim: dimEl?.textContent ?? '', meta: metaEl?.textContent ?? '' };
    let cur: Rect = { ...start };
    const paint = () => {
      secEl.style.setProperty('--sx', String(cur.x));
      secEl.style.setProperty('--sy', String(cur.y));
      secEl.style.setProperty('--sw', String(cur.w));
      bodyEl.style.setProperty('--h', String(cur.h));
      const shx = cur.x - start.x;
      const shy = cur.y - start.y;
      cardEls.forEach((el) => {
        const it = sec.items.find((q) => q.attributeId === el.dataset.field);
        if (!it) return;
        el.style.left = `calc(${r1(it.x - shx)} * var(--mm))`;
        el.style.top = `calc(${r1(it.y - shy)} * var(--mm))`;
      });
      if (dimEl) setText(dimEl, `${fmt(cur.w)} × ${fmt(BAR + BAR_GAP + cur.h)} mm`);
      if (metaEl) setText(metaEl, `${sec.items.length} ${sec.items.length === 1 ? 'campo' : 'campos'} · ${fmt(cur.w)} × ${fmt(cur.h)} mm`);
    };
    const move = (ev: PointerEvent) => {
      const alt = ev.altKey;
      const tol = SNAP_PX / c.mm;
      const dx = (ev.clientX - sx) / c.mm;
      const dy = (ev.clientY - sy) / c.mm;
      let left = start.x, right = start.x + start.w, top = start.y, bottom = start.y + BAR + BAR_GAP + start.h;
      if (dir.includes('e')) right += dx;
      if (dir.includes('w')) left += dx;
      if (dir.includes('s')) bottom += dy;
      if (dir.includes('n')) top += dy;
      if (!alt) {
        const L = sectionSnapLines(c.layout, pg, id);
        const sn = (v: number, arr: number[]) => { const s = snapVal(v, arr, tol); return s ? v + s.d : Math.round(v); };
        if (dir.includes('e')) right = sn(right, L.xs);
        if (dir.includes('w')) left = sn(left, L.xs);
        if (dir.includes('s')) bottom = sn(bottom, L.ys);
        if (dir.includes('n')) top = sn(top, L.ys);
      }
      // o mínimo são os campos (que não saem do lugar na folha); o máximo, a folha
      const fl = start.x + b.l;
      const fr = start.x + b.r;
      const ft = start.y + BAR + BAR_GAP + b.t;
      const fb = start.y + BAR + BAR_GAP + b.b;
      if (b.any) { left = Math.min(left, fl); right = Math.max(right, fr); top = Math.min(top, ft - BAR - BAR_GAP); bottom = Math.max(bottom, fb); }
      if (right - left < MIN_SEC_W) { if (dir.includes('w')) left = right - MIN_SEC_W; else right = left + MIN_SEC_W; }
      if (bottom - top < BAR + BAR_GAP + MIN_SEC_H) { if (dir.includes('n')) top = bottom - (BAR + BAR_GAP + MIN_SEC_H); else bottom = top + BAR + BAR_GAP + MIN_SEC_H; }
      left = Math.max(0, left);
      right = Math.min(CW, right);
      top = Math.max(pageTop(pg), top);
      bottom = Math.min(USABLE, bottom);
      const cand: Rect = { x: r1(left), y: r1(top), w: r1(right - left), h: Math.min(MAX_BODY_H, r1(bottom - top - BAR - BAR_GAP)) };
      const free = (r: Rect) => !pageCollides(c.layout, pg, { x: r.x, y: r.y, w: r.w, h: BAR + BAR_GAP + r.h }, id);
      let next = { ...cur }; // cada eixo é resolvido separadamente: esbarrar numa vizinha trava só aquele eixo
      const tryX = { ...next, x: cand.x, w: cand.w };
      if (free(tryX)) next = tryX;
      const tryY = { ...next, y: cand.y, h: cand.h };
      if (free(tryY)) next = tryY;
      cur = next;
      paint();
    };
    let cancelled = false;
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', abort);
      resizeCancel = null;
      guardClick();
      secEl.setAttribute('style', saved.sec ?? '');
      bodyEl.setAttribute('style', saved.body ?? '');
      cardEls.forEach((el, i) => el.setAttribute('style', saved.cards[i] ?? ''));
      if (dimEl) setText(dimEl, saved.dim);
      if (metaEl) setText(metaEl, saved.meta);
      const changed = !cancelled && (cur.x !== start.x || cur.y !== start.y || cur.w !== start.w || cur.h !== start.h);
      if (changed) c.edit(`Seção “${sec.title}”: ${fmt(cur.w)} × ${fmt(cur.h)} mm`, (draft) => resizeSectionFrame(draft, id, cur), { select: { kind: 'sec', id }, fail: 'Esse tamanho não cabe: deixaria a seção sem espaço para os campos, sobre outra seção ou fora da folha.' });
    };
    const abort = () => { cancelled = true; up(); };
    resizeCancel = abort;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    window.addEventListener('pointercancel', abort, { once: true });
  }

  return {
    onPointerDown,
    consumeClickGuard: (): boolean => suppress,
    cancel: () => { if (drag) cancel(); resizeCancel?.(); },
    isDragging: (): boolean => !!drag?.active || resizeCancel !== null,
  };
}

// ------------------------------------------------------------------ teclado
// Setas movem 1 mm (Shift: 5 mm); Alt + setas mudam o tamanho; Delete guarda o campo na gaveta. Devolve true se tratou a tecla.
export function handleKey(e: KeyboardEvent, c: EngineCtx): boolean {
  if (!c.editable) return false;
  const t = e.target as HTMLElement;
  if (t.matches('input, textarea, select')) return false;
  const dirs: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  const dir = dirs[e.key];
  const k = e.shiftKey ? 5 : 1;
  const card = t.closest<HTMLElement>('.le-card[data-field]');
  if (card) {
    const id = card.dataset.field as string;
    const l = locate(c.layout, id);
    const a = c.attrs.get(id);
    if (!l || !a) return false;
    if (e.key === 'Enter' || e.key === ' ') { c.select({ kind: 'field', id }); return true; }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      c.edit(`${a.name} foi para a gaveta`, (d) => { sendToTray(d, id); }, { select: { kind: 'field', id }, toast: true, undoable: true });
      return true;
    }
    if (!dir) return false;
    // só o eixo mexido: no círculo, largura e altura andam juntas, e mandar as duas anularia a mudança
    const patch = e.altKey ? (dir[0] !== 0 ? { w: l.item.w + dir[0] * k } : { h: l.item.h + dir[1] * k }) : { x: l.item.x + dir[0] * k, y: l.item.y + dir[1] * k };
    c.edit(`${a.name} ajustado`, (d) => setItemRect(d, c.attrs, id, patch), { coalesce: `f:${id}`, select: { kind: 'field', id }, fail: 'Não dá: ficaria sobre outro campo ou fora da seção.' });
    return true;
  }
  const bar = t.closest<HTMLElement>('.le-sec-bar');
  if (bar) {
    const secEl = bar.closest<HTMLElement>('.le-sec') as HTMLElement;
    const id = secEl.dataset.sec as string;
    const s = findSection(c.layout, id);
    if (!s) return false;
    if (e.key === 'Enter' || e.key === ' ') { c.select({ kind: 'sec', id }); return true; }
    if (!dir) return false;
    c.edit(`Seção “${s.title}” ajustada`, (d) => {
      const f = findSection(d, id);
      if (!f) return false;
      return setSectionRect(d, id, e.altKey ? { w: f.w + dir[0] * k, h: f.h + dir[1] * k } : { x: f.x + dir[0] * k, y: f.y + dir[1] * k });
    }, { coalesce: `s:${id}`, select: { kind: 'sec', id }, fail: 'Não dá: ficaria sobre outra seção ou fora da folha.' });
    return true;
  }
  return false;
}
