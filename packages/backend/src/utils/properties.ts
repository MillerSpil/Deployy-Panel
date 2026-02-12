/**
 * Utility functions for parsing and serializing Minecraft server.properties files.
 * Handles the key=value format while preserving comments.
 */

interface PropertiesData {
  properties: Record<string, string>;
  comments: string[];
}

/**
 * Parse a server.properties file content into a JavaScript object.
 * Comments (lines starting with #) are preserved separately.
 */
export function parseProperties(content: string): PropertiesData {
  const lines = content.split(/\r?\n/);
  const properties: Record<string, string> = {};
  const comments: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      comments.push(line);
      continue;
    }

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }

    const key = trimmed.substring(0, eqIndex).trim();
    const value = trimmed.substring(eqIndex + 1);

    if (key) {
      properties[key] = value;
    }
  }

  return { properties, comments };
}

/**
 * Serialize a properties object back to server.properties format.
 * Adds a header comment with timestamp.
 */
export function serializeProperties(
  properties: Record<string, string>,
  existingComments?: string[]
): string {
  const lines: string[] = [];

  // Add header if no existing comments
  if (!existingComments || existingComments.length === 0) {
    lines.push('#Minecraft server properties');
    lines.push(`#${new Date().toUTCString()}`);
  } else {
    // Use existing comments as header
    for (const comment of existingComments) {
      if (comment.startsWith('#') || comment.trim() === '') {
        lines.push(comment);
      }
    }
  }

  // Sort keys for consistent output
  const sortedKeys = Object.keys(properties).sort();

  for (const key of sortedKeys) {
    const value = properties[key];
    lines.push(`${key}=${value}`);
  }

  return lines.join('\n');
}

/**
 * Default Minecraft server.properties values
 */
export const DEFAULT_SERVER_PROPERTIES: Record<string, string> = {
  'spawn-protection': '16',
  'max-tick-time': '60000',
  'query.port': '25565',
  'generator-settings': '{}',
  'sync-chunk-writes': 'true',
  'force-gamemode': 'false',
  'allow-nether': 'true',
  'enforce-whitelist': 'false',
  'gamemode': 'survival',
  'broadcast-console-to-ops': 'true',
  'enable-query': 'false',
  'player-idle-timeout': '0',
  'difficulty': 'easy',
  'spawn-monsters': 'true',
  'broadcast-rcon-to-ops': 'true',
  'op-permission-level': '4',
  'pvp': 'true',
  'entity-broadcast-range-percentage': '100',
  'snooper-enabled': 'true',
  'level-type': 'minecraft:normal',
  'enable-status': 'true',
  'hardcore': 'false',
  'enable-command-block': 'false',
  'network-compression-threshold': '256',
  'max-players': '20',
  'max-world-size': '29999984',
  'resource-pack-sha1': '',
  'function-permission-level': '2',
  'rcon.port': '25575',
  'server-port': '25565',
  'server-ip': '',
  'spawn-npcs': 'true',
  'allow-flight': 'false',
  'level-name': 'world',
  'view-distance': '10',
  'resource-pack': '',
  'spawn-animals': 'true',
  'white-list': 'false',
  'rcon.password': '',
  'generate-structures': 'true',
  'online-mode': 'true',
  'max-build-height': '256',
  'level-seed': '',
  'prevent-proxy-connections': 'false',
  'use-native-transport': 'true',
  'enable-jmx-monitoring': 'false',
  'motd': 'A Minecraft Server',
  'rate-limit': '0',
  'enable-rcon': 'false',
};

/**
 * Create default server.properties content with custom values
 */
export function createDefaultProperties(
  port: number,
  maxPlayers: number,
  motd: string = 'A Minecraft Server'
): string {
  const properties = {
    ...DEFAULT_SERVER_PROPERTIES,
    'server-port': String(port),
    'query.port': String(port),
    'max-players': String(maxPlayers),
    'motd': motd,
  };

  return serializeProperties(properties);
}
