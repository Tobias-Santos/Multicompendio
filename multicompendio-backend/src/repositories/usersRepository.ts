import { pool } from '../db/pool';
import { User, UserRecord } from '../types/user';

export async function insertUser(name: string, email: string, passwordHash: string): Promise<User> {
  const result = await pool.query<User>(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, name, email, created_at`,
    [name, email, passwordHash],
  );
  return result.rows[0];
}

export async function findUserRecordByEmail(email: string): Promise<UserRecord | null> {
  const result = await pool.query<UserRecord>(
    `SELECT id, name, email, password_hash, created_at FROM users WHERE lower(email) = lower($1)`,
    [email],
  );
  return result.rows[0] ?? null;
}

export async function findUserById(id: string): Promise<User | null> {
  const result = await pool.query<User>(
    `SELECT id, name, email, created_at FROM users WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}
