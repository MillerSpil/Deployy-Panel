import { apiRequest } from './client';
import type {
  ScheduledTask,
  CreateScheduledTaskInput,
  UpdateScheduledTaskInput,
} from '@deployy/shared';

export const schedulesApi = {
  list: (serverId: string) =>
    apiRequest<ScheduledTask[]>(`/servers/${serverId}/schedules`),

  get: (serverId: string, taskId: string) =>
    apiRequest<ScheduledTask>(`/servers/${serverId}/schedules/${taskId}`),

  create: (serverId: string, data: CreateScheduledTaskInput) =>
    apiRequest<ScheduledTask>(`/servers/${serverId}/schedules`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (serverId: string, taskId: string, data: UpdateScheduledTaskInput) =>
    apiRequest<ScheduledTask>(`/servers/${serverId}/schedules/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  toggle: (serverId: string, taskId: string) =>
    apiRequest<ScheduledTask>(`/servers/${serverId}/schedules/${taskId}/toggle`, {
      method: 'POST',
    }),

  delete: (serverId: string, taskId: string) =>
    apiRequest<void>(`/servers/${serverId}/schedules/${taskId}`, {
      method: 'DELETE',
    }),
};
