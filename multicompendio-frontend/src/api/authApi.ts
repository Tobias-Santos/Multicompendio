import { AuthResult, AuthUser } from '../types/user';
import { request } from './http';

export function registerUser(name: string, email: string, password: string): Promise<AuthResult> {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
}

export function loginUser(email: string, password: string): Promise<AuthResult> {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function fetchCurrentUser(): Promise<AuthUser> {
  return request('/auth/me');
}
