import { TooManyRequestsError } from '../errors';

// Limite de tentativas de login erradas (força bruta de senha). Fica na memória do servidor:
// reiniciar o servidor zera as contagens, o que é aceitável para este projeto.
//  - por (IP + e-mail): 8 erros em 15 minutos bloqueiam aquele IP para aquele e-mail;
//  - por e-mail, de qualquer IP: 40 erros em 15 minutos (ataque distribuído).
// O bloqueio por IP+e-mail evita que um desconhecido trave a conta de outra pessoa de fora.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_IP_EMAIL = 8;
const MAX_PER_EMAIL = 40;

interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>();

function live(key: string, now: number): Bucket | undefined {
  const b = buckets.get(key);
  if (b && b.resetAt <= now) { buckets.delete(key); return undefined; }
  return b;
}
function prune(now: number): void {
  if (buckets.size < 5000) return;
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}
const keys = (ip: string, email: string): [string, string] => [`ip:${ip}|${email}`, `email:${email}`];

// Lança 429 se este IP/e-mail já passou do limite.
export function assertLoginAllowed(ip: string, email: string, now = Date.now()): void {
  const [k1, k2] = keys(ip, email);
  const a = live(k1, now), b = live(k2, now);
  const blocked = (a && a.count >= MAX_PER_IP_EMAIL ? a : undefined) ?? (b && b.count >= MAX_PER_EMAIL ? b : undefined);
  if (blocked) {
    const secs = Math.max(1, Math.ceil((blocked.resetAt - now) / 1000));
    throw new TooManyRequestsError(`Muitas tentativas de entrar. Tente de novo em ${Math.ceil(secs / 60)} minuto(s).`, secs);
  }
}

export function recordLoginFailure(ip: string, email: string, now = Date.now()): void {
  prune(now);
  for (const k of keys(ip, email)) {
    const b = live(k, now);
    if (b) b.count += 1; else buckets.set(k, { count: 1, resetAt: now + WINDOW_MS });
  }
}

export function clearLoginFailures(ip: string, email: string): void {
  buckets.delete(keys(ip, email)[0]); // quem acertou a senha liberou o seu IP; o contador do e-mail continua até expirar
}

export function resetLoginThrottleForTests(): void { buckets.clear(); }
