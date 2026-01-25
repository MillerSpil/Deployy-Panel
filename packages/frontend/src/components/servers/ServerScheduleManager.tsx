import { useState, useEffect } from 'react';
import { schedulesApi } from '@/api/schedules';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import type {
  ScheduledTask,
  ScheduledTaskType,
  ScheduleId,
  ScheduledTaskConfig,
} from '@deployy/shared';
import { SCHEDULE_OPTIONS, SCHEDULED_TASK_TYPES } from '@deployy/shared';

interface ServerScheduleManagerProps {
  serverId: string;
}

const TASK_TYPE_LABELS: Record<ScheduledTaskType, string> = {
  restart: 'Auto Restart',
  backup: 'Scheduled Backup',
  command: 'Run Command',
};

const TASK_TYPE_ICONS: Record<ScheduledTaskType, () => JSX.Element> = {
  restart: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  backup: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
    </svg>
  ),
  command: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
};

function getScheduleLabel(scheduleId: ScheduleId): string {
  const option = SCHEDULE_OPTIONS.find((opt) => opt.id === scheduleId);
  return option?.label || scheduleId;
}

function formatDate(date: Date | string | null): string {
  if (!date) return 'Never';
  return new Date(date).toLocaleString();
}

export function ServerScheduleManager({ serverId }: ServerScheduleManagerProps) {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [deletingTask, setDeletingTask] = useState<ScheduledTask | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingInProgress, setDeletingInProgress] = useState(false);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const data = await schedulesApi.list(serverId);
      setTasks(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch scheduled tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [serverId]);

  const handleToggle = async (task: ScheduledTask) => {
    try {
      setTogglingId(task.id);
      setError(null);
      await schedulesApi.toggle(serverId, task.id);
      await fetchTasks();
      setSuccess(`Task ${task.enabled ? 'disabled' : 'enabled'}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle task');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingTask) return;
    try {
      setDeletingInProgress(true);
      setError(null);
      await schedulesApi.delete(serverId, deletingTask.id);
      setDeletingTask(null);
      setSuccess('Task deleted');
      await fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
    } finally {
      setDeletingInProgress(false);
    }
  };

  const dismissMessages = () => {
    setError(null);
    setSuccess(null);
  };

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <p className="text-slate-400">Loading scheduled tasks...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Scheduled Tasks</h2>
          <p className="text-sm text-slate-400 mt-1">
            Automate server restarts, backups, and commands
          </p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          Add Task
        </Button>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-3 mb-4 flex justify-between items-start">
          <p className="text-red-400">{error}</p>
          <button onClick={dismissMessages} className="text-red-400 hover:text-red-300 ml-2">
            <CloseIcon />
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-900/50 border border-green-500 rounded-lg p-3 mb-4 flex justify-between items-start">
          <p className="text-green-400">{success}</p>
          <button onClick={dismissMessages} className="text-green-400 hover:text-green-300 ml-2">
            <CloseIcon />
          </button>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="bg-slate-700/50 rounded-lg p-8 text-center">
          <p className="text-slate-400">No scheduled tasks yet. Add a task to automate server operations.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const IconComponent = TASK_TYPE_ICONS[task.type];
            return (
              <div
                key={task.id}
                className={`flex items-center justify-between rounded-lg p-4 ${
                  task.enabled ? 'bg-slate-700' : 'bg-slate-700/50'
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`${task.enabled ? 'text-primary-400' : 'text-slate-500'}`}>
                    <IconComponent />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-medium ${task.enabled ? 'text-slate-100' : 'text-slate-400'}`}>
                        {TASK_TYPE_LABELS[task.type]}
                      </p>
                      {!task.enabled && (
                        <span className="text-xs bg-slate-600 text-slate-400 px-2 py-0.5 rounded">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400">
                      {getScheduleLabel(task.schedule)}
                      {task.type === 'command' && task.config.command && (
                        <span className="ml-2 text-slate-500">
                          &middot; <code className="text-xs">{task.config.command}</code>
                        </span>
                      )}
                      {task.type === 'backup' && task.config.backupName && (
                        <span className="ml-2 text-slate-500">
                          &middot; "{task.config.backupName}"
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Last run: {formatDate(task.lastRun)} &middot; Next: {formatDate(task.nextRun)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="secondary"
                    onClick={() => handleToggle(task)}
                    disabled={togglingId === task.id}
                    title={task.enabled ? 'Disable task' : 'Enable task'}
                  >
                    {togglingId === task.id ? (
                      <Spinner />
                    ) : task.enabled ? (
                      <PauseIcon />
                    ) : (
                      <PlayIcon />
                    )}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setEditingTask(task)}
                    title="Edit task"
                  >
                    <EditIcon />
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => setDeletingTask(task)}
                    title="Delete task"
                  >
                    <DeleteIcon />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateEditTaskModal
        isOpen={isCreateModalOpen || !!editingTask}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingTask(null);
        }}
        serverId={serverId}
        task={editingTask}
        onSaved={() => {
          setIsCreateModalOpen(false);
          setEditingTask(null);
          fetchTasks();
          setSuccess(editingTask ? 'Task updated' : 'Task created');
        }}
      />

      <Modal
        isOpen={!!deletingTask}
        onClose={() => !deletingInProgress && setDeletingTask(null)}
        title="Delete Scheduled Task"
      >
        {deletingInProgress ? (
          <div className="py-8 text-center">
            <div className="flex justify-center mb-4">
              <SpinnerLarge />
            </div>
            <p className="text-slate-300">Deleting task...</p>
          </div>
        ) : (
          <>
            <p className="text-slate-300 mb-4">
              Are you sure you want to delete the <strong>{deletingTask && TASK_TYPE_LABELS[deletingTask.type]}</strong> task?
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setDeletingTask(null)} className="flex-1">
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDelete} className="flex-1">
                Delete
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

interface CreateEditTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverId: string;
  task: ScheduledTask | null;
  onSaved: () => void;
}

function CreateEditTaskModal({ isOpen, onClose, serverId, task, onSaved }: CreateEditTaskModalProps) {
  const [type, setType] = useState<ScheduledTaskType>('restart');
  const [schedule, setSchedule] = useState<ScheduleId>('every_6h');
  const [enabled, setEnabled] = useState(true);
  const [command, setCommand] = useState('');
  const [backupName, setBackupName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!task;

  useEffect(() => {
    if (task) {
      setType(task.type);
      setSchedule(task.schedule);
      setEnabled(task.enabled);
      setCommand(task.config.command || '');
      setBackupName(task.config.backupName || '');
    } else {
      setType('restart');
      setSchedule('every_6h');
      setEnabled(true);
      setCommand('');
      setBackupName('');
    }
    setError(null);
  }, [task, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const config: ScheduledTaskConfig = {};
      if (type === 'command') {
        if (!command.trim()) {
          setError('Command is required');
          setSaving(false);
          return;
        }
        config.command = command.trim();
      }
      if (type === 'backup' && backupName.trim()) {
        config.backupName = backupName.trim();
      }

      if (isEditing) {
        await schedulesApi.update(serverId, task.id, {
          schedule,
          enabled,
          config,
        });
      } else {
        await schedulesApi.create(serverId, {
          type,
          schedule,
          enabled,
          config,
        });
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Task' : 'Add Scheduled Task'}>
      <form onSubmit={handleSubmit}>
        {!isEditing && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Task Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ScheduledTaskType)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100"
            >
              {SCHEDULED_TASK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TASK_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Schedule
          </label>
          <select
            value={schedule}
            onChange={(e) => setSchedule(e.target.value as ScheduleId)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100"
          >
            {SCHEDULE_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {type === 'command' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Command
            </label>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="e.g., say Server restarting in 5 minutes"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 font-mono text-sm"
              maxLength={500}
            />
            <p className="text-slate-500 text-sm mt-1">
              The command to send to the server console.
            </p>
          </div>
        )}

        {type === 'backup' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Backup Name (optional)
            </label>
            <input
              type="text"
              value={backupName}
              onChange={(e) => setBackupName(e.target.value)}
              placeholder="e.g., Scheduled Backup"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500"
              maxLength={100}
            />
            <p className="text-slate-500 text-sm mt-1">
              Leave empty for automatic timestamp name.
            </p>
          </div>
        )}

        <div className="mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-primary-500 focus:ring-primary-500"
            />
            <span className="text-sm text-slate-300">Enabled</span>
          </label>
        </div>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" disabled={saving} className="flex-1">
            {saving ? 'Saving...' : isEditing ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function PlayIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function SpinnerLarge() {
  return (
    <svg className="animate-spin h-8 w-8 text-primary-400" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}
