import type { GameState, PlayerDecision } from "../core/types";

export interface SaveGame {
  id: string;
  name: string;
  savedAt: string;
  state: GameState;
  decision: PlayerDecision;
  version: string;
}

const dbName = "wanli-collapse";
const storeName = "saves";

export function createSaveGame(name: string, state: GameState, decision: PlayerDecision): SaveGame {
  return {
    id: `${Date.now()}-${state.currentDate}`,
    name,
    savedAt: new Date().toISOString(),
    state,
    decision,
    version: state.version
  };
}

export function openSaveDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveGame(save: SaveGame): Promise<void> {
  const db = await openSaveDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(save);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function listSaves(): Promise<SaveGame[]> {
  const db = await openSaveDb();
  const saves = await new Promise<SaveGame[]>((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as SaveGame[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return saves.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}
