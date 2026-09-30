import { app } from './app';

const port = process.env.PORT ?? 3000;

app.listen(port, () => {
  console.log(`Multicompêndio API rodando na porta ${port}`);
});
