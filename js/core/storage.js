import { config } from './config.js';

export const storage = (() => {
  function read(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (err) {
      console.error('Error leyendo almacenamiento:', key, err);
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    return value;
  }

  function remove(key) { localStorage.removeItem(key); }

  function getLanguage() { return read(config.KEYS.language, 'es'); }
  function setLanguage(language) { return write(config.KEYS.language, language); }

  function scopedKey(userId, key) {
    return `${config.KEYS.dataPrefix}${userId}_${key}`;
  }

  function readScoped(userId, key, fallback = null) {
    return read(scopedKey(userId, key), fallback);
  }

  function writeScoped(userId, key, value) {
    return write(scopedKey(userId, key), value);
  }

  return { get: read, set: write, remove, scopedKey, getScoped: readScoped, setScoped: writeScoped, getLanguage, setLanguage };
})();


export const StorageManager = storage;

window.GP = window.GP || {};
window.GP.storage = storage;
window.GP.StorageManager = StorageManager;
