import { useState } from 'react';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { serversApi } from '@/api/servers';
import { HytaleDownloadModal } from './HytaleDownloadModal';

interface CreateServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateServerModal({ isOpen, onClose, onCreated }: CreateServerModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    gameType: 'hytale',
    path: '',
    port: 5520,
    maxPlayers: 100,
    autoDownload: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadModal, setDownloadModal] = useState<{ serverId: string; serverName: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!formData.path.trim()) {
      setError('Server path is required');
      setLoading(false);
      return;
    }

    try {
      const server = await serversApi.create(formData);

      // If auto-download is enabled for Hytale, show download modal
      if (formData.autoDownload && formData.gameType === 'hytale') {
        // Don't start download here - let the modal do it after mounting
        setDownloadModal({ serverId: server.id, serverName: server.name });
      } else {
        setFormData({ name: '', gameType: 'hytale', path: '', port: 5520, maxPlayers: 100, autoDownload: false });
        onCreated();
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create server');
      setLoading(false);
    }
  };

  const handleDownloadComplete = () => {
    setDownloadModal(null);
    setFormData({ name: '', gameType: 'hytale', path: '', port: 5520, maxPlayers: 100, autoDownload: false });
    setLoading(false);
    onCreated();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Server">
      <form onSubmit={handleSubmit}>
        <Input
          label="Server Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="My Hytale Server"
          required
        />

        <Input
          label="Server Path"
          value={formData.path}
          onChange={(e) => setFormData({ ...formData, path: e.target.value })}
          placeholder="C:\DeployyServers\my-server"
          required
        />

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-1">Game Type</label>
          <select
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            value={formData.gameType}
            onChange={(e) => setFormData({ ...formData, gameType: e.target.value })}
          >
            <option value="hytale">Hytale</option>
            <option value="minecraft" disabled>
              Minecraft (Coming Soon)
            </option>
          </select>
        </div>

        <Input
          label="Port"
          type="number"
          value={formData.port}
          onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
          min={1024}
          max={65535}
          required
        />

        <Input
          label="Max Players"
          type="number"
          value={formData.maxPlayers}
          onChange={(e) => setFormData({ ...formData, maxPlayers: parseInt(e.target.value) })}
          min={1}
          max={1000}
          required
        />

        {/* Auto-download checkbox - only for Hytale */}
        {formData.gameType === 'hytale' && (
          <div className="mb-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.autoDownload}
                onChange={(e) => setFormData({ ...formData, autoDownload: e.target.checked })}
                className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-primary-500 focus:ring-primary-500 focus:ring-offset-slate-800"
              />
              <div>
                <span className="text-sm font-medium text-slate-300">Auto-download server files</span>
                <p className="text-xs text-slate-500">
                  Download HytaleServer.jar and Assets automatically from Hytale servers
                </p>
              </div>
            </label>
          </div>
        )}

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={loading} className="flex-1">
            {loading ? 'Creating...' : 'Create Server'}
          </Button>
        </div>
      </form>

      {/* Download Progress Modal */}
      {downloadModal && (
        <HytaleDownloadModal
          isOpen={true}
          onClose={handleDownloadComplete}
          serverId={downloadModal.serverId}
          serverName={downloadModal.serverName}
          startDownload={() => serversApi.startDownload(downloadModal.serverId)}
        />
      )}
    </Modal>
  );
}
