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
