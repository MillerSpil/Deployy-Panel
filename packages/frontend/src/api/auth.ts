import { apiRequest } from './client';
import type { AuthUser, AuthStatus } from '@deployy/shared';

interface SetupStatusResponse {
  needsSetup: boolean;
}

interface RegisterResponse {
  user: AuthUser;
  message: string;
}

interface LoginResponse {
  user: AuthUser;
  message: string;
}

interface LogoutResponse {
  message: string;
}

export const authApi = {
  setupStatus: () => apiRequest<SetupStatusResponse>('/auth/setup-status'),

  register: (email: string, password: string) =>
    apiRequest<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  login: (email: string, password: string) =>
    apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    apiRequest<LogoutResponse>('/auth/logout', {
      method: 'POST',
    }),

  me: () => apiRequest<AuthStatus>('/auth/me'),
};
