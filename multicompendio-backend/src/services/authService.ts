import { assertLoginAllowed, clearLoginFailures, recordLoginFailure } from '../utils/loginThrottle';
import { createExampleCharacter } from './exampleCharacterService';
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

let dummy: Promise<string> | null = null;
const dummyHash = (): Promise<string> => (dummy ??= hashPassword('senha-que-nao-existe-1'));

// RF01 — cadastro
const asText = (v: unknown): string => (typeof v === 'string' ? v : '');

export async function register(input: RegisterInput): Promise<AuthResult> {
  const name = asText(input?.name).trim();
  const email = asText(input?.email).trim().toLowerCase();
  const password = asText(input?.password);

  if (!name) throw new ValidationError('Informe o seu nome.');
  if (name.length > 60) throw new ValidationError('O nome pode ter no máximo 60 letras.');
  if (email.length > 255 || !EMAIL_PATTERN.test(email)) throw new ValidationError('Informe um e-mail válido.');
  if (password.length > 128) throw new ValidationError('A senha pode ter no máximo 128 caracteres.');
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }

  if (await usersRepo.findUserRecordByEmail(email)) {
    throw new ConflictError('Já existe uma conta com esse e-mail.');
  }

  try {
    const user = await usersRepo.insertUser(name, email, await hashPassword(password));
    // o personagem de exemplo é um brinde: se algo falhar, a conta é criada do mesmo jeito
    await createExampleCharacter(user.id).catch((err) =>
      console.error('Não foi possível criar o personagem de exemplo:', err),
    );
    return { user, token: signToken(user.id) };
  } catch (err) {
    // duas requisições simultâneas com o mesmo e-mail: o índice único segura a segunda
    if ((err as { code?: string }).code === '23505') {
      throw new ConflictError('Já existe uma conta com esse e-mail.');
    }
    throw err;
  }
}

// RF01 — entrada
export async function login(input: LoginInput, ip = 'desconhecido'): Promise<AuthResult> {
  const email = asText(input?.email).trim().toLowerCase().slice(0, 256);
  const password = asText(input?.password).slice(0, 129); // senhas longas demais nunca foram aceitas no cadastro

  assertLoginAllowed(ip, email);
  const record = await usersRepo.findUserRecordByEmail(email);
  // e-mail inexistente também gasta o tempo de uma conferência, para o tempo de resposta não revelar quais e-mails têm conta
  const valid = record ? await verifyPassword(password, record.password_hash) : (await verifyPassword(password, await dummyHash()), false);

  // Mesma mensagem para e-mail inexistente e senha errada: não revela quais e-mails têm conta.
  if (!record || !valid) {
    recordLoginFailure(ip, email);
    throw new UnauthorizedError('E-mail ou senha incorretos.');
  }
  clearLoginFailures(ip, email);

  const { password_hash: _ignored, ...user } = record;
  return { user, token: signToken(user.id) };
}

export async function getCurrentUser(userId: string): Promise<User> {
  const user = await usersRepo.findUserById(userId);
  if (!user) throw new UnauthorizedError('Sua sessão expirou. Entre novamente.');
  return user;
}
