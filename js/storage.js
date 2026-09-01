const GAME_KEY = "werewolf-manager.game.v1";
const SETTINGS_KEY = "werewolf-manager.settings.v1";
const UNDO_KEY = "werewolf-manager.undo.v1";
export const SAVE_VERSION = 1;

export const DEFAULT_SETTINGS = {
  animations: true, confirmations: true, compact: false, darkMode: true,
  timerDuration: 180, seerReveal: "role", wolvesCanTargetWolf: false,
  witchCanUseBoth: true, witchCanSaveSelf: true,
};

const read = (key, fallback = null) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};

export const hasSavedGame = () => Boolean(localStorage.getItem(GAME_KEY));
export const saveGame = (game) => localStorage.setItem(GAME_KEY, JSON.stringify({ version: SAVE_VERSION, game }));
export const deleteGame = () => { localStorage.removeItem(GAME_KEY); localStorage.removeItem(UNDO_KEY); };
export const saveSettings = (settings) => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
export const loadSettings = () => ({ ...DEFAULT_SETTINGS, ...read(SETTINGS_KEY, {}) });
export const saveUndo = (snapshots) => localStorage.setItem(UNDO_KEY, JSON.stringify(snapshots.slice(-12)));
export const loadUndo = () => read(UNDO_KEY, []);

export function loadGame() {
  const data = read(GAME_KEY);
  if (!data || data.version !== SAVE_VERSION || !validateGame(data.game)) return null;
  return data.game;
}

export function validateGame(game) {
  return Boolean(game && typeof game === "object" && typeof game.id === "string" && Array.isArray(game.players) && Array.isArray(game.history) && game.settings);
}

export function parseImport(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error("Ce fichier ne contient pas un JSON valide."); }
  if (data?.version !== SAVE_VERSION) throw new Error(`Version de sauvegarde incompatible (attendue : ${SAVE_VERSION}).`);
  if (!validateGame(data.game)) throw new Error("La sauvegarde ne contient pas une partie valide.");
  return data.game;
}

export const exportPayload = (game) => ({ version: SAVE_VERSION, exportedAt: new Date().toISOString(), game });
