import { Request, Response } from 'express';
import * as pdfService from '../services/pdfService';
import { handleError } from '../utils/httpError';

const userOf = (req: Request): string => req.userId as string;

// Envia o PDF como arquivo para baixar. O nome acentuado vai no formato que os navegadores entendem (RFC 5987).
function send(res: Response, result: pdfService.PdfResult): void {
  const ascii = result.filename.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(result.filename)}`);
  res.setHeader('Cache-Control', 'no-store');
  // Campos cujo texto foi cortado (não coube na caixa do layout): o front avisa a pessoa depois do download.
  if (result.cut.length > 0) {
    res.setHeader('X-Campos-Cortados', encodeURIComponent(JSON.stringify({ total: result.cut.length, nomes: result.cut.slice(0, 8) })));
  }
  res.setHeader('Access-Control-Expose-Headers', 'X-Campos-Cortados, Content-Disposition');
  res.send(result.buffer);
}

// GET /characters/:id/pdf — ficha do personagem (RF10)
export async function characterPdf(req: Request, res: Response): Promise<void> {
  try {
    send(res, await pdfService.characterPdf(req.params.id, userOf(req), pdfService.parseOptions(req.query)));
  } catch (err) {
    handleError(res, err);
  }
}

// GET /systems/:id/sheet.pdf — ficha em branco do sistema
export async function blankSheet(req: Request, res: Response): Promise<void> {
  try {
    send(res, await pdfService.blankSheetPdf(req.params.id, userOf(req), pdfService.parseOptions(req.query)));
  } catch (err) {
    handleError(res, err);
  }
}

// GET /items/:id/pdf — bloco de estatísticas do item (RF13)
export async function itemPdf(req: Request, res: Response): Promise<void> {
  try {
    send(res, await pdfService.itemPdf(req.params.id, userOf(req), pdfService.parseOptions(req.query)));
  } catch (err) {
    handleError(res, err);
  }
}
