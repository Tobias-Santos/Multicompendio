import { COLORS, FONT, GAP, MARGIN, BOTTOM } from './theme';
import { putText } from './text';

type Doc = PDFKit.PDFDocument;

// ------------------------------------------------------------------ fluxo da página
// Usado nas páginas de texto (inventário, blocos dos itens e história). A ficha em si é desenhada por layoutSheet.ts,
// em posições absolutas. Guarda onde a próxima coisa será desenhada e passa para a página seguinte quando não cabe.
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

export interface Row {
  height(doc: Doc, flow: Flow): number; // altura que a linha pede na primeira parte
  draw(flow: Flow): void; // desenha (e, se for o caso, continua nas páginas seguintes)
}

// ------------------------------------------------------------------ faixa de seção (nas páginas de texto)
export const BAR_H = 17;

export function drawBar(flow: Flow, title: string): void {
  const { doc } = flow;
  const x = flow.left;
  doc.roundedRect(x, flow.y, flow.contentW, BAR_H, 3).fill(COLORS.bar);
  doc.rect(x, flow.y, 3, BAR_H).fill(COLORS.accent);
  putText(doc, title, x + 10, flow.y + BAR_H - 5, FONT.displaySemi, 9.5, COLORS.ink);
  flow.y += BAR_H + GAP;
}
