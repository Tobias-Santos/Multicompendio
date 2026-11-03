import { CharacterValue } from '../types/character';
import { FONT } from './theme';

type Doc = PDFKit.PDFDocument;

// ------------------------------------------------------------------ texto seguro para as fontes
// As fontes embutidas cobrem o alfabeto latino (português, pontuação comum, setas e sinais básicos).
// Um caractere que elas não têm sairia como um quadrado; aqui ele vira "?", e os invisíveis somem.
const SUPPORTED: Array<[number, number]> = [
  [0x20, 0x7e], [0xa0, 0xff], [0x131, 0x131], [0x152, 0x153], [0x2bb, 0x2bc], [0x2c6, 0x2c6], [0x2da, 0x2da],
  [0x2dc, 0x2dc], [0x2000, 0x206f], [0x2074, 0x2074], [0x20ac, 0x20ac], [0x2122, 0x2122], [0x2191, 0x2191],
  [0x2193, 0x2193], [0x2212, 0x2212], [0x2215, 0x2215],
];

export function sanitize(text: string): string {
  let out = '';
  for (const ch of text.normalize('NFC')) {
    const code = ch.codePointAt(0) as number;
    if (ch === '\n') out += ch;
    else if (ch === '\t') out += ' ';
    else if (code === 0xad || (code >= 0x200b && code <= 0x200f) || (code >= 0x2028 && code <= 0x202e) || (code >= 0x2060 && code <= 0x206f)) continue;
    else if (SUPPORTED.some(([a, b]) => code >= a && code <= b)) out += ch;
    else if (code < 0x20) continue;
    else out += '?';
  }
  return out;
}

// ------------------------------------------------------------------ formatação de valores
// Números no padrão brasileiro (vírgula decimal) e com o sinal de menos tipográfico.
export function formatNumber(n: number): string {
  const text = Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
  return text.replace('-', '\u2212');
}

export function formatValue(value: CharacterValue | undefined): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'number') return formatNumber(value);
  if (typeof value === 'object') {
    // texto com número: "3 · texto"
    const number = value.number === null ? '' : `${formatNumber(value.number)} · `;
    return sanitize(number + value.text);
  }
  return sanitize(String(value));
}

export function isEmptyValue(value: CharacterValue | undefined): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (typeof value === 'object') return value.number === null && value.text.trim() === '';
  return false; // número e verdadeiro ou falso sempre são um valor
}

// ------------------------------------------------------------------ medida e quebra de linha
export function setFont(doc: Doc, font: string, size: number): Doc {
  return doc.font(font).fontSize(size);
}

export function widthOf(doc: Doc, text: string, font: string, size: number): number {
  return setFont(doc, font, size).widthOfString(text);
}

// Altura da letra acima da linha de base, para posicionar o texto pela linha de base (como nos livros).
export function ascent(doc: Doc, font: string, size: number): number {
  setFont(doc, font, size);
  return ((doc as unknown as { _font: { ascender: number } })._font.ascender / 1000) * size;
}

// Escreve uma linha de texto com a linha de base em `baseline`. align: posição de `x` na linha.
export function putText(
  doc: Doc,
  text: string,
  x: number,
  baseline: number,
  font: string,
  size: number,
  color: string,
  align: 'left' | 'center' | 'right' = 'left',
): void {
  if (!text) return;
  const w = widthOf(doc, text, font, size);
  const left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  doc.fillColor(color).text(text, left, baseline - ascent(doc, font, size), { lineBreak: false });
}

// Quebra um texto simples em linhas que cabem em `width` (respeitando as quebras de linha do texto).
export function wrapLines(doc: Doc, text: string, font: string, size: number, width: number): string[] {
  setFont(doc, font, size);
  const out: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const candidate = line ? `${line} ${word}` : word;
      if (doc.widthOfString(candidate) <= width) {
        line = candidate;
        continue;
      }
      if (line) out.push(line);
      line = word;
      while (doc.widthOfString(line) > width && line.length > 1) {
        // palavra maior que a linha: quebra por caracteres
        let cut = line.length - 1;
        while (cut > 1 && doc.widthOfString(line.slice(0, cut)) > width) cut--;
        out.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    out.push(line);
  }
  return out;
}

// ------------------------------------------------------------------ texto com trechos de fontes diferentes
export interface Run {
  text: string;
  font: string;
}
export interface Seg {
  text: string;
  font: string;
  x: number;
}

// Quebra trechos (ex.: negrito no meio de uma frase) em linhas, medindo cada palavra na própria fonte.
export function wrapRuns(doc: Doc, runs: Run[], size: number, width: number): Seg[][] {
  const lines: Seg[][] = [[]];
  let x = 0;
  const push = (text: string, font: string, w: number) => {
    const line = lines[lines.length - 1];
    const last = line[line.length - 1];
    if (last && last.font === font && Math.abs(last.x + widthOf(doc, last.text, font, size) - x) < 0.01) last.text += text;
    else line.push({ text, font, x });
    x += w;
  };
  for (const run of runs) {
    const parts = run.text.split(/(\n| )/);
    for (const part of parts) {
      if (part === '') continue;
      if (part === '\n') {
        lines.push([]);
        x = 0;
        continue;
      }
      if (part === ' ') {
        if (x > 0) x += widthOf(doc, ' ', run.font, size); // o espaço só conta no meio da linha
        continue;
      }
      let word = part;
      let w = widthOf(doc, word, run.font, size);
      if (x > 0 && x + w > width) {
        lines.push([]);
        x = 0;
      }
      while (w > width && word.length > 1) {
        let cut = word.length - 1;
        while (cut > 1 && widthOf(doc, word.slice(0, cut), run.font, size) > width) cut--;
        push(word.slice(0, cut), run.font, widthOf(doc, word.slice(0, cut), run.font, size));
        lines.push([]);
        x = 0;
        word = word.slice(cut);
        w = widthOf(doc, word, run.font, size);
      }
      push(word, run.font, w);
    }
  }
  return lines;
}

// Desenha uma linha de trechos com a linha de base em `baseline`.
export function putSegs(doc: Doc, segs: Seg[], x: number, baseline: number, size: number, color: string): void {
  for (const s of segs) putText(doc, s.text, x + s.x, baseline, s.font, size, color);
}

export const FONTS = FONT;
