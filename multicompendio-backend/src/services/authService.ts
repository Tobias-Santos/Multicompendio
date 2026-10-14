import * as usersRepo from '../repositories/usersRepository';
import { ConflictError, UnauthorizedError, ValidationError } from '../errors';
import { hashPassword, verifyPassword } from '../utils/password';
import { signToken } from '../utils/token';
import { LoginInput, RegisterInput, User } from '../types/user';

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AuthResult {
  user: User;
  token: string;
}

// RF37 — cadastro
export async function register(input: RegisterInput): Promise<AuthResult> {
  const name = input.name?.trim() ?? '';
  const email = input.email?.trim().toLowerCase() ?? '';
  const password = input.password ?? '';

  if (!name) throw new ValidationError('Informe o seu nome.');
  if (name.length > 60) throw new ValidationError('O nome pode ter no máximo 60 letras.');
  if (!EMAIL_PATTERN.test(email)) throw new ValidationError('Informe um e-mail válido.');
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }

  if (await usersRepo.findUserRecordByEmail(email)) {
    throw new ConflictError('Já existe uma conta com esse e-mail.');
  }

  try {
    const user = await usersRepo.insertUser(name, email, await hashPassword(password));
    return { user, token: signToken(user.id) };
  } catch (err) {
    // duas requisições simultâneas com o mesmo e-mail: o índice único segura a segunda
    if ((err as { code?: string }).code === '23505') {
      throw new ConflictError('Já existe uma conta com esse e-mail.');
    }
    throw err;
  }
}

// RF37 — entrada
export async function login(input: LoginInput): Promise<AuthResult> {
  const email = input.email?.trim().toLowerCase() ?? '';
  const password = input.password ?? '';

  const record = await usersRepo.findUserRecordByEmail(email);
  const valid = record ? await verifyPassword(password, record.password_hash) : false;

  // Mesma mensagem para e-mail inexistente e senha errada: não revela quais e-mails têm conta.
  if (!record || !valid) throw new UnauthorizedError('E-mail ou senha incorretos.');

  const { password_hash: _ignored, ...user } = record;
  return { user, token: signToken(user.id) };
}

export async function getCurrentUser(userId: string): Promise<User> {
  const user = await usersRepo.findUserById(userId);
  if (!user) throw new UnauthorizedError('Sua sessão expirou. Entre novamente.');
  return user;
}
