import { NextFunction, Request, Response } from 'express';
import * as usersRepo from '../repositories/usersRepository';
import { verifyToken } from '../utils/token';

// Quem já foi conferido nos últimos 30 s não é consultado de novo (evita uma ida ao banco por requisição).
const CHECKED_MS = 30_000;
const checked = new Map<string, number>();

async function userStillExists(id: string): Promise<boolean> {
  const now = Date.now();
  const until = checked.get(id);
  if (until && until > now) return true;
  const found = await usersRepo.findUserById(id).catch((err: { code?: string }) => {
    if (err?.code === '22P02') return null; // o id do token não é um UUID: não é de ninguém
    throw err;
  });
  if (!found) { checked.delete(id); return false; }
  if (checked.size > 5000) checked.clear();
  checked.set(id, now + CHECKED_MS);
  return true;
}

// Exige que a requisição venha de alguém que entrou na aplicação.
// O front envia o token no cabeçalho: Authorization: Bearer <token>
// Um token com assinatura válida de uma conta que não existe mais (banco recriado, por exemplo) também é recusado.
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  const userId = token ? verifyToken(token) : null;

  try {
    if (!userId || !(await userStillExists(userId))) {
      res.status(401).json({ error: 'Sua sessão expirou. Entre novamente.' });
      return;
    }
  } catch (err) {
    next(err);
    return;
  }

  req.userId = userId;
  next();
}
