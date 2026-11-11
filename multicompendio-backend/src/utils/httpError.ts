import { Response } from 'express';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  StaleLayoutError,
  TooManyRequestsError,
  StaleRevisionError,
  UnauthorizedError,
  ValidationError,
} from '../errors';

// Falhas do PostgreSQL que são culpa da entrada (e não do servidor): viram 4xx com mensagem clara.
function pgFailure(err: unknown): { status: number; message: string } | null {
  const e = err as { code?: string; message?: string };
  if (typeof e?.code !== 'string') return null;
  if (e.code === '22P02') return /uuid/i.test(String(e.message)) ? { status: 404, message: 'Não encontrado.' } : { status: 400, message: 'Algum valor enviado é inválido.' };
  if (e.code === '22021' || e.code === '22P05') return { status: 400, message: 'O texto enviado contém caracteres inválidos.' };
  if (e.code === '22001') return { status: 400, message: 'Algum texto enviado é longo demais.' };
  if (e.code === '22003') return { status: 400, message: 'Algum número enviado está fora do limite permitido.' };
  if (e.code === '23514') return { status: 400, message: 'Algum valor enviado é inválido.' };
  if (e.code === '23505') return { status: 409, message: 'Já existe um registro igual a esse.' };
  return null;
}

export function handleError(res: Response, err: unknown): void {
  if (err instanceof ValidationError) {
    res.status(400).json({ error: err.message });
  } else if (err instanceof UnauthorizedError) {
    res.status(401).json({ error: err.message });
  } else if (err instanceof ForbiddenError) {
    res.status(403).json({ error: err.message });
  } else if (err instanceof NotFoundError) {
    res.status(404).json({ error: err.message });
  } else if (err instanceof TooManyRequestsError) {
    res.set('Retry-After', String(err.retryAfterSeconds)).status(429).json({ error: err.message });
  } else if (err instanceof StaleLayoutError) {
    res.status(409).json({ error: err.message, code: 'stale_layout', version: err.currentVersion });
  } else if (err instanceof StaleRevisionError) {
    res.status(409).json({ error: err.message, code: 'stale_revision', revision: err.currentRevision });
  } else if (err instanceof ConflictError) {
    res.status(409).json({ error: err.message });
  } else if (pgFailure(err)) {
    const f = pgFailure(err)!;
    res.status(f.status).json({ error: f.message });
  } else {
    console.error(err);
    res.status(500).json({ error: 'Algo deu errado. Tente novamente em instantes.' });
  }
}
