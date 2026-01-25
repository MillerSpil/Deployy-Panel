import { useState, useEffect, useCallback, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { filesApi } from '@/api/files';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { Input } from '@/components/common/Input';
import type { FileInfo } from '@deployy/shared';
import { TEXT_EXTENSIONS, BINARY_EXTENSIONS } from '@deployy/shared';

interface ServerFileManagerProps {
  serverId: string;
}

export function ServerFileManager({ serverId }: ServerFileManagerProps) {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [createType, setCreateType] = useState<'file' | 'directory'>('file');
  const [newName, setNewName] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  // Drag and drop
  const [isDragging, setIsDragging] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async (path: string = '') => {
    try {
      setLoading(true);
      setError(null);
      const response = await filesApi.list(serverId, path);
      setFiles(response.files);
      setCurrentPath(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const navigateToPath = (path: string) => {
    setSelectedFile(null);
    setFileContent(null);
    setEditedContent(null);
    fetchFiles(path);
  };

  const navigateUp = () => {
    if (!currentPath) return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    navigateToPath(parts.join('/'));
  };

  // Single click selects, double click opens folders
  const handleFileClick = (file: FileInfo) => {
    setSelectedFile(file);

    // For files, load content if not binary
    if (file.type === 'file') {
      loadFileContent(file);
    } else {
      // For directories, clear file content
      setFileContent(null);
      setEditedContent(null);
    }
  };

  const handleFileDoubleClick = (file: FileInfo) => {
    if (file.type === 'directory') {
      navigateToPath(file.path);
    }
  };

  const loadFileContent = async (file: FileInfo) => {
    const isBinary = file.extension && BINARY_EXTENSIONS.includes(file.extension as any);

    if (isBinary) {
      setFileContent(null);
      setEditedContent(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await filesApi.read(serverId, file.path);
      setFileContent(response.content);
      setEditedContent(response.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read file');
      setFileContent(null);
      setEditedContent(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchFiles(currentPath);
  };

  const handleSave = async () => {
    if (!selectedFile || editedContent === null) return;

    try {
      setSaving(true);
      setError(null);
      await filesApi.write(serverId, selectedFile.path, editedContent);
      setFileContent(editedContent);
      setSuccess('File saved successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save file');
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;

    try {
      setModalLoading(true);
      setError(null);
      const path = currentPath ? `${currentPath}/${newName}` : newName;
      await filesApi.create(serverId, path, createType);
      setSuccess(`${createType === 'directory' ? 'Folder' : 'File'} created`);
      setIsCreateModalOpen(false);
      setNewName('');
      fetchFiles(currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setModalLoading(false);
    }
  };

  const handleRename = async () => {
    if (!selectedFile || !newName.trim()) return;

    try {
      setModalLoading(true);
      setError(null);
      const renamedFile = await filesApi.rename(serverId, selectedFile.path, newName);
      setSuccess('Renamed successfully');
      setIsRenameModalOpen(false);
      setNewName('');
      setSelectedFile(renamedFile);
      fetchFiles(currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedFile) return;

    try {
      setModalLoading(true);
      setError(null);
      await filesApi.delete(serverId, selectedFile.path);
      setSuccess('Deleted successfully');
      setIsDeleteModalOpen(false);
      setSelectedFile(null);
      setFileContent(null);
      setEditedContent(null);
      fetchFiles(currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDownload = () => {
    if (!selectedFile) return;
    const url = filesApi.getDownloadUrl(serverId, selectedFile.path);
    window.open(url, '_blank');
  };

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    try {
      setError(null);
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        await filesApi.upload(serverId, currentPath, file);
      }
      setSuccess(`Uploaded ${fileList.length} file(s)`);
      fetchFiles(currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload');
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === dropZoneRef.current) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleUpload(e.dataTransfer.files);
  };

  const getLanguage = (extension?: string): string => {
    if (!extension) return 'plaintext';
    return TEXT_EXTENSIONS[extension] || 'plaintext';
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString();
  };

  const formatDateShort = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const breadcrumbs = currentPath ? currentPath.split('/').filter(Boolean) : [];
  const hasUnsavedChanges = fileContent !== null && editedContent !== fileContent;
  const isBinaryFile = selectedFile?.extension && BINARY_EXTENSIONS.includes(selectedFile.extension as any);

  return (
    <div
      ref={dropZoneRef}
      className="bg-slate-800 rounded-lg border border-slate-700"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-primary-500/20 border-2 border-dashed border-primary-400 rounded-lg z-50 flex items-center justify-center">
          <p className="text-primary-400 text-lg font-medium">Drop files to upload</p>
        </div>
      )}

      {/* Header with messages */}
      <div className="p-4 border-b border-slate-700">
        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-3 mb-4 flex justify-between items-center">
            <p className="text-red-400">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
              &times;
            </button>
          </div>
        )}
        {success && (
          <div className="bg-green-900/50 border border-green-500 rounded-lg p-3 mb-4">
            <p className="text-green-400">{success}</p>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={handleRefresh} disabled={loading}>
            Refresh
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setCreateType('file');
              setNewName('');
              setIsCreateModalOpen(true);
            }}
          >
            New File
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setCreateType('directory');
              setNewName('');
              setIsCreateModalOpen(true);
            }}
          >
            New Folder
          </Button>
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            Upload
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
          {selectedFile && (
            <>
              <Button variant="secondary" onClick={handleDownload}>
                Download
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setNewName(selectedFile.name);
                  setIsRenameModalOpen(true);
                }}
              >
                Rename
              </Button>
              <Button variant="danger" onClick={() => setIsDeleteModalOpen(true)}>
                Delete
              </Button>
            </>
          )}
          {hasUnsavedChanges && (
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          )}
        </div>
      </div>

      {/* Breadcrumb navigation */}
      <div className="px-4 py-2 border-b border-slate-700 flex items-center gap-1 text-sm">
        <button
          onClick={() => navigateToPath('')}
          className="text-primary-400 hover:text-primary-300"
        >
          Root
        </button>
        {breadcrumbs.map((crumb, index) => (
          <span key={index} className="flex items-center gap-1">
            <span className="text-slate-500">/</span>
            <button
              onClick={() => navigateToPath(breadcrumbs.slice(0, index + 1).join('/'))}
              className="text-primary-400 hover:text-primary-300"
            >
              {crumb}
            </button>
          </span>
        ))}
      </div>

      {/* Main content */}
      <div className="flex h-[600px]">
        {/* File list */}
        <div className="w-1/3 border-r border-slate-700 overflow-y-auto">
          {loading && !files.length ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin h-6 w-6 border-2 border-primary-400 rounded-full border-t-transparent" />
            </div>
          ) : (
            <div>
              {/* Always show ".." when in a subdirectory */}
              {currentPath && (
                <button
                  onClick={navigateUp}
                  className="w-full px-3 py-2 flex items-center gap-2 hover:bg-slate-700/50 text-left border-b border-slate-700/50"
                >
                  <FolderUpIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-slate-400">..</span>
                </button>
              )}
              {files.length === 0 ? (
                <div className="p-4 text-slate-500 text-center">
                  <p>Empty directory</p>
                  <p className="text-sm mt-2">Drag files here or use the Upload button</p>
                </div>
              ) : (
                files.map((file) => (
                  <button
                    key={file.path}
                    onClick={() => handleFileClick(file)}
                    onDoubleClick={() => handleFileDoubleClick(file)}
                    className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-slate-700/50 text-left ${
                      selectedFile?.path === file.path ? 'bg-slate-700' : ''
                    }`}
                  >
                    {file.type === 'directory' ? (
                      <FolderIcon className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                    ) : (
                      <FileIcon className="w-4 h-4 flex-shrink-0" extension={file.extension} />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-200 truncate">{file.name}</div>
                      <div className="text-slate-500 text-xs">
                        {file.type === 'file' ? formatSize(file.size) + ' · ' : ''}
                        {formatDateShort(file.modified)}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Editor/Preview panel */}
        <div className="flex-1 flex flex-col">
          {selectedFile ? (
            <>
              {/* File info bar */}
              <div className="px-4 py-2 border-b border-slate-700 flex items-center justify-between text-sm">
                <span className="text-slate-200 font-medium">{selectedFile.name}</span>
                <span className="text-slate-500">
                  {formatSize(selectedFile.size)} | {formatDate(selectedFile.modified)}
                </span>
              </div>

              {/* Editor or message */}
              <div className="flex-1">
                {isBinaryFile ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500">
                    <BinaryIcon className="w-12 h-12 mb-4" />
                    <p>Binary file - cannot be edited</p>
                    <Button variant="secondary" className="mt-4" onClick={handleDownload}>
                      Download File
                    </Button>
                  </div>
                ) : fileContent !== null ? (
                  <Editor
                    height="100%"
                    language={getLanguage(selectedFile.extension)}
                    value={editedContent || ''}
                    onChange={(value) => setEditedContent(value || '')}
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      wordWrap: 'on',
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                    }}
                  />
                ) : loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin h-6 w-6 border-2 border-primary-400 rounded-full border-t-transparent" />
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500">
              <p>Select a file to view or edit</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={createType === 'directory' ? 'New Folder' : 'New File'}
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={createType === 'directory' ? 'folder-name' : 'filename.txt'}
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreate} disabled={!newName.trim() || modalLoading}>
              {modalLoading ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Rename Modal */}
      <Modal isOpen={isRenameModalOpen} onClose={() => setIsRenameModalOpen(false)} title="Rename">
        <div className="space-y-4">
          <Input
            label="New name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setIsRenameModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleRename} disabled={!newName.trim() || modalLoading}>
              {modalLoading ? 'Renaming...' : 'Rename'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Confirm Delete">
        <div className="space-y-4">
          <p className="text-slate-300">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-slate-100">{selectedFile?.name}</span>?
          </p>
          {selectedFile?.type === 'directory' && (
            <p className="text-yellow-400 text-sm">
              This will delete all files and folders inside this directory.
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={modalLoading}>
              {modalLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Icon components
function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    </svg>
  );
}

function FolderUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11v6m0-6l-3 3m3-3l3 3" />
    </svg>
  );
}

function FileIcon({ className, extension }: { className?: string; extension?: string }) {
  const isBinary = extension && BINARY_EXTENSIONS.includes(extension as any);
  const color = isBinary ? 'text-orange-400' : 'text-slate-400';

  return (
    <svg className={`${className} ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function BinaryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  );
}
