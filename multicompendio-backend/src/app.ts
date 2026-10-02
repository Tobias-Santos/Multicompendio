import express from 'express';
import cors from 'cors';
import systemsRouter from './routes/systems';

export const app = express();

app.use(cors()); // liberado para todas as origens — ajuste depois para produção
// limite maior que o padrão (100kb) porque uma imagem de capa enviada
// como upload vira base64 dentro do JSON (image_url)
app.use(express.json({ limit: '8mb' }));
app.use('/systems', systemsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});
