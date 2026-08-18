import { apiClient } from './apiClient';

/** Mirrors backend `CurrentUser` (app/auth/dto/auth_dto.py) — identity derived from the verified Supabase token. */
export interface CurrentUser {
  id: string;
  email: string | null;
  role: string | null;
}

export function fetchCurrentUser(): Promise<CurrentUser> {
  return apiClient.get<CurrentUser>('/auth/me');
}
