import { requestBlob } from './http';

// Exportação em PDF (RF10 e RF13). O arquivo é gerado pelo servidor; aqui só se pede e se entrega o download.
export type Paper = 'a4' | 'letter';

export interface PdfOptions {
  paper: Paper;
  inventory: boolean; // inventário e blocos dos itens
  story: boolean; // história de origem
  hideEmpty: boolean; // não mostra os campos vazios
}

export const DEFAULT_PDF_OPTIONS: PdfOptions = { paper: 'a4', inventory: true, story: true, hideEmpty: false };

const flag = (value: boolean) => (value ? '1' : '0');

export const characterPdfPath = (id: string, o: PdfOptions) =>
  `/characters/${id}/pdf?paper=${o.paper}&inventory=${flag(o.inventory)}&story=${flag(o.story)}&hideEmpty=${flag(o.hideEmpty)}`;

export const blankSheetPdfPath = (systemId: string, paper: Paper) => `/systems/${systemId}/sheet.pdf?paper=${paper}`;

export const itemPdfPath = (itemId: string, paper: Paper) => `/items/${itemId}/pdf?paper=${paper}`;

// Nome do arquivo sem os caracteres que o sistema operacional não aceita.
export function pdfFileName(base: string, suffix: string): string {
  const clean = base.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'multicompendio';
  return `${clean} - ${suffix}.pdf`;
}

// Pede o PDF e dispara o download no navegador.
export async function savePdf(path: string, filename: string): Promise<void> {
  const blob = await requestBlob(path);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
