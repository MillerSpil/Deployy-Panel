import { apiRequest } from './client';
import type { Role, PanelPermission } from '@deployy/shared';

export const rolesApi = {
  list: () => apiRequest<Role[]>('/roles'),

  get: (id: string) => apiRequest<Role>(`/roles/${id}`),

  create: (data: { name: string; description?: string; permissions: PanelPermission[] }) =>
    apiRequest<Role>('/roles', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (
    id: string,
    data: { name?: string; description?: string | null; permissions?: PanelPermission[] }
  ) =>
    apiRequest<Role>(`/roles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiRequest<void>(`/roles/${id}`, {
      method: 'DELETE',
    }),
};
