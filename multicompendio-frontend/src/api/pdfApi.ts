import { requestBlob } from './http';

// Exportação em PDF (RF10 e RF13). O arquivo é gerado pelo servidor, que desenha cada seção e cada campo onde o layout da ficha manda;
// aqui só se pede e se entrega o download. A folha é só A4.
export interface PdfOptions {
  inventory: boolean; // inventário e blocos dos itens
  story: boolean; // história de origem
}

export const DEFAULT_PDF_OPTIONS: PdfOptions = { inventory: true, story: true };

const flag = (value: boolean) => (value ? '1' : '0');

export const characterPdfPath = (id: string, o: PdfOptions) => `/characters/${id}/pdf?inventory=${flag(o.inventory)}&story=${flag(o.story)}`;

export const blankSheetPdfPath = (systemId: string) => `/systems/${systemId}/sheet.pdf`;

export const itemPdfPath = (itemId: string) => `/items/${itemId}/pdf`;

// Nome do arquivo sem os caracteres que o sistema operacional não aceita.
export function pdfFileName(base: string, suffix: string): string {
  const clean = base.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'multicompendio';
  return `${clean} - ${suffix}.pdf`;
}

// Campos cujo texto não coube na caixa do layout e foi cortado (o servidor avisa num cabeçalho da resposta).
export interface CutFields {
  total: number;
  names: string[];
}

function readCut(headers: Headers): CutFields | null {
  const raw = headers.get('x-campos-cortados');
  if (!raw) return null;
  try {
    const data = JSON.parse(decodeURIComponent(raw)) as { total: number; nomes: string[] };
    return { total: data.total, names: data.nomes };
  } catch {
    return null;
  }
}

// Pede o PDF e dispara o download no navegador. Devolve os campos cortados, se houver.
export async function savePdf(path: string, filename: string): Promise<CutFields | null> {
  const { blob, headers } = await requestBlob(path);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return readCut(headers);
}
