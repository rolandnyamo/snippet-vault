import fs from 'fs';
import path from 'path';

// Simple Headers polyfill for Node.js
if (!globalThis.Headers) {
  globalThis.Headers = class Headers {
    constructor(init = {}) {
      this._headers = new Map();
      if (init && typeof init === 'object') {
        for (const [key, value] of Object.entries(init)) {
          this._headers.set(key.toLowerCase(), String(value));
        }
      }
    }
    get(name) {
      return this._headers.get(name.toLowerCase()) || null;
    }
    set(name, value) {
      this._headers.set(name.toLowerCase(), String(value));
    }
    has(name) {
      return this._headers.has(name.toLowerCase());
    }
    delete(name) {
      this._headers.delete(name.toLowerCase());
    }
    forEach(callback) {
      this._headers.forEach((value, key) => callback(value, key, this));
    }
    *[Symbol.iterator]() {
      for (const [key, value] of this._headers) {
        yield [key, value];
      }
    }
  };
}

export function get_config_path(userDataPath) {
  return path.join(userDataPath, 'config.json');
}

export function getDataPath(configPath) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath));
    return config.storage_path;
  } catch (error) {
    return null;
  }
}
