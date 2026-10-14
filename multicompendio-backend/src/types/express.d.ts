// Acrescenta o usuário autenticado ao objeto de requisição do Express.
// Preenchido pelo middleware requireAuth.
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export {};
