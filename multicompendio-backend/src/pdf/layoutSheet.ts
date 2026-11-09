import { BAR, BAR_GAP, LayoutItem, LayoutSection, SHAPE_POLYGONS, SheetLayout, ShapeKey, shapeInsets } from '../layoutCore';
import { CharacterValue, CharacterValues } from '../types/character';
import { SystemAttribute } from '../types/system';
import { COLORS, FONT, pt } from './theme';
import { formatNumber, formatValue, putText, sanitize, widthOf, wrapLines } from './text';

type Doc = PDFKit.PDFDocument;

// A ficha desenhada pelo layout (v1.8): cada seção na página e na posição que o layout manda, e cada campo com o formato escolhido.
// As medidas do layout são em milímetros, a partir da margem de 10 mm; o desenho dos campos segue o do editor.

const LABEL = 6.8; // nome do campo (2,4 mm)
const MIN_FIT = 7 / 9.2; // a fonte do valor encolhe até 7 pt antes de o texto ser cortado
const FIT_STEP = 0.04;

interface Env {
  doc: Doc;
  values: CharacterValues;
  blank: boolean;
  overflow: Set<string>;
}

// ------------------------------------------------------------------ formas
function shapePath(doc: Doc, shape: ShapeKey, x: number, y: number, w: number, h: number): void {
  const X = (p: number) => x + (p / 100) * w;
  const Y = (p: number) => y + (p / 100) * h;
  switch (shape) {
    case 'rect': doc.roundedRect(x, y, w, h, pt(0.9)); break;
    case 'rounded': doc.roundedRect(x, y, w, h, Math.min(pt(3), w / 2, h / 2)); break;
    case 'pill': doc.roundedRect(x, y, w, h, Math.min(w, h) / 2); break;
    case 'ellipse':
    case 'circle': doc.ellipse(x + w / 2, y + h / 2, w / 2, h / 2); break;
    case 'shield':
      doc.moveTo(X(2), Y(3)).lineTo(X(98), Y(3)).lineTo(X(98), Y(58)).quadraticCurveTo(X(98), Y(86), X(50), Y(98)).quadraticCurveTo(X(2), Y(86), X(2), Y(58)).closePath();
      break;
    default: {
      const pts = SHAPE_POLYGONS[shape] ?? [];
      doc.polygon(...pts.map(([px, py]): [number, number] => [X(px), Y(py)]));
    }
  }
}

function drawFrame(doc: Doc, shape: ShapeKey, x: number, y: number, w: number, h: number): void {
  shapePath(doc, shape, x, y, w, h);
  doc.lineWidth(0.6).fillAndStroke(COLORS.white, COLORS.line);
}

// ------------------------------------------------------------------ texto
const baseline = (top: number, lineH: number, size: number): number => top + lineH * 0.5 + size * 0.35;

function ellipsize(doc: Doc, line: string, font: string, size: number, width: number): string {
  let t = line;
  while (t.length > 0 && widthOf(doc, t + '…', font, size) > width) t = t.slice(0, -1);
  return t + '…';
}

// Corta as linhas que não cabem, terminando a última com reticências.
function clipLines(doc: Doc, lines: string[], maxLines: number, font: string, size: number, width: number): string[] {
  if (lines.length <= maxLines) return lines;
  const keep = lines.slice(0, Math.max(0, maxLines));
  if (keep.length) keep[keep.length - 1] = ellipsize(doc, keep[keep.length - 1], font, size, width);
  return keep;
}

// Procura a maior escala de fonte (de 1 até o mínimo) em que o conteúdo cabe.
function search<T>(measure: (fit: number) => { ok: boolean; data: T }): { fit: number; ok: boolean; data: T } {
  let fit = 1;
  let m = measure(fit);
  while (!m.ok && fit > MIN_FIT + 1e-6) {
    fit = Math.max(MIN_FIT, fit - FIT_STEP);
    m = measure(fit);
  }
  return { fit, ok: m.ok, data: m.data };
}

// ------------------------------------------------------------------ um campo
function drawField(env: Env, a: SystemAttribute, it: LayoutItem, bx: number, by: number): void {
  const { doc } = env;
  const x = bx + pt(it.x);
  const y = by + pt(it.y);
  const w = pt(it.w);
  const h = pt(it.h);
  drawFrame(doc, it.shape, x, y, w, h);

  // a área em que o conteúdo cabe dentro da forma (as margens internas do formato, como no editor)
  const [il, ir, iT, iB] = shapeInsets(it.shape, it.w, it.h);
  const box = { l: x + pt(1.7 + il), t: y + pt(1.2 + iT), w: pt(it.w - 3.4 - il - ir), h: pt(it.h - 2.4 - iT - iB) };
  const label = sanitize(a.name);
  const raw: CharacterValue | undefined = env.blank ? undefined : env.values[a.id];
  if (box.w <= 1 || box.h <= 1) { env.overflow.add(a.id); return; }
  const labLine = LABEL * 1.2;
  let overflow = false;

  if (a.data_type === 'number') {
    const text = typeof raw === 'number' ? formatNumber(raw) : raw === undefined || raw === null ? '' : formatValue(raw);
    const r = search((fit) => {
      const vSize = 13.9 * fit;
      const vLine = vSize * 1.1;
      const lab = wrapLines(doc, label, FONT.regular, LABEL, box.w);
      const block = vLine + pt(0.4) + lab.length * labLine;
      return { ok: block <= box.h + 0.01 && (!text || widthOf(doc, text, FONT.displaySemi, vSize) <= box.w + 0.01), data: { vSize, vLine, lab, block } };
    });
    overflow = !r.ok;
    const { vSize, vLine, lab, block } = r.data;
    const top = box.t + Math.max(0, (box.h - block) / 2);
    const cx = box.l + box.w / 2;
    if (text) putText(doc, text, cx, baseline(top, vLine, vSize), FONT.displaySemi, vSize, COLORS.ink, 'center');
    const labTop = top + vLine + pt(0.4);
    lab.forEach((l, i) => { if (labTop + (i + 1) * labLine <= y + h + 0.5) putText(doc, l, cx, baseline(labTop + i * labLine, labLine, LABEL), FONT.regular, LABEL, COLORS.muted, 'center'); });
  } else if (a.data_type === 'boolean') {
    const boxS = pt(3.1);
    const gap = pt(2);
    const availW = box.w - boxS - gap;
    const r = search((fit) => {
      const size = 7.94 * fit;
      const lines = availW > 1 ? wrapLines(doc, label, FONT.regular, size, availW) : [label];
      return { ok: availW > 1 && lines.length * size * 1.2 <= box.h + 0.01, data: { size, lines } };
    });
    overflow = !r.ok;
    const { size, lines } = r.data;
    const lh = size * 1.2;
    const cy = box.t + box.h / 2;
    const bxx = box.l;
    const byy = cy - boxS / 2;
    doc.lineWidth(0.8).rect(bxx, byy, boxS, boxS).fillAndStroke(COLORS.white, COLORS.ink);
    if (raw === true) {
      doc.lineWidth(1.1).strokeColor(COLORS.ink);
      doc.moveTo(bxx + 1.6, byy + 1.6).lineTo(bxx + boxS - 1.6, byy + boxS - 1.6).stroke();
      doc.moveTo(bxx + 1.6, byy + boxS - 1.6).lineTo(bxx + boxS - 1.6, byy + 1.6).stroke();
    }
    const fitLines = clipLines(doc, lines, Math.max(1, Math.floor(box.h / lh)), FONT.regular, size, Math.max(1, availW));
    const top = cy - (fitLines.length * lh) / 2;
    fitLines.forEach((l, i) => putText(doc, l, box.l + boxS + gap, baseline(top + i * lh, lh, size), FONT.regular, size, COLORS.ink));
  } else if (a.data_type === 'longtext' || a.data_type === 'text_number') {
    const tn = a.data_type === 'text_number';
    const pair = typeof raw === 'object' && raw !== null ? raw : null;
    const text = tn ? (pair ? sanitize(pair.text) : '') : typeof raw === 'string' ? sanitize(raw) : '';
    const numText = tn && pair && pair.number !== null ? formatNumber(pair.number) : '';
    const miniW = Math.max(pt(8), widthOf(doc, numText, FONT.regular, 8.5) + pt(2.8));
    const miniH = 8.5 * 1.2 + pt(0.6);
    const labelLines = tn ? [label] : wrapLines(doc, label, FONT.regular, LABEL, box.w);
    const headH = tn ? Math.max(labLine, miniH) : labelLines.length * labLine;
    const areaTop = box.t + headH + pt(0.7);
    const areaH = box.h - headH - pt(0.7);
    const padX = pt(1.6);
    const padY = pt(1.1);
    const r = search((fit) => {
      const size = 8.8 * fit;
      const line = size * 1.35;
      const lines = text ? wrapLines(doc, text, FONT.regular, size, box.w - 2 * padX) : [];
      return { ok: areaH > 2 * padY && lines.length * line <= areaH - 2 * padY + 0.01, data: { size, line, lines } };
    });
    overflow = !r.ok;
    const { size, line, lines } = r.data;
    if (tn) {
      const labelText = widthOf(doc, label, FONT.regular, LABEL) > box.w - miniW - pt(1.8) ? ellipsize(doc, label, FONT.regular, LABEL, box.w - miniW - pt(1.8)) : label;
      putText(doc, labelText, box.l, baseline(box.t, headH, LABEL), FONT.regular, LABEL, COLORS.muted);
      const mx = box.l + widthOf(doc, labelText, FONT.regular, LABEL) + pt(1.8);
      doc.lineWidth(0.6).roundedRect(mx, box.t + (headH - miniH) / 2, miniW, miniH, pt(0.9)).fillAndStroke(COLORS.white, COLORS.line);
      if (numText) putText(doc, numText, mx + miniW / 2, baseline(box.t + (headH - miniH) / 2, miniH, 8.5), FONT.regular, 8.5, COLORS.ink, 'center');
    } else {
      labelLines.forEach((l, i) => putText(doc, l, box.l, baseline(box.t + i * labLine, labLine, LABEL), FONT.regular, LABEL, COLORS.muted));
    }
    if (areaH > 2) {
      doc.lineWidth(0.6).roundedRect(box.l, areaTop, box.w, areaH, pt(0.9)).fillAndStroke(COLORS.white, COLORS.line);
      const maxLines = Math.max(0, Math.floor((areaH - 2 * padY + 0.01) / line));
      clipLines(doc, lines, maxLines, FONT.regular, size, box.w - 2 * padX).forEach((l, i) => putText(doc, l, box.l + padX, baseline(areaTop + padY + i * line, line, size), FONT.regular, size, COLORS.ink));
    }
  } else {
    // texto e lista de opções: o nome em cima, o valor embaixo
    const value = raw === undefined || raw === null ? '' : formatValue(raw);
    const r = search((fit) => {
      const vSize = 9.2 * fit;
      const vLine = vSize * 1.25;
      const lab = wrapLines(doc, label, FONT.regular, LABEL, box.w);
      const vals = value ? wrapLines(doc, value, FONT.regular, vSize, box.w) : [''];
      return { ok: lab.length * labLine + vals.length * vLine <= box.h + 0.01, data: { vSize, vLine, lab, vals } };
    });
    overflow = !r.ok;
    const { vSize, vLine, lab, vals } = r.data;
    const block = lab.length * labLine + vals.length * vLine;
    const top = box.t + Math.max(0, (box.h - block) / 2);
    lab.forEach((l, i) => putText(doc, l, box.l, baseline(top + i * labLine, labLine, LABEL), FONT.regular, LABEL, COLORS.muted));
    const vTop = top + lab.length * labLine;
    const maxV = Math.max(1, Math.floor((box.h - (vTop - box.t) + 0.01) / vLine));
    clipLines(doc, vals, maxV, FONT.regular, vSize, box.w).forEach((l, i) => putText(doc, l, box.l, baseline(vTop + i * vLine, vLine, vSize), FONT.regular, vSize, COLORS.ink));
  }
  if (overflow) env.overflow.add(a.id);
}

// ------------------------------------------------------------------ uma seção
function drawSection(env: Env, s: LayoutSection, attrs: Map<string, SystemAttribute>): void {
  const { doc } = env;
  const x = pt(10 + s.x);
  const y = pt(10 + s.y);
  const barH = pt(BAR);
  doc.roundedRect(x, y, pt(s.w), barH, pt(0.8)).fill(COLORS.bar);
  doc.rect(x, y, pt(0.9), barH).fill(COLORS.accent);
  let title = sanitize(s.title);
  const room = pt(s.w) - pt(4) - pt(2);
  if (widthOf(doc, title, FONT.displaySemi, 9.5) > room) title = ellipsize(doc, title, FONT.displaySemi, 9.5, room);
  putText(doc, title, x + pt(3.2), baseline(y, barH, 9.5), FONT.displaySemi, 9.5, COLORS.ink);
  const bx = x;
  const by = y + pt(BAR + BAR_GAP);
  for (const it of s.items) {
    const a = attrs.get(it.attributeId);
    if (a) drawField(env, a, it, bx, by);
  }
}

// Desenha as páginas do layout. A primeira página já existe no documento; as demais são criadas aqui.
// Páginas sem nenhuma seção não saem no PDF (a primeira sempre sai, por causa do cabeçalho).
// Devolve os campos cujo texto não coube nem com a fonte no mínimo (ficaram cortados).
export function drawLayoutPages(doc: Doc, layout: SheetLayout, attrs: SystemAttribute[], values: CharacterValues, opts: { blank: boolean; onFirstPage: () => void }): { overflow: string[]; pages: number } {
  const env: Env = { doc, values, blank: opts.blank, overflow: new Set() };
  const byId = new Map(attrs.map((a) => [a.id, a]));
  let drawn = 0;
  for (let p = 1; p <= layout.pages; p++) {
    const secs = layout.sections.filter((s) => s.page === p);
    if (p !== 1 && secs.length === 0) continue;
    if (drawn > 0) doc.addPage();
    if (drawn === 0) opts.onFirstPage();
    for (const s of secs) drawSection(env, s, byId);
    drawn++;
  }
  return { overflow: [...env.overflow], pages: Math.max(1, drawn) };
}
