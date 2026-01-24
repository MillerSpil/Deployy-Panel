import { useState, useEffect, useCallback } from 'react';
import { serversApi } from '@/api/servers';
import { Button } from '@/components/common/Button';
import type { GameConfig } from '@deployy/shared';

interface ServerConfigEditorProps {
  serverId: string;
  serverStatus: string;
}

export function ServerConfigEditor({ serverId, serverStatus }: ServerConfigEditorProps) {
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [originalConfig, setOriginalConfig] = useState<GameConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);

  const isRunning = serverStatus === 'running';
  const hasChanges = JSON.stringify(config) !== JSON.stringify(originalConfig);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await serversApi.getConfig(serverId);
      setConfig(response.config);
      setOriginalConfig(response.config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load config');
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    if (!config) return;

    try {
      setSaving(true);
      setError(null);
      setSaveMessage(null);
      const response = await serversApi.updateConfig(serverId, config);
      setOriginalConfig(response.config);
      setSaveMessage(response.restartRequired ? 'Settings saved. Restart the server to apply changes.' : 'Settings saved successfully.');
      setTimeout(() => setSaveMessage(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save config');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setConfig(originalConfig);
  };

  const updateValue = (path: string[], value: unknown) => {
    if (!config) return;

    const newConfig = JSON.parse(JSON.stringify(config));
    let current: Record<string, unknown> = newConfig;

    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]] as Record<string, unknown>;
    }

    current[path[path.length - 1]] = value;
    setConfig(newConfig);
  };

  const deleteField = (path: string[]) => {
    if (!config || path.length === 0) return;

    const newConfig = JSON.parse(JSON.stringify(config));
    let current: Record<string, unknown> = newConfig;

    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]] as Record<string, unknown>;
    }

    delete current[path[path.length - 1]];
    setConfig(newConfig);
  };

  const addField = (path: string[], key: string, type: string) => {
    if (!config) return;

    const newConfig = JSON.parse(JSON.stringify(config));
    let current: Record<string, unknown> = newConfig;

    for (const p of path) {
      current = current[p] as Record<string, unknown>;
    }

    let value: unknown = '';
    if (type === 'number') value = 0;
    if (type === 'boolean') value = false;
    if (type === 'object') value = {};
    if (type === 'array') value = [];

    current[key] = value;
    setConfig(newConfig);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <p className="text-slate-400">Loading configuration...</p>
      </div>
    );
  }

  if (error && !config) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="text-center">
          <p className="text-red-400 mb-2">{error}</p>
          <Button onClick={fetchConfig} variant="secondary">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex justify-center items-center h-32">
        <p className="text-slate-400">No configuration found</p>
      </div>
    );
  }

  return (
    <div>
      {isRunning && (
        <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-4 mb-4">
          <p className="text-amber-200 text-sm">
            The server is currently running. Changes will require a restart to take effect.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-4">
          <p className="text-red-200 text-sm">{error}</p>
        </div>
      )}

      {saveMessage && (
        <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 mb-4">
          <p className="text-green-200 text-sm">{saveMessage}</p>
        </div>
      )}

      {/* View Toggle */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowJson(!showJson)}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <CodeIcon />
          {showJson ? 'Editor View' : 'View JSON'}
        </button>
      </div>

      {showJson ? (
        <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
          <pre className="text-slate-300 whitespace-pre-wrap">
            {JSON.stringify(config, null, 2)}
          </pre>
        </div>
      ) : (
        <div className="space-y-6">
          <ConfigSection
            data={config}
            path={[]}
            onChange={updateValue}
            onDelete={deleteField}
            onAddField={addField}
            isRoot
          />
        </div>
      )}

      <div className="flex gap-2 mt-6 pt-4 border-t border-slate-700">
        <Button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={!hasChanges ? 'opacity-50 cursor-not-allowed' : ''}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
        <Button
          onClick={handleReset}
          variant="secondary"
          disabled={!hasChanges || saving}
          className={!hasChanges ? 'opacity-50 cursor-not-allowed' : ''}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}

// Icons
function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

interface ConfigSectionProps {
  data: Record<string, unknown>;
  path: string[];
  onChange: (path: string[], value: unknown) => void;
  onDelete: (path: string[]) => void;
  onAddField: (path: string[], key: string, type: string) => void;
  title?: string;
  isRoot?: boolean;
}

function ConfigSection({ data, path, onChange, onDelete, onAddField, title, isRoot }: ConfigSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [showAddField, setShowAddField] = useState(false);

  const entries = Object.entries(data);
  const isEmpty = entries.length === 0;

  const content = (
    <div className="space-y-4">
      {isEmpty ? (
        <p className="text-slate-500 text-sm py-2">No additional settings</p>
      ) : (
        entries.map(([key, value]) => (
          <ConfigField
            key={key}
            fieldKey={key}
            value={value}
            path={[...path, key]}
            onChange={onChange}
            onDelete={onDelete}
            onAddField={onAddField}
          />
        ))
      )}

      {/* Add Field Button */}
      {showAddField ? (
        <AddFieldForm
          onAdd={(key, type) => {
            onAddField(path, key, type);
            setShowAddField(false);
          }}
          onCancel={() => setShowAddField(false)}
          existingKeys={Object.keys(data)}
        />
      ) : (
        <button
          onClick={() => setShowAddField(true)}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-primary-400 transition-colors"
        >
          <PlusIcon />
          Add Field
        </button>
      )}
    </div>
  );

  if (isRoot) {
    return content;
  }

  return (
    <div className="border border-slate-600 rounded-lg overflow-hidden bg-slate-800/30">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 p-3 bg-slate-700/30 hover:bg-slate-700/50 transition-colors text-left"
      >
        <ChevronIcon expanded={!collapsed} />
        <span className="text-slate-200 font-medium flex-1">{formatLabel(title || '')}</span>
        {isEmpty && <span className="text-slate-500 text-xs">empty</span>}
      </button>
      {!collapsed && (
        <div className="p-4 border-t border-slate-700/50">
          {content}
        </div>
      )}
    </div>
  );
}

interface AddFieldFormProps {
  onAdd: (key: string, type: string) => void;
  onCancel: () => void;
  existingKeys: string[];
}

function AddFieldForm({ onAdd, onCancel, existingKeys }: AddFieldFormProps) {
  const [key, setKey] = useState('');
  const [type, setType] = useState('string');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!key.trim()) {
      setError('Field name is required');
      return;
    }
    if (existingKeys.includes(key)) {
      setError('Field already exists');
      return;
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      setError('Invalid field name');
      return;
    }
    onAdd(key, type);
  };

  return (
    <div className="flex flex-wrap items-end gap-2 p-3 bg-slate-700/30 rounded-lg">
      <div className="flex-1 min-w-[150px]">
        <label className="text-xs text-slate-400 block mb-1">Field Name</label>
        <input
          type="text"
          value={key}
          onChange={(e) => { setKey(e.target.value); setError(''); }}
          placeholder="fieldName"
          className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>
      <div className="w-28">
        <label className="text-xs text-slate-400 block mb-1">Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="string">String</option>
          <option value="number">Number</option>
          <option value="boolean">Boolean</option>
          <option value="object">Object</option>
          <option value="array">Array</option>
        </select>
      </div>
      <div className="flex gap-1">
        <button
          onClick={handleSubmit}
          className="px-3 py-1.5 bg-primary-600 hover:bg-primary-500 text-white text-sm rounded transition-colors"
        >
          Add
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white text-sm rounded transition-colors"
        >
          Cancel
        </button>
      </div>
      {error && <p className="w-full text-red-400 text-xs">{error}</p>}
    </div>
  );
}

interface ConfigFieldProps {
  fieldKey: string;
  value: unknown;
  path: string[];
  onChange: (path: string[], value: unknown) => void;
  onDelete: (path: string[]) => void;
  onAddField: (path: string[], key: string, type: string) => void;
}

function ConfigField({ fieldKey, value, path, onChange, onDelete, onAddField }: ConfigFieldProps) {
  const valueType = getValueType(value);

  // Nested object
  if (valueType === 'object' && value !== null) {
    return (
      <div className="relative group">
        <button
          onClick={() => onDelete(path)}
          className="absolute -right-1 -top-1 p-1 bg-slate-700 hover:bg-red-600 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10"
          title="Delete field"
        >
          <DeleteIcon />
        </button>
        <ConfigSection
          data={value as Record<string, unknown>}
          path={path}
          onChange={onChange}
          onDelete={onDelete}
          onAddField={onAddField}
          title={fieldKey}
        />
      </div>
    );
  }

  // Array
  if (valueType === 'array') {
    return (
      <div className="relative group">
        <button
          onClick={() => onDelete(path)}
          className="absolute -right-1 -top-1 p-1 bg-slate-700 hover:bg-red-600 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10"
          title="Delete field"
        >
          <DeleteIcon />
        </button>
        <ArrayField
          fieldKey={fieldKey}
          value={value as unknown[]}
          path={path}
          onChange={onChange}
        />
      </div>
    );
  }

  // Primitive types
  return (
    <div className="flex items-center gap-3 group">
      <label className="text-sm font-medium text-slate-300 w-40 shrink-0">
        {formatLabel(fieldKey)}
      </label>
      <div className="flex-1">
        <PrimitiveField
          value={value}
          valueType={valueType}
          onChange={(newValue) => onChange(path, newValue)}
        />
      </div>
      <button
        onClick={() => onDelete(path)}
        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded opacity-0 group-hover:opacity-100 transition-all"
        title="Delete field"
      >
        <DeleteIcon />
      </button>
    </div>
  );
}

interface PrimitiveFieldProps {
  value: unknown;
  valueType: string;
  onChange: (value: unknown) => void;
}

function PrimitiveField({ value, valueType, onChange }: PrimitiveFieldProps) {
  if (valueType === 'boolean') {
    return (
      <button
        onClick={() => onChange(!value)}
        className={`relative w-12 h-6 rounded-full transition-colors ${
          value ? 'bg-primary-500' : 'bg-slate-600'
        }`}
      >
        <span
          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
            value ? 'left-7' : 'left-1'
          }`}
        />
      </button>
    );
  }

  if (valueType === 'number') {
    return (
      <input
        type="number"
        value={value as number}
        onChange={(e) => {
          const num = parseFloat(e.target.value);
          onChange(isNaN(num) ? 0 : num);
        }}
        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
    );
  }

  if (valueType === 'null') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-slate-500 italic">null</span>
        <button
          onClick={() => onChange('')}
          className="text-xs text-primary-400 hover:text-primary-300"
        >
          Set value
        </button>
      </div>
    );
  }

  // String (default)
  return (
    <input
      type="text"
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
    />
  );
}

interface ArrayFieldProps {
  fieldKey: string;
  value: unknown[];
  path: string[];
  onChange: (path: string[], value: unknown) => void;
}

function ArrayField({ fieldKey, value, path, onChange }: ArrayFieldProps) {
  const [collapsed, setCollapsed] = useState(value.length === 0);

  const addItem = () => {
    const itemType = value.length > 0 ? getValueType(value[0]) : 'string';
    let newItem: unknown = '';
    if (itemType === 'number') newItem = 0;
    if (itemType === 'boolean') newItem = false;
    if (itemType === 'object') newItem = {};
    onChange(path, [...value, newItem]);
  };

  const removeItem = (index: number) => {
    const newValue = [...value];
    newValue.splice(index, 1);
    onChange(path, newValue);
  };

  const updateItem = (index: number, newValue: unknown) => {
    const updated = [...value];
    updated[index] = newValue;
    onChange(path, updated);
  };

  return (
    <div className="border border-slate-600 rounded-lg overflow-hidden bg-slate-800/30">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 p-3 bg-slate-700/30 hover:bg-slate-700/50 transition-colors text-left"
      >
        <ChevronIcon expanded={!collapsed} />
        <span className="text-slate-200 font-medium flex-1">{formatLabel(fieldKey)}</span>
        <span className="text-slate-500 text-xs">{value.length} items</span>
      </button>
      {!collapsed && (
        <div className="p-4 border-t border-slate-700/50 space-y-2">
          {value.length === 0 ? (
            <p className="text-slate-500 text-sm py-1">No items</p>
          ) : (
            value.map((item, index) => (
              <div key={index} className="flex items-center gap-2 group">
                <span className="text-slate-500 text-sm w-6 shrink-0">{index + 1}.</span>
                <div className="flex-1">
                  {getValueType(item) === 'object' ? (
                    <div className="text-sm text-slate-400 bg-slate-700/50 px-3 py-2 rounded">
                      {JSON.stringify(item)}
                    </div>
                  ) : (
                    <PrimitiveField
                      value={item}
                      valueType={getValueType(item)}
                      onChange={(newValue) => updateItem(index, newValue)}
                    />
                  )}
                </div>
                <button
                  onClick={() => removeItem(index)}
                  className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded opacity-0 group-hover:opacity-100 transition-all"
                  title="Remove item"
                >
                  <DeleteIcon />
                </button>
              </div>
            ))
          )}
          <button
            onClick={addItem}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-primary-400 transition-colors mt-2"
          >
            <PlusIcon />
            Add Item
          </button>
        </div>
      )}
    </div>
  );
}

function getValueType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function formatLabel(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/^./, (str) => str.toUpperCase());
}
