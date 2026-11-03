import { CharacterValues } from '../types/character';
import { InventoryEntry, Inventory } from '../types/item';
import { SystemAttribute } from '../types/system';
import { BAR_H, Flow, Row, drawBar } from './kit';
import { COLORS, FONT, GAP } from './theme';
import { Run, formatValue, isEmptyValue, putSegs, putText, sanitize, wrapLines, wrapRuns } from './text';

type Doc = PDFKit.PDFDocument;

// ------------------------------------------------------------------ dados de um bloco de item
export interface BlockData {
  name: string;
  caption: string;
  fields: Array<{ label: string; value: string }>;
  quantity?: number;
}

export function blockFromEntry(entry: InventoryEntry, fields: SystemAttribute[]): BlockData {
  return blockFrom(entry.name ?? '', entry.is_preinstalled, entry.owner_name, entry.values, fields, entry.quantity);
}

export function blockFrom(
  name: string,
  preinstalled: boolean,
  ownerName: string | null,
  values: CharacterValues,
  fields: SystemAttribute[],
  quantity?: number,
): BlockData {
  return {
    name: sanitize(name),
    caption: preinstalled ? 'Item do sistema' : ownerName ? sanitize(`Criado por ${ownerName}`) : '',
    fields: fields
      .filter((f) => !isEmptyValue(values[f.id]))
      .map((f) => ({ label: sanitize(f.name), value: formatValue(values[f.id]) })),
    quantity,
  };
}

// ------------------------------------------------------------------ bloco de estatísticas (como nos livros)
const BLOCK_TEXT = 8;
const BLOCK_LEADING = 10.6;

function measureBlock(doc: Doc, block: BlockData, w: number): { height: number; fieldLines: ReturnType<typeof wrapRuns>[]; nameLines: string[] } {
  const nameLines = wrapLines(doc, block.name, FONT.displaySemi, 11.5, w - 12);
  const entries = [...block.fields];
  if (block.quantity !== undefined) entries.push({ label: 'Quantidade no inventário', value: String(block.quantity) });
  const fieldLines = entries.map((f) => {
    const runs: Run[] = [
      { text: `${f.label}: `, font: FONT.semi },
      { text: f.value, font: FONT.regular },
    ];
    return wrapRuns(doc, runs, BLOCK_TEXT, w - 12);
  });
  const caption = block.caption ? 9.5 + 3 : 0;
  const height = 6 + 14 * nameLines.length + caption + fieldLines.reduce((sum, l) => sum + BLOCK_LEADING * l.length + 1.5, 0) + 7;
  return { height, fieldLines, nameLines };
}

function drawBlock(doc: Doc, block: BlockData, x: number, y: number, w: number, h: number): void {
  const m = measureBlock(doc, block, w);
  doc.lineWidth(2.2).strokeColor(COLORS.muted);
  doc.moveTo(x, y).lineTo(x + w, y).stroke();
  doc.moveTo(x, y + h).lineTo(x + w, y + h).stroke();
  let base = y + 6 + 11;
  for (const line of m.nameLines) {
    putText(doc, line, x + 6, base, FONT.displaySemi, 11.5, COLORS.ink);
    base += 14;
  }
  base -= 14 - 3;
  if (block.caption) {
    putText(doc, block.caption, x + 6, base + 6.5, FONT.italic, 7.4, COLORS.muted);
    base += 9.5 + 3;
  }
  base += 8 - 3 + 0.5;
  for (const lines of m.fieldLines) {
    for (const segs of lines) {
      putSegs(doc, segs, x + 6, base, BLOCK_TEXT, COLORS.ink);
      base += BLOCK_LEADING;
    }
    base += 1.5;
  }
}

// Linha com até dois blocos lado a lado, da mesma altura (os filetes ficam alinhados).
export class BlockRow implements Row {
  private h = 0;
  constructor(private blocks: BlockData[]) {}
  private colW(flow: Flow): number {
    return (flow.contentW - 12) / 2;
  }
  height(doc: Doc, flow: Flow): number {
    this.h = Math.max(...this.blocks.map((b) => measureBlock(doc, b, this.colW(flow)).height));
    return this.h;
  }
  draw(flow: Flow): void {
    if (!this.h) this.height(flow.doc, flow);
    flow.ensure(this.h);
    const cw = this.colW(flow);
    this.blocks.forEach((b, i) => drawBlock(flow.doc, b, flow.left + i * (cw + 12), flow.y, cw, this.h));
    flow.y += this.h + 4;
  }
}

export function blockRows(blocks: BlockData[]): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < blocks.length; i += 2) rows.push(new BlockRow(blocks.slice(i, i + 2)));
  return rows;
}

// ------------------------------------------------------------------ tabela do inventário
// Item | Qtd | Resumo. O resumo reúne os primeiros campos curtos preenchidos do item.
export class InventoryTable implements Row {
  constructor(private entries: InventoryEntry[], private fields: SystemAttribute[]) {}

  private summary(entry: InventoryEntry): string {
    return this.fields
      .filter((f) => f.data_type !== 'longtext' && !isEmptyValue(entry.values[f.id]))
      .slice(0, 3)
      .map((f) => formatValue(entry.values[f.id]))
      .join(' · ');
  }

  height(): number {
    return 20 + 22;
  }

  draw(flow: Flow): void {
    const { doc } = flow;
    const x = flow.left;
    const w = flow.contentW;
    const cols = [x + 7, x + 177, x + 213];
    const sumW = w - 213 - 7;
    const header = () => {
      doc.roundedRect(x, flow.y, w, 20, 3).fill(COLORS.bar);
      putText(doc, 'Item', cols[0], flow.y + 13, FONT.semi, 7.8, COLORS.ink);
      putText(doc, 'Qtd', cols[1], flow.y + 13, FONT.semi, 7.8, COLORS.ink);
      putText(doc, 'Resumo', cols[2], flow.y + 13, FONT.semi, 7.8, COLORS.ink);
      flow.y += 20;
    };
    flow.ensure(20 + 22);
    header();
    for (const entry of this.entries) {
      const name = wrapLines(doc, sanitize(entry.name ?? ''), FONT.semi, 8.2, 160);
      const sum = wrapLines(doc, this.summary(entry), FONT.regular, 8.2, sumW);
      const h = 8 + 10.4 * Math.max(name.length, sum.length, 1);
      if (flow.y + h > flow.maxY + 0.01) {
        flow.newPage();
        header();
      }
      name.forEach((l, i) => putText(doc, l, cols[0], flow.y + 4 + 8 + 10.4 * i, FONT.semi, 8.2, COLORS.ink));
      putText(doc, String(entry.quantity), cols[1], flow.y + 4 + 8, FONT.regular, 8.2, COLORS.ink);
      sum.forEach((l, i) => putText(doc, l, cols[2], flow.y + 4 + 8 + 10.4 * i, FONT.regular, 8.2, COLORS.ink));
      doc.lineWidth(0.5).strokeColor(COLORS.line).moveTo(x, flow.y + h).lineTo(x + w, flow.y + h).stroke();
      flow.y += h;
    }
  }
}

// Seções do inventário: a tabela e os blocos dos itens (só os que a pessoa pode ver).
export function drawInventory(flow: Flow, inventory: Inventory): void {
  const entries = inventory.entries.filter((e) => e.viewable && e.name);
  if (entries.length === 0) return;

  flow.ensure(BAR_H + GAP + 42);
  drawBar(flow, 'Inventário');
  new InventoryTable(entries, inventory.fields).draw(flow);
  flow.y += 14;

  const blocks = blockRows(entries.map((e) => blockFromEntry(e, inventory.fields)));
  const first = blocks[0].height(flow.doc, flow);
  flow.ensure(BAR_H + GAP + first);
  drawBar(flow, 'Itens do inventário');
  for (const row of blocks) row.draw(flow);
}
