import { useEffect, useRef, useState } from 'react';
import { useServerLogs } from '@/hooks/useServerLogs';
import { useSocket } from '@/hooks/useSocket';

const ANSI_COLORS: Record<string, string> = {
  '30': 'text-gray-900',
  '31': 'text-red-500',
  '32': 'text-green-500',
  '33': 'text-yellow-500',
  '34': 'text-blue-500',
  '35': 'text-purple-500',
  '36': 'text-cyan-500',
  '37': 'text-gray-300',
  '90': 'text-gray-500',
  '91': 'text-red-400',
  '92': 'text-green-400',
  '93': 'text-yellow-400',
  '94': 'text-blue-400',
  '95': 'text-purple-400',
  '96': 'text-cyan-400',
  '97': 'text-white',
};

function parseAnsi(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /\x1B\[([0-9;]*)m|\[([0-9;]*)m/g;
  let lastIndex = 0;
  let currentColor = 'text-green-400';
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={key++} className={currentColor}>
          {text.slice(lastIndex, match.index)}
        </span>
      );
    }

    const codes = (match[1] || match[2] || '0').split(';');
    for (const code of codes) {
      if (code === '0' || code === '') {
        currentColor = 'text-green-400';
      } else if (ANSI_COLORS[code]) {
        currentColor = ANSI_COLORS[code];
      }
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(
      <span key={key++} className={currentColor}>
        {text.slice(lastIndex)}
      </span>
    );
  }

  return parts.length > 0 ? parts : [<span key={0} className="text-green-400">{text}</span>];
}

interface ServerConsoleProps {
  serverId: string;
  canSendCommands?: boolean;
}

export function ServerConsole({ serverId, canSendCommands = true }: ServerConsoleProps) {
  const logs = useServerLogs(serverId);
  const consoleRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [command, setCommand] = useState('');
  const socket = useSocket();

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || !socket) return;

    socket.emit('command', { serverId, command: command.trim() });
    setCommand('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col">
      <div
        ref={consoleRef}
        className="bg-gray-900 rounded-t-lg p-4 h-96 overflow-y-auto font-mono text-sm"
      >
        {logs.length === 0 ? (
          <p className="text-gray-500">No logs yet...</p>
        ) : (
          logs.map((log, index) => (
            <div key={index}>
              <span className="text-gray-500 mr-2">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              {parseAnsi(log.line)}
            </div>
          ))
        )}
      </div>
      {canSendCommands && (
        <form onSubmit={handleSubmit} className="flex">
          <input
            ref={inputRef}
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command (e.g., /auth login)..."
            className="flex-1 bg-gray-800 text-green-400 font-mono text-sm px-4 py-3 rounded-bl-lg border-t border-gray-700 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
          <button
            type="submit"
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-br-lg font-medium transition-colors"
          >
            Send
          </button>
        </form>
      )}
    </div>
  );
}
