import express, { NextFunction, Request, Response } from 'express';
import { handleError } from './utils/httpError';
import cors from 'cors';
import authRouter from './routes/auth';
import systemsRouter from './routes/systems';
import charactersRouter from './routes/characters';
import invitesRouter from './routes/invites';
import itemsRouter from './routes/items';
import { requireAuth } from './middleware/auth';

export const app = express();

app.use(cors()); // liberado para todas as origens — ajuste depois para produção
// limite maior que o padrão (100kb) porque uma imagem de capa enviada
// como upload vira base64 dentro do JSON (image_url)
app.use(express.json({ limit: '8mb' }));
app.use('/auth', authRouter);
app.use('/systems', requireAuth, systemsRouter); // só quem entrou acessa os sistemas
app.use('/characters', requireAuth, charactersRouter);
app.use('/invites', requireAuth, invitesRouter);
app.use('/items', requireAuth, itemsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

// Último recurso: erros que o Express gera antes de chegar aos controladores (JSON inválido, corpo grande demais,
// endereço com % malformado). Sempre JSON, nunca a página de erro com a pilha.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const e = err as { type?: string };
  if (e?.type === 'entity.too.large') { res.status(413).json({ error: 'A requisição é grande demais.' }); return; }
  if (e?.type === 'entity.parse.failed' || err instanceof SyntaxError) { res.status(400).json({ error: 'O corpo da requisição não é um JSON válido (esperado um objeto).' }); return; }
  if (err instanceof URIError) { res.status(400).json({ error: 'Endereço inválido.' }); return; }
  if (e?.type === 'encoding.unsupported' || e?.type === 'charset.unsupported') { res.status(415).json({ error: 'Codificação não suportada.' }); return; }
  handleError(res, err);
});
