import { Request, Response } from 'express';
import * as authService from '../services/authService';
import { handleError } from '../utils/httpError';

// POST /auth/register
export async function register(req: Request, res: Response): Promise<void> {
  try {
    res.status(201).json(await authService.register(req.body));
  } catch (err) {
    handleError(res, err);
  }
}

// POST /auth/login
export async function login(req: Request, res: Response): Promise<void> {
  try {
    res.json(await authService.login(req.body));
  } catch (err) {
    handleError(res, err);
  }
}

// GET /auth/me — quem está com a sessão aberta
export async function me(req: Request, res: Response): Promise<void> {
  try {
    res.json(await authService.getCurrentUser(req.userId as string));
  } catch (err) {
    handleError(res, err);
  }
}
