import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth';
import systemsRouter from './routes/systems';
import charactersRouter from './routes/characters';
import invitesRouter from './routes/invites';
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

app.use((_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});
