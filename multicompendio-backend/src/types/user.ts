export interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

// Linha completa da tabela — só o repositório e o serviço de autenticação
// enxergam o hash; ele nunca sai pela API.
export interface UserRecord extends User {
  password_hash: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}
