import { apiRequest } from './client';
import type { UserWithRole } from '@deployy/shared';

export const usersApi = {
  list: () => apiRequest<UserWithRole[]>('/users'),

  get: (id: string) => apiRequest<UserWithRole>(`/users/${id}`),

  create: (data: { email: string; password: string; roleId?: string }) =>
    apiRequest<UserWithRole>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: { email?: string; roleId?: string | null }) =>
    apiRequest<UserWithRole>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiRequest<void>(`/users/${id}`, {
      method: 'DELETE',
    }),
};
