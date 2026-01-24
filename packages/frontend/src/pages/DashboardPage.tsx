import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useServers } from '@/hooks/useServers';
import { usePermissions } from '@/hooks/usePermissions';
import { ServerList } from '@/components/servers/ServerList';
import { CreateServerModal } from '@/components/servers/CreateServerModal';
import { Button } from '@/components/common/Button';
import { serversApi } from '@/api/servers';

export function DashboardPage() {
  const navigate = useNavigate();
  const { servers, loading, error, refetch } = useServers();
  const { canCreateServer } = usePermissions();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const handleStart = async (id: string) => {
    try {
      await serversApi.start(id);
      refetch();
    } catch (err) {
      console.error('Failed to start server:', err);
    }
  };

  const handleStop = async (id: string) => {
    try {
      await serversApi.stop(id);
      refetch();
    } catch (err) {
      console.error('Failed to stop server:', err);
    }
  };

  const handleView = (id: string) => {
    navigate(`/servers/${id}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-slate-400">Loading servers...</p>
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
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-100">Servers</h1>
        {canCreateServer && (
          <Button onClick={() => setIsCreateModalOpen(true)}>Create Server</Button>
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
