import { StoryDocument, StoryNode } from '../types/story';
import { Flow } from './kit';
import { COLORS, FONT } from './theme';
import { Run, putSegs, sanitize, wrapRuns } from './text';

// História de origem: o documento do editor (títulos 1 e 2, negrito, itálico, listas, citação e
// separador) desenhado com a mesma formatação, sem nada além do que o editor permite.

const BODY = { size: 9.6, leading: 14.2, after: 7 };
const H1 = { size: 17, leading: 21, before: 4, after: 7 };
const H2 = { size: 12.5, leading: 16, before: 8, after: 5 };
const QUOTE = { size: 10.2, leading: 15 };

function runsOf(node: StoryNode, base: 'regular' | 'italic' | 'display'): Run[] {
  const runs: Run[] = [];
  for (const child of node.content ?? []) {
    if (child.type === 'hardBreak') {
      runs.push({ text: '\n', font: FONT.regular });
      continue;
    }
    if (child.type !== 'text' || !child.text) continue;
    const marks = new Set((child.marks ?? []).map((m) => m.type));
    const bold = marks.has('bold');
    const italic = marks.has('italic') || base === 'italic';
    let font: string = FONT.regular;
    if (base === 'display') font = FONT.displaySemi;
    else if (bold && italic) font = FONT.semiItalic;
    else if (bold) font = FONT.semi;
    else if (italic) font = FONT.italic;
    runs.push({ text: sanitize(child.text), font });
  }
  return runs;
}

interface Box {
  x: number;
  width: number;
  size: number;
  leading: number;
  bar?: boolean; // filete de citação ao lado
}

// Desenha um parágrafo linha por linha (continua na página seguinte quando preciso).
function paragraph(flow: Flow, runs: Run[], box: Box, bullet?: string): void {
  const lines = wrapRuns(flow.doc, runs, box.size, box.width);
  lines.forEach((segs, i) => {
    flow.ensure(box.leading);
    const base = flow.y + box.leading * 0.5 + box.size * 0.35;
    if (box.bar) flow.doc.rect(box.x - 12, flow.y, 2.4, box.leading).fill(COLORS.accent);
    if (bullet && i === 0) putSegs(flow.doc, [{ text: bullet, font: FONT.regular, x: 0 }], box.x - 14, base, box.size, COLORS.ink);
    putSegs(flow.doc, segs, box.x, base, box.size, COLORS.ink);
    flow.y += box.leading;
  });
}

function heading(flow: Flow, node: StoryNode): void {
  const style = node.attrs?.level === 1 ? H1 : H2;
  // o título nunca fica sozinho no pé da página: pede espaço para ele e mais duas linhas de texto
  flow.ensure(style.before + style.leading + style.after + 2 * BODY.leading);
  if (flow.y > 40.5) flow.y += style.before;
  paragraph(flow, runsOf(node, 'display'), { x: flow.left, width: flow.contentW, size: style.size, leading: style.leading });
  flow.y += style.after;
}

export function drawStory(flow: Flow, story: StoryDocument): void {
  const x = flow.left;
  const width = flow.contentW;
  for (const node of story.content) {
    if (node.type === 'heading') {
      heading(flow, node);
    } else if (node.type === 'paragraph') {
      const runs = runsOf(node, 'regular');
      if (runs.length === 0) flow.y += BODY.leading / 2;
      else paragraph(flow, runs, { x, width, size: BODY.size, leading: BODY.leading });
      flow.y += BODY.after;
    } else if (node.type === 'bulletList' || node.type === 'orderedList') {
      let n = node.attrs?.start ?? 1;
      for (const item of node.content ?? []) {
        for (const p of (item.content ?? []).filter((c) => c.type === 'paragraph')) {
          const mark = node.type === 'bulletList' ? '•' : `${n}.`;
          paragraph(flow, runsOf(p, 'regular'), { x: x + 18, width: width - 18, size: BODY.size, leading: BODY.leading }, mark);
          flow.y += 2;
        }
        n++;
      }
      flow.y += BODY.after - 2;
    } else if (node.type === 'blockquote') {
      flow.y += 2;
      for (const p of (node.content ?? []).filter((c) => c.type === 'paragraph')) {
        paragraph(flow, runsOf(p, 'italic'), { x: x + 14, width: width - 14, size: QUOTE.size, leading: QUOTE.leading, bar: true });
      }
      flow.y += 9;
    } else if (node.type === 'horizontalRule') {
      flow.y += 5;
      flow.ensure(10);
      flow.doc.lineWidth(0.7).strokeColor(COLORS.line).moveTo(x, flow.y).lineTo(x + width, flow.y).stroke();
      flow.y += 9;
    }
  }
}
