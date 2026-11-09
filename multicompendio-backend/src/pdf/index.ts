import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { CharacterValues } from '../types/character';
import { Inventory } from '../types/item';
import { StoryDocument } from '../types/story';
import { SystemAttribute } from '../types/system';
import { SheetLayout } from '../layoutCore';
import { BlockData, blockRows, drawInventory, visibleEntries } from './items';
import { Flow, drawBar } from './kit';
import { drawLayoutPages } from './layoutSheet';
import { drawStory } from './story';
import { COLORS, FONT, MARGIN, PAPERS, Paper } from './theme';
import { putText, sanitize, wrapLines } from './text';

// Exportação em PDF (RF10 e RF13). O layout é genérico: não depende de nenhum modelo de terceiros e se
// adapta aos campos que o sistema tiver. Todo o desenho é feito aqui, com fontes embutidas.

export interface PdfOptions {
  paper: Paper; // por enquanto só A4: o layout é desenhado em milímetros nessa folha
  inventory: boolean; // inventário e blocos dos itens
  story: boolean; // história de origem
}

export interface CharacterPdfModel {
  systemName: string;
  characterName: string;
  ownerName: string;
  attributes: SystemAttribute[];
  layout: SheetLayout; // onde cada seção e cada campo ficam na folha (salvo, curado ou automático)
  values: CharacterValues;
  inventory: Inventory | null;
  story: StoryDocument | null;
}

const FONT_DIR = path.join(__dirname, '..', '..', 'assets', 'fonts');
const FONT_FILES: Record<string, string> = {
  [FONT.regular]: 'work-sans-400-normal.ttf',
  [FONT.italic]: 'work-sans-400-italic.ttf',
  [FONT.semi]: 'work-sans-600-normal.ttf',
  [FONT.semiItalic]: 'work-sans-600-italic.ttf',
  [FONT.display]: 'fraunces-500-normal.ttf',
  [FONT.displaySemi]: 'fraunces-600-normal.ttf',
};

type Doc = PDFKit.PDFDocument;

function createDocument(paper: Paper, title: string, subject: string): { doc: Doc; flow: Flow; result: Promise<Buffer> } {
  const size = PAPERS[paper];
  const doc = new PDFDocument({
    size: [size.width, size.height],
    margins: { top: MARGIN, left: MARGIN, right: MARGIN, bottom: 52 },
    bufferPages: true,
    font: path.join(FONT_DIR, FONT_FILES[FONT.regular]),
    info: { Title: sanitize(title), Author: 'Multicompêndio', Subject: subject, Creator: 'Multicompêndio', Producer: 'Multicompêndio' },
  });
  for (const [name, file] of Object.entries(FONT_FILES)) doc.registerFont(name, path.join(FONT_DIR, file));
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  return { doc, flow: new Flow(doc, size.width - 2 * MARGIN), result };
}

// Nome e subtítulo no topo da primeira página, com um filete de destaque.
function drawHeader(flow: Flow, title: string, subtitle: string): void {
  const { doc } = flow;
  const lines = wrapLines(doc, sanitize(title), FONT.displaySemi, 23, flow.contentW).slice(0, 2);
  let base = flow.y + 22;
  for (const line of lines) {
    putText(doc, line, flow.left, base, FONT.displaySemi, 23, COLORS.ink);
    base += 27;
  }
  base -= 27 - 14;
  putText(doc, sanitize(subtitle), flow.left, base, FONT.regular, 9.2, COLORS.muted);
  const rule = base + 9;
  doc.lineWidth(1.3).strokeColor(COLORS.accent).moveTo(flow.left, rule).lineTo(flow.left + flow.contentW, rule).stroke();
  flow.y = rule + 11;
}

// Rodapé de todas as páginas: o sistema e "pág. X de Y".
function addFooters(doc: Doc, systemName: string): void {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const { width, height } = doc.page;
    doc.lineWidth(0.5).strokeColor(COLORS.line).moveTo(MARGIN, height - 40).lineTo(width - MARGIN, height - 40).stroke();
    putText(doc, sanitize(`Multicompêndio · ${systemName}`), MARGIN, height - 28, FONT.regular, 7.4, COLORS.muted);
    putText(doc, `pág. ${i + 1} de ${range.count}`, width - MARGIN, height - 28, FONT.regular, 7.4, COLORS.muted, 'right');
  }
}

// ------------------------------------------------------------------ ficha de um personagem (RF10)
// O resultado traz o PDF e os campos (ids de atributo) cujo texto não coube nem com a fonte no mínimo e foi cortado.
export interface PdfOutput {
  buffer: Buffer;
  cut: string[];
}

export async function buildCharacterPdf(model: CharacterPdfModel, options: PdfOptions): Promise<PdfOutput> {
  const { doc, flow, result } = createDocument(options.paper, `${model.characterName} — ficha (${model.systemName})`, 'Ficha de personagem');
  // a ficha: uma página do PDF para cada página do layout, com cada seção e cada campo na posição e no formato escolhidos
  const drawn = drawLayoutPages(doc, model.layout, model.attributes, model.values, {
    blank: false,
    onFirstPage: () => drawHeader(flow, model.characterName, `${model.systemName} · Jogador: ${model.ownerName}`),
  });
  if (options.inventory && model.inventory && visibleEntries(model.inventory).length > 0) {
    flow.newPage();
    drawInventory(flow, model.inventory);
  }
  if (options.story && model.story && model.story.content.length > 0) {
    flow.newPage();
    drawBar(flow, 'História de origem');
    flow.y += 6;
    drawStory(flow, model.story);
  }
  addFooters(doc, model.systemName);
  doc.end();
  return { buffer: await result, cut: drawn.overflow };
}

// ------------------------------------------------------------------ ficha em branco do sistema
export async function buildBlankSheetPdf(systemName: string, attributes: SystemAttribute[], layout: SheetLayout, options: Pick<PdfOptions, 'paper'>): Promise<PdfOutput> {
  const { doc, flow, result } = createDocument(options.paper, `Ficha em branco (${systemName})`, 'Ficha em branco');
  const drawn = drawLayoutPages(doc, layout, attributes, {}, { blank: true, onFirstPage: () => drawHeader(flow, 'Ficha em branco', systemName) });
  addFooters(doc, systemName);
  doc.end();
  return { buffer: await result, cut: drawn.overflow };
}

// ------------------------------------------------------------------ bloco de estatísticas de um item (RF13)
export function buildItemPdf(systemName: string, block: BlockData, options: Pick<PdfOptions, 'paper'>): Promise<Buffer> {
  const { doc, flow, result } = createDocument(options.paper, `${block.name} — bloco de estatísticas (${systemName})`, 'Bloco de estatísticas de item');
  drawHeader(flow, block.name, `${systemName} · Bloco de estatísticas`);
  for (const row of blockRows([block])) row.draw(flow);
  addFooters(doc, systemName);
  doc.end();
  return result;
}

