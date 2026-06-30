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

/**
 * Migrate game state from older versions to v0.3.0.
 * Adds cliques and administrationBase to factions that lack them.
 */
export function migrateGameState(state: GameState): GameState {
  if (state.version === "0.3.0") return state;

  const migrated = structuredClone(state);

  for (const faction of Object.values(migrated.factions)) {
    if (!faction.cliques || faction.cliques.length === 0) {
      faction.cliques = [
        { cliqueId: "imperial", support: 50, strength: 0, activeModifier: 0, approval: 50 },
        { cliqueId: "reform", support: 50, strength: 0, activeModifier: 0, approval: 50 },
        { cliqueId: "donglin", support: 50, strength: 0, activeModifier: 0, approval: 50 },
        { cliqueId: "eunuch", support: 50, strength: 0, activeModifier: 0, approval: 50 },
        { cliqueId: "frontier", support: 50, strength: 0, activeModifier: 0, approval: 50 },
      ];
    }
    // S3b: backfill approval on cliques from older saves (pre-S3 had no field)
    faction.cliques = faction.cliques.map((cs) => ({
      cliqueId: cs.cliqueId,
      support: cs.support,
      strength: cs.strength,
      activeModifier: cs.activeModifier,
      approval: cs.approval ?? 50,
    }));
    if (faction.administrationBase === undefined) {
      faction.administrationBase = faction.administration;
    }
  }

  migrated.version = "0.3.0";
  return migrated;
}

/**
 * Load a save game and apply any necessary migrations.
 */
export async function loadGame(saveId: string): Promise<SaveGame | null> {
  const db = await openSaveDb();
  const save = await new Promise<SaveGame | null>((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).get(saveId);
    request.onsuccess = () => resolve((request.result as SaveGame) ?? null);
    request.onerror = () => reject(request.error);
  });
  db.close();

  if (!save) return null;

  // Apply migration if needed
  if (save.state.version !== "0.3.0") {
    save.state = migrateGameState(save.state);
    save.version = "0.3.0";
  }

  return save;
}
