import { COLORS, FONT, GAP, MARGIN, BOTTOM } from './theme';
import { putText, wrapLines } from './text';

type Doc = PDFKit.PDFDocument;

// ------------------------------------------------------------------ fluxo da página
// Guarda onde a próxima coisa será desenhada e passa para a página seguinte quando não cabe.
export class Flow {
  y = MARGIN;
  constructor(public doc: Doc, public contentW: number) {}

  get maxY(): number {
    return this.doc.page.height - BOTTOM;
  }
  get left(): number {
    return MARGIN;
  }
  newPage(): void {
    this.doc.addPage();
    this.y = MARGIN;
  }
  // Garante `h` pontos livres; senão começa uma página nova (sem repetir se já está no topo).
  ensure(h: number): void {
    if (this.y + h > this.maxY + 0.01 && this.y > MARGIN + 0.01) this.newPage();
  }
}

// ------------------------------------------------------------------ caixas de campo
export interface Cell {
  measure(doc: Doc, w: number): number;
  draw(doc: Doc, x: number, y: number, w: number, h: number): void;
}

function frame(doc: Doc, x: number, y: number, w: number, h: number): void {
  doc.lineWidth(0.6).roundedRect(x, y, w, h, 3).fillAndStroke(COLORS.white, COLORS.line);
}

// Texto, lista de opções e número solto: o nome em cima, o valor embaixo.
export class ShortCell implements Cell {
  private label: string[] = [];
  private value: string[] = [];
  constructor(private name: string, private text: string, private minH = 28) {}
  measure(doc: Doc, w: number): number {
    this.label = wrapLines(doc, this.name, FONT.regular, 6.8, w - 12).slice(0, 2);
    this.value = this.text ? wrapLines(doc, this.text, FONT.regular, 9.2, w - 12).slice(0, 3) : [];
    return Math.max(this.minH, 5 + 8 * this.label.length + 3 + 11.5 * Math.max(1, this.value.length) + 4);
  }
  draw(doc: Doc, x: number, y: number, w: number, h: number): void {
    frame(doc, x, y, w, h);
    let base = y + 5 + 6.2;
    for (const line of this.label) {
      putText(doc, line, x + 6, base, FONT.regular, 6.8, COLORS.muted);
      base += 8;
    }
    base += 3.5;
    for (const line of this.value) {
      putText(doc, line, x + 6, base, FONT.regular, 9.2, COLORS.ink);
      base += 11.5;
    }
  }
}

// Número em destaque, com o nome embaixo (vários números seguidos viram uma grade).
export class NumCell implements Cell {
  private label: string[] = [];
  constructor(private name: string, private text: string) {}
  measure(doc: Doc, w: number): number {
    this.label = wrapLines(doc, this.name, FONT.regular, 6.4, w - 8).slice(0, 3);
    return 6 + 15 + 3 + 7.6 * this.label.length + 5;
  }
  draw(doc: Doc, x: number, y: number, w: number, h: number): void {
    frame(doc, x, y, w, h);
    putText(doc, this.text, x + w / 2, y + 18, FONT.displaySemi, 14, COLORS.ink, 'center');
    let base = y + 6 + 15 + 3 + 5.6;
    for (const line of this.label) {
      putText(doc, line, x + w / 2, base, FONT.regular, 6.4, COLORS.muted, 'center');
      base += 7.6;
    }
  }
}

// Verdadeiro ou falso: uma caixinha (marcada ou vazia) e o nome ao lado.
export class BoolCell implements Cell {
  private lines: string[] = [];
  constructor(private name: string, private checked: boolean, private minH = 20) {}
  measure(doc: Doc, w: number): number {
    this.lines = wrapLines(doc, this.name, FONT.regular, 7.2, w - 28).slice(0, 2);
    return Math.max(this.minH, 8 + 8.6 * this.lines.length);
  }
  draw(doc: Doc, x: number, y: number, w: number, h: number): void {
    frame(doc, x, y, w, h);
    const s = 8;
    const bx = x + 7;
    const by = y + h / 2 - s / 2;
    doc.lineWidth(0.8).rect(bx, by, s, s).fillAndStroke(COLORS.white, COLORS.ink);
    if (this.checked) {
      doc.lineWidth(1.1).strokeColor(COLORS.ink);
      doc.moveTo(bx + 1.6, by + 1.6).lineTo(bx + s - 1.6, by + s - 1.6).stroke();
      doc.moveTo(bx + 1.6, by + s - 1.6).lineTo(bx + s - 1.6, by + 1.6).stroke();
    }
    let base = y + h / 2 - (8.6 * (this.lines.length - 1)) / 2 + 2.5;
    for (const line of this.lines) {
      putText(doc, line, x + 22, base, FONT.regular, 7.2, COLORS.ink);
      base += 8.6;
    }
  }
}

// ------------------------------------------------------------------ linhas
export interface Row {
  height(doc: Doc, flow: Flow): number; // altura que a linha pede na primeira parte
  draw(flow: Flow): void; // desenha (e, se for o caso, continua nas páginas seguintes)
}

// Caixas lado a lado, todas da mesma altura.
export class GridRow implements Row {
  private h = 0;
  constructor(private cells: Cell[], private ncols: number) {}
  private colW(flow: Flow): number {
    return (flow.contentW - (this.ncols - 1) * GAP) / this.ncols;
  }
  height(doc: Doc, flow: Flow): number {
    const cw = this.colW(flow);
    this.h = Math.max(...this.cells.map((c) => c.measure(doc, cw)));
    return this.h;
  }
  draw(flow: Flow): void {
    const cw = this.colW(flow);
    if (!this.h) this.height(flow.doc, flow);
    flow.ensure(this.h);
    this.cells.forEach((cell, i) => cell.draw(flow.doc, flow.left + i * (cw + GAP), flow.y, cw, this.h));
    flow.y += this.h;
  }
}

const LONG_LINE = 12; // altura de cada linha do texto longo
const LONG_LABEL = 11; // espaço do nome acima da caixa

// Texto longo (e a parte de texto do "texto com número"): largura toda, cresce com o conteúdo e,
// se não couber, continua na página seguinte repetindo o nome do campo.
export class LongRow implements Row {
  private lines: string[] = [];
  constructor(
    private name: string,
    private text: string,
    private minLines = 3,
    private number?: { text: string } | null, // "texto com número": o número pequeno ao lado do nome
  ) {}
  private wrap(doc: Doc, flow: Flow): void {
    this.lines = this.text ? wrapLines(doc, this.text, FONT.regular, 9, flow.contentW - 14) : [];
  }
  height(doc: Doc, flow: Flow): number {
    this.wrap(doc, flow);
    return LONG_LABEL + 6 + LONG_LINE * Math.max(this.minLines, this.lines.length) + (this.number ? 4 : 0);
  }
  draw(flow: Flow): void {
    const { doc } = flow;
    this.wrap(doc, flow);
    let index = 0;
    let first = true;
    const extra = this.number ? 4 : 0;
    do {
      const remaining = this.lines.length - index;
      const full = LONG_LABEL + extra + 6 + LONG_LINE * Math.max(first ? this.minLines : 1, remaining);
      // nunca começa com menos de 2 linhas no pé da página
      const minimum = LONG_LABEL + extra + 6 + LONG_LINE * Math.min(2, Math.max(remaining, 1));
      if (flow.y + minimum > flow.maxY + 0.01 && flow.y > MARGIN + 0.01) flow.newPage();
      const room = flow.maxY - flow.y - LONG_LABEL - extra - 6;
      const fit = Math.max(1, Math.floor(room / LONG_LINE));
      const take = full <= flow.maxY - flow.y + 0.01 ? Math.max(first ? this.minLines : 1, remaining) : fit;
      const shown = this.lines.slice(index, index + take);
      const boxH = 6 + LONG_LINE * take;
      const x = flow.left;
      const title = first ? this.name : `${this.name} (continuação)`;
      putText(doc, title, x + 2, flow.y + 7.5, FONT.regular, 6.8, COLORS.muted);
      let boxTop = flow.y + LONG_LABEL;
      if (this.number && first) {
        const nx = x + 6 + doc.font(FONT.regular).fontSize(6.8).widthOfString(title) + 8;
        doc.lineWidth(0.6).roundedRect(nx, flow.y - 1, 34, 14, 3).fillAndStroke(COLORS.white, COLORS.line);
        putText(doc, this.number.text, nx + 17, flow.y + 9, FONT.regular, 8.2, COLORS.ink, 'center');
        boxTop += extra;
      }
      frame(doc, x, boxTop, flow.contentW, boxH);
      shown.forEach((line, i) => putText(doc, line, x + 7, boxTop + 6 + 8 + LONG_LINE * i, FONT.regular, 9, COLORS.ink));
      flow.y = boxTop + boxH;
      index += shown.length;
      first = false;
      if (index < this.lines.length) flow.newPage();
    } while (index < this.lines.length);
  }
}

// ------------------------------------------------------------------ faixa de seção
export const BAR_H = 17;

export function drawBar(flow: Flow, title: string): void {
  const { doc } = flow;
  const x = flow.left;
  doc.roundedRect(x, flow.y, flow.contentW, BAR_H, 3).fill(COLORS.bar);
  doc.rect(x, flow.y, 3, BAR_H).fill(COLORS.accent);
  putText(doc, title, x + 10, flow.y + BAR_H - 5, FONT.displaySemi, 9.5, COLORS.ink);
  flow.y += BAR_H + GAP;
}

// Uma seção: faixa com título + linhas. O título fica junto das primeiras linhas (até ~70 pt), para
// nunca terminar a página com o título e uma linha solta.
export function drawSection(flow: Flow, title: string | null, rows: Row[]): void {
  const { doc } = flow;
  let need = title ? BAR_H + GAP : 0;
  let counted = 0;
  for (const row of rows) {
    need += row.height(doc, flow) + GAP;
    counted++;
    if (need - (title ? BAR_H + GAP : 0) >= 70) break;
  }
  flow.ensure(Math.min(need, flow.maxY - MARGIN));
  if (title) drawBar(flow, title);
  for (const row of rows) {
    row.draw(flow);
    flow.y += GAP;
  }
  flow.y += 6;
  void counted;
}
