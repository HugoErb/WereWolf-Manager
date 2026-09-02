import { ROLE_MAP } from "./roles.js";

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

const withoutLegacyName = (game) => {
  if (!game || typeof game !== "object") return game;
  const clean = { ...game };
  delete clean.name;
  delete clean._victory;
  return clean;
};

const normalizeLoadedGame = (game) => {
  const clean = withoutLegacyName(game);
  if (clean?.timer?.running && !["discussion", "vote"].includes(clean.phase)) {
    const remaining = clean.timer.endsAt ? Math.max(0, Math.ceil((clean.timer.endsAt - Date.now()) / 1000)) : clean.timer.remaining;
    clean.timer = { ...clean.timer, remaining, running: false, endsAt: null };
  }
  return clean;
};

export const hasSavedGame = () => {
  const data = read(GAME_KEY);
  return Boolean(data?.version === SAVE_VERSION && validateGame(data.game));
};
export const saveGame = (game) => localStorage.setItem(GAME_KEY, JSON.stringify({ version: SAVE_VERSION, game: withoutLegacyName(game) }));
export const deleteGame = () => { localStorage.removeItem(GAME_KEY); localStorage.removeItem(UNDO_KEY); };
export const saveSettings = (settings) => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
export const loadSettings = () => ({ ...DEFAULT_SETTINGS, ...read(SETTINGS_KEY, {}) });
export const saveUndo = (snapshots) => localStorage.setItem(UNDO_KEY, JSON.stringify(snapshots.slice(-12).map(withoutLegacyName)));
export const loadUndo = () => { const snapshots = read(UNDO_KEY, []); return Array.isArray(snapshots) ? snapshots.filter(validateGame).map(normalizeLoadedGame) : []; };

export function loadGame() {
  const data = read(GAME_KEY);
  if (!data || data.version !== SAVE_VERSION || !validateGame(data.game)) return null;
  return normalizeLoadedGame(data.game);
}

export function validateGame(game) {
  if (!game || typeof game !== "object" || Array.isArray(game)) return false;
  const isObject = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
  const isInteger = (value) => Number.isInteger(value) && value >= 0;
  const statuses = new Set(["setup", "active", "ended"]);
  const phases = new Set(["preparation", "night", "night-resolution", "wake", "discussion", "vote", "resolution", "ended"]);
  const teams = new Set(["village", "wolves"]);
  const roleIds = new Set(Object.keys(ROLE_MAP));

  if (typeof game.id !== "string" || !game.id || !statuses.has(game.status) || !phases.has(game.phase) || !isInteger(game.day) || !isInteger(game.night)) return false;
  if (!Array.isArray(game.players) || !Array.isArray(game.history) || !Array.isArray(game.relationships) || !Array.isArray(game.pendingDeaths)) return false;
  if (typeof game.generalNotes !== "string" || typeof game.victoryDismissed !== "boolean") return false;

  const playersValid = game.players.every((player) => {
    if (!isObject(player) || typeof player.id !== "string" || !player.id || typeof player.name !== "string" || !player.name.trim()) return false;
    if (typeof player.alive !== "boolean" || !Array.isArray(player.effects) || !Array.isArray(player.history) || typeof player.notes !== "string") return false;
    if (player.roleId === null) return player.team === null;
    return roleIds.has(player.roleId) && teams.has(player.team) && ROLE_MAP[player.roleId].team === player.team;
  });
  const playerIds = game.players.map((player) => player.id);
  const playerNames = game.players.map((player) => player.name.trim().toLocaleLowerCase("fr"));
  if (!playersValid || new Set(playerIds).size !== playerIds.length || new Set(playerNames).size !== playerNames.length) return false;
  if (game.status !== "setup" && game.players.some((player) => !player.roleId)) return false;

  const composition = game.composition;
  if (!isObject(composition) || !isInteger(composition.werewolf) || !isInteger(composition.villager) || !Array.isArray(composition.specials) || composition.specials.some((id) => !roleIds.has(id))) return false;

  const settings = game.settings;
  const booleanSettings = ["animations", "confirmations", "compact", "darkMode", "wolvesCanTargetWolf", "witchCanUseBoth", "witchCanSaveSelf"];
  if (!isObject(settings) || booleanSettings.some((key) => typeof settings[key] !== "boolean") || !Number.isFinite(settings.timerDuration) || settings.timerDuration <= 0 || !["role", "team"].includes(settings.seerReveal)) return false;

  const vote = game.vote;
  if (!isObject(vote) || !["simple", "count"].includes(vote.mode) || !isObject(vote.ballots) || typeof vote.resolved !== "boolean" || !(vote.selected === null || typeof vote.selected === "string")) return false;

  const timer = game.timer;
  if (!isObject(timer) || !Number.isFinite(timer.duration) || timer.duration <= 0 || !Number.isFinite(timer.remaining) || timer.remaining < 0 || typeof timer.running !== "boolean" || !(timer.endsAt === null || Number.isFinite(timer.endsAt)) || timer.running !== (timer.endsAt !== null)) return false;

  if (!(game.pendingNight === null || isObject(game.pendingNight)) || !(game.wakeSummary === null || isObject(game.wakeSummary)) || !(game.winner === null || isObject(game.winner))) return false;
  if (game.pendingNight) {
    const night = game.pendingNight;
    if (!isInteger(night.night) || !Array.isArray(night.steps) || !isInteger(night.index) || night.index > night.steps.length || !isObject(night.actions) || typeof night.resolved !== "boolean" || typeof night.applied !== "boolean") return false;
    if (night.steps.some((step) => !isObject(step) || !roleIds.has(step.roleId) || typeof step.actionType !== "string" || typeof step.done !== "boolean")) return false;
    if (night.resolved && (!isObject(night.summary) || !Array.isArray(night.summary.deathIds))) return false;
  }
  if (game.wakeSummary && (!Array.isArray(game.wakeSummary.deathIds) || typeof game.wakeSummary.saved !== "boolean")) return false;
  if (game.relationships.some((relationship) => !isObject(relationship) || typeof relationship.type !== "string" || !Array.isArray(relationship.playerIds))) return false;
  if (game.pendingDeaths.some((death) => !isObject(death) || !["death", "hunter"].includes(death.type) || typeof death.playerId !== "string")) return false;
  return true;
}

export function parseImport(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error("Ce fichier ne contient pas un JSON valide."); }
  if (data?.version !== SAVE_VERSION) throw new Error(`Version de sauvegarde incompatible (attendue : ${SAVE_VERSION}).`);
  if (!validateGame(data.game)) throw new Error("La sauvegarde ne contient pas une partie valide.");
  return normalizeLoadedGame(data.game);
}

export const exportPayload = (game) => ({ version: SAVE_VERSION, exportedAt: new Date().toISOString(), game: withoutLegacyName(game) });
