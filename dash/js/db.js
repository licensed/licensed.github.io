/**
 * db.js — IndexedDB wrapper for persisting discipline data.
 *
 * Database: "ead-dashboard"  (version 1)
 * Object store: "disciplines"
 *   key: discipline name (string)
 *   value: { name, questions, savedAt }
 */

const DB_NAME    = 'ead-dashboard';
const DB_VERSION = 1;
const STORE      = 'disciplines';

let _db = null;

/** Open (or create) the database. Returns a promise. */
export function openDB() {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'name' });
      }
    };

    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror   = (e) => reject(e.target.error);
  });
}

/** Save or overwrite a discipline record. */
export async function saveDiscipline(name, questions, raw) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).put({ name, questions, raw, savedAt: Date.now() });
    req.onsuccess = () => resolve();
    req.onerror   = (e) => reject(e.target.error);
  });
}

/** Load all saved discipline records. Returns array of { name, questions, raw, savedAt }. */
export async function loadAllDisciplines() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

/** Delete a single discipline by name. */
export async function deleteDiscipline(name) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).delete(name);
    req.onsuccess = () => resolve();
    req.onerror   = (e) => reject(e.target.error);
  });
}

/** Delete all disciplines. */
export async function deleteAllDisciplines() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).clear();
    req.onsuccess = () => resolve();
    req.onerror   = (e) => reject(e.target.error);
  });
}
