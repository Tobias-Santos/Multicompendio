import { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../utils/token';

// Exige que a requisição venha de alguém que entrou na aplicação.
// O front envia o token no cabeçalho: Authorization: Bearer <token>
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  const userId = token ? verifyToken(token) : null;

  if (!userId) {
    res.status(401).json({ error: 'Sua sessão expirou. Entre novamente.' });
    return;
  }

  req.userId = userId;
  next();
}
