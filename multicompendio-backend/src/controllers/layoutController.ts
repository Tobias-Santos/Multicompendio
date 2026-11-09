import { Request, Response } from 'express';
import * as layoutService from '../services/layoutService';
import { handleError } from '../utils/httpError';

const userOf = (req: Request): string => req.userId as string;

// GET /systems/:id/layout — o layout da ficha (salvo, curado ou automático)
export async function getLayout(req: Request, res: Response): Promise<void> {
  try {
    res.json(await layoutService.getLayoutView(req.params.id, userOf(req)));
  } catch (err) {
    handleError(res, err);
  }
}

// PUT /systems/:id/layout — grava o layout (só o dono), com a versão em que ele se baseou
export async function saveLayout(req: Request, res: Response): Promise<void> {
  try {
    res.json(await layoutService.saveLayout(req.params.id, userOf(req), req.body));
  } catch (err) {
    handleError(res, err);
  }
}

// DELETE /systems/:id/layout — volta ao layout automático (só o dono)
export async function resetLayout(req: Request, res: Response): Promise<void> {
  try {
    res.json(await layoutService.resetLayout(req.params.id, userOf(req)));
  } catch (err) {
    handleError(res, err);
  }
}
