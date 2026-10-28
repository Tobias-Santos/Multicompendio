import { Request, Response } from 'express';
import * as sharingService from '../services/sharingService';
import { handleError } from '../utils/httpError';

const userOf = (req: Request): string => req.userId as string;

// GET /systems/:id/sharing — link e participantes (só o dono)
export async function getSharing(req: Request, res: Response): Promise<void> {
  try {
    res.json(await sharingService.getSharing(req.params.id, userOf(req)));
  } catch (err) {
    handleError(res, err);
  }
}

// POST /systems/:id/sharing/invite — gera (ou troca) o link
export async function createInvite(req: Request, res: Response): Promise<void> {
  try {
    res.status(201).json(await sharingService.createInvite(req.params.id, userOf(req)));
  } catch (err) {
    handleError(res, err);
  }
}

// DELETE /systems/:id/sharing/invite — desativa o link
export async function disableInvite(req: Request, res: Response): Promise<void> {
  try {
    await sharingService.disableInvite(req.params.id, userOf(req));
    res.status(204).send();
  } catch (err) {
    handleError(res, err);
  }
}

// DELETE /systems/:id/membership — sair de um sistema compartilhado
export async function leave(req: Request, res: Response): Promise<void> {
  try {
    await sharingService.leaveSystem(req.params.id, userOf(req));
    res.status(204).send();
  } catch (err) {
    handleError(res, err);
  }
}

// GET /invites/:token — a que sistema o convite leva
export async function previewInvite(req: Request, res: Response): Promise<void> {
  try {
    res.json(await sharingService.previewInvite(req.params.token, userOf(req)));
  } catch (err) {
    handleError(res, err);
  }
}

// POST /invites/:token/accept — entra no sistema
export async function acceptInvite(req: Request, res: Response): Promise<void> {
  try {
    res.json(await sharingService.acceptInvite(req.params.token, userOf(req)));
  } catch (err) {
    handleError(res, err);
  }
}
