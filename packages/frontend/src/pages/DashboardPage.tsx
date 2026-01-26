import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useServers } from '@/hooks/useServers';
import { usePermissions } from '@/hooks/usePermissions';
import { ServerList } from '@/components/servers/ServerList';
import { CreateServerModal } from '@/components/servers/CreateServerModal';
import { Button } from '@/components/common/Button';
import { serversApi } from '@/api/servers';

function SpinnerLarge() {
  return (
    <svg className="animate-spin h-8 w-8 text-primary-400" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { servers, loading, error, refetch } = useServers();
  const { canCreateServer } = usePermissions();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const handleStart = async (id: string) => {
    try {
      await serversApi.start(id);
      refetch();
    } catch {
      // Error handled by API client (5xx logged, 4xx shown in UI)
    }
  };

  const handleStop = async (id: string) => {
    try {
      await serversApi.stop(id);
      refetch();
    } catch {
      // Error handled by API client (5xx logged, 4xx shown in UI)
    }
  };

  const handleView = (id: string) => {
    navigate(`/servers/${id}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64">
        <SpinnerLarge />
        <p className="text-slate-400 mt-4">Loading servers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-red-400">Error: {error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-100">Servers</h1>
        {canCreateServer && (
          <Button onClick={() => setIsCreateModalOpen(true)} className="w-full sm:w-auto">Create Server</Button>
        )}
      </div>

      <ServerList servers={servers} onStart={handleStart} onStop={handleStop} onView={handleView} />

      <CreateServerModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={refetch}
      />
    </div>
  );
}
