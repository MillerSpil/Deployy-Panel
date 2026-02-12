import { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { serversApi } from '@/api/servers';
import { minecraftApi, type MinecraftVersion, type PaperVersion } from '@/api/minecraft';
import { HytaleDownloadModal } from './HytaleDownloadModal';
import type { GameType, MinecraftFlavor } from '@deployy/shared';

interface CreateServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateServerModal({ isOpen, onClose, onCreated }: CreateServerModalProps) {
  const [formData, setFormData] = useState({
    name: 'My Hytale Server',
    gameType: 'hytale' as GameType,
    path: 'C:\\DeployyServers\\hytale-server',
    port: 5520,
    maxPlayers: 100,
    autoDownload: false,
    flavor: 'paper' as MinecraftFlavor,
    version: 'latest',
    ram: 6,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadModal, setDownloadModal] = useState<{ serverId: string; serverName: string } | null>(null);

  // Minecraft version state
  const [vanillaVersions, setVanillaVersions] = useState<MinecraftVersion[]>([]);
  const [paperVersions, setPaperVersions] = useState<PaperVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [versionError, setVersionError] = useState<string | null>(null);

  // Fetch versions when Minecraft is selected
  useEffect(() => {
    if (formData.gameType === 'minecraft' && isOpen) {
      setLoadingVersions(true);
      setVersionError(null);
      Promise.all([
        minecraftApi.getVanillaVersions(),
        minecraftApi.getPaperVersions(),
      ])
        .then(([vanilla, paper]) => {
          setVanillaVersions(vanilla.versions);
          setPaperVersions(paper.versions);
        })
        .catch((err) => {
          console.error('Failed to load versions:', err);
          setVersionError('Failed to load version list. You can still use "Latest" or try again.');
        })
        .finally(() => {
          setLoadingVersions(false);
        });
    }
  }, [formData.gameType, isOpen]);

  // Update defaults when game type changes
  useEffect(() => {
    if (formData.gameType === 'minecraft') {
      setFormData((prev) => ({
        ...prev,
        name: prev.name === 'My Hytale Server' ? 'My Minecraft Server' : prev.name,
        path: prev.path === 'C:\\DeployyServers\\hytale-server' ? 'C:\\DeployyServers\\minecraft-server' : prev.path,
        port: 25565,
        maxPlayers: 20,
        ram: 4,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        name: prev.name === 'My Minecraft Server' ? 'My Hytale Server' : prev.name,
        path: prev.path === 'C:\\DeployyServers\\minecraft-server' ? 'C:\\DeployyServers\\hytale-server' : prev.path,
        port: 5520,
        maxPlayers: 100,
        ram: 6,
      }));
    }
  }, [formData.gameType]);

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
      const createData: Parameters<typeof serversApi.create>[0] = {
        name: formData.name,
        gameType: formData.gameType,
        path: formData.path,
        port: formData.port,
        maxPlayers: formData.maxPlayers,
        ram: formData.ram,
      };

      // Add Minecraft-specific fields
      if (formData.gameType === 'minecraft') {
        createData.flavor = formData.flavor;
        createData.version = formData.version;
      } else if (formData.gameType === 'hytale') {
        createData.autoDownload = formData.autoDownload;
      }

      const server = await serversApi.create(createData);

      // If auto-download is enabled for Hytale, show download modal
      if (formData.autoDownload && formData.gameType === 'hytale') {
        setDownloadModal({ serverId: server.id, serverName: server.name });
      } else {
        resetForm();
        onCreated();
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create server');
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: 'My Hytale Server',
      gameType: 'hytale',
      path: 'C:\\DeployyServers\\hytale-server',
      port: 5520,
      maxPlayers: 100,
      autoDownload: false,
      flavor: 'paper',
      version: 'latest',
      ram: 6,
    });
  };

  const handleDownloadComplete = () => {
    setDownloadModal(null);
    resetForm();
    setLoading(false);
    onCreated();
    onClose();
  };

  const getVersionOptions = () => {
    if (formData.flavor === 'vanilla') {
      return vanillaVersions.slice(0, 20).map((v) => (
        <option key={v.id} value={v.id}>
          {v.id}
        </option>
      ));
    }
    return paperVersions.map((v) => (
      <option key={v.version} value={v.version}>
        {v.version} ({v.builds.length} builds)
      </option>
    ));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Server">
      <form onSubmit={handleSubmit}>
        <Input
          label="Server Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />

        <Input
          label="Server Path"
          value={formData.path}
          onChange={(e) => setFormData({ ...formData, path: e.target.value })}
          required
        />

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-1">Game</label>
          <select
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            value={formData.gameType}
            onChange={(e) => setFormData({ ...formData, gameType: e.target.value as GameType })}
          >
            <option value="hytale">Hytale</option>
            <option value="minecraft">Minecraft</option>
          </select>
        </div>

        {/* Minecraft-specific options */}
        {formData.gameType === 'minecraft' && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-1">Server Type</label>
              <select
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                value={formData.flavor}
                onChange={(e) => setFormData({ ...formData, flavor: e.target.value as MinecraftFlavor, version: 'latest' })}
              >
                <option value="paper">Paper (Recommended)</option>
                <option value="vanilla">Vanilla</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">
                {formData.flavor === 'paper'
                  ? 'Paper is optimized for performance and supports plugins'
                  : 'Official Mojang server, no plugin support'}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-1">Version</label>
              <select
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                value={formData.version}
                onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                disabled={loadingVersions}
              >
                <option value="latest">Latest</option>
                {getVersionOptions()}
              </select>
              {loadingVersions && <p className="text-xs text-slate-500 mt-1">Loading versions...</p>}
              {versionError && <p className="text-xs text-amber-400 mt-1">{versionError}</p>}
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-4">
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
        </div>

        {/* RAM selector for all game types */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-1">RAM (GB)</label>
          <input
            type="number"
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            value={formData.ram}
            onChange={(e) => setFormData({ ...formData, ram: Math.max(1, Math.min(64, parseInt(e.target.value) || 1)) })}
            min={1}
            max={64}
            step={1}
            required
          />
          <p className="text-xs text-slate-500 mt-1">
            {formData.gameType === 'minecraft'
              ? 'Recommended: 4GB+ for small servers, 8GB+ for larger servers'
              : 'Recommended: 6GB+ for Hytale servers'}
          </p>
        </div>

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

        {/* Minecraft auto-downloads note */}
        {formData.gameType === 'minecraft' && (
          <div className="mb-4 bg-slate-700/30 rounded-lg p-3">
            <p className="text-sm text-slate-400">
              The server JAR will be downloaded automatically from{' '}
              {formData.flavor === 'paper' ? 'PaperMC' : 'Mojang'}.
            </p>
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
