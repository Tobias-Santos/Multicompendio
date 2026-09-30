import express from 'express';
import cors from 'cors';
import systemsRouter from './routes/systems';

export const app = express();

app.use(cors()); // liberado para todas as origens — ajuste depois para produção
app.use(express.json());
app.use('/systems', systemsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});
