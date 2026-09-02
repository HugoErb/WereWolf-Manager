import { getRole, recommendedComposition } from "./roles.js";
import { uid, shuffle } from "./utils.js";

export const PHASES = ["preparation", "night", "night-resolution", "wake", "discussion", "vote", "resolution"];
export const PHASE_LABELS = {
  preparation: "Préparation", night: "Nuit", "night-resolution": "Résolution de la nuit",
  wake: "Réveil du village", discussion: "Discussion", vote: "Vote", resolution: "Résolution du vote", ended: "Partie terminée",
};

export function createGame(settings) {
  const now = new Date().toISOString();
  return {
    id: uid("game"), version: 1, status: "setup", phase: "preparation", day: 0, night: 0,
    players: [], composition: { werewolf: 0, villager: 0, specials: [] }, settings: { ...settings }, history: [],
    generalNotes: "", relationships: [], pendingNight: null, pendingDeaths: [], wakeSummary: null,
    vote: { mode: "simple", ballots: {}, selected: null, resolved: false },
    timer: { duration: settings.timerDuration, remaining: settings.timerDuration, running: false, endsAt: null },
    winner: null, victoryDismissed: false, createdAt: now, updatedAt: now,
  };
}

export function addPlayer(game, name) {
  const cleanName = name.trim();
  if (!cleanName) throw new Error("Saisissez un nom de joueur.");
  if (game.players.some((player) => player.name.toLocaleLowerCase("fr") === cleanName.toLocaleLowerCase("fr"))) throw new Error("Ce nom est déjà utilisé.");
  game.players.forEach((player) => { player.roleId = null; player.team = null; });
  game.players.push({ id: uid("player"), name: cleanName, roleId: null, team: null, alive: true, deathCause: null, deathRound: null, effects: [], notes: "", history: [] });
  syncComposition(game);
}

export function syncComposition(game) {
  const count = game.players.length;
  const used = game.composition.werewolf + game.composition.specials.length;
  game.composition.villager = Math.max(0, count - used);
}

export function applyRecommendation(game) {
  const recommendation = recommendedComposition(game.players.length);
  game.composition.werewolf = recommendation.werewolf;
  game.composition.specials = recommendation.specials;
  game.players.forEach((player) => { player.roleId = null; player.team = null; });
  syncComposition(game);
}

export function compositionRoles(game) {
  return [
    ...Array(game.composition.werewolf).fill("werewolf"),
    ...game.composition.specials,
    ...Array(game.composition.villager).fill("villager"),
  ];
}

export function assignRoles(game) {
  const roles = compositionRoles(game);
  if (!game.players.length || roles.length !== game.players.length) throw new Error("Le nombre de rôles doit correspondre au nombre de joueurs.");
  shuffle(roles).forEach((roleId, index) => {
    game.players[index].roleId = roleId;
    game.players[index].team = getRole(roleId).team;
    game.players[index].alive = true;
  });
}

export function logEvent(game, type, message, visibility = "gm") {
  game.history.unshift({ id: uid("event"), type, visibility, message, day: game.day, night: game.night, phase: game.phase, createdAt: new Date().toISOString() });
}

export function launchGame(game) {
  if (game.players.some((player) => !player.roleId)) throw new Error("Tous les joueurs doivent avoir un rôle.");
  game.status = "active";
  game.phase = "night";
  game.night = 1;
  game.day = 0;
  logEvent(game, "game-start", "La partie commence.", "announcement");
}

export function setPhase(game, phase) {
  if (!PHASES.includes(phase) && phase !== "ended") throw new Error("Phase inconnue.");
  game.phase = phase;
  game.victoryDismissed = false;
  if (phase === "night") {
    game.night += 1;
    game.pendingNight = null;
    game.wakeSummary = null;
  }
  if (phase === "wake") game.day = Math.max(game.day + 1, game.night);
  if (phase === "vote") game.vote = { mode: game.vote?.mode || "simple", ballots: {}, selected: null, resolved: false };
  logEvent(game, "phase", `Phase : ${PHASE_LABELS[phase]}.`, "announcement");
}

export function nextPhase(game) {
  const transitions = { preparation: "night", wake: "discussion", discussion: "vote", resolution: "night" };
  const next = transitions[game.phase];
  if (!next) throw new Error("Cette étape doit d’abord être validée dans son écran dédié.");
  setPhase(game, next);
}

export function previousPhase(game) {
  const transitions = { night: "resolution", wake: "night-resolution", discussion: "wake", vote: "discussion", resolution: "vote" };
  const previous = transitions[game.phase];
  if (!previous) throw new Error("Impossible de revenir davantage.");
  if (game.phase === "night") {
    game.night = Math.max(1, game.night - 1);
    game.pendingNight = null;
  }
  game.phase = previous;
  logEvent(game, "phase-correction", `Retour manuel : ${PHASE_LABELS[previous]}.`);
}

export function eliminatePlayer(game, playerId, cause, options = {}) {
  const player = game.players.find((item) => item.id === playerId);
  if (!player || !player.alive) return [];
  player.alive = false;
  game.victoryDismissed = false;
  player.deathCause = cause;
  player.deathRound = game.day || game.night;
  player.history.push({ type: "death", cause, day: game.day, night: game.night, phase: game.phase });
  logEvent(game, "death", `${player.name} meurt (${cause}).`, options.visibility || "announcement");
  const consequences = [];
  if (player.roleId === "hunter" && !options.skipTriggers) consequences.push({ type: "hunter", playerId });
  const relationship = game.relationships.find((link) => link.type === "lovers" && link.playerIds.includes(playerId));
  if (relationship) {
    const loverId = relationship.playerIds.find((id) => id !== playerId);
    const lover = game.players.find((item) => item.id === loverId);
    if (lover?.alive) consequences.push({ type: "death", playerId: loverId, cause: "chagrin amoureux" });
  }
  game.pendingDeaths.push(...consequences);
  return consequences;
}

export function revivePlayer(game, playerId) {
  const player = game.players.find((item) => item.id === playerId);
  if (!player || player.alive) return;
  player.alive = true; player.deathCause = null; player.deathRound = null;
  game.victoryDismissed = false;
  logEvent(game, "revive", `${player.name} est ressuscité manuellement.`);
}

export function processDeathQueue(game) {
  const next = game.pendingDeaths.shift();
  if (next?.type === "death") eliminatePlayer(game, next.playerId, next.cause);
  return next;
}

export function checkVictory(game) {
  if (game.status !== "active") return null;
  const alive = game.players.filter((player) => player.alive);
  const wolves = alive.filter((player) => player.team === "wolves");
  const lovers = game.relationships.find((relationship) => relationship.type === "lovers");
  if (alive.length === 2 && lovers && alive.every((player) => lovers.playerIds.includes(player.id)) && new Set(alive.map((player) => player.team)).size > 1) {
    return { team: "lovers", label: "Victoire des Amoureux", reason: "Le couple issu de deux camps différents est seul survivant." };
  }
  if (!wolves.length) return { team: "village", label: "Victoire du Village", reason: "Tous les Loups-Garous sont morts." };
  if (wolves.length >= alive.length - wolves.length) return { team: "wolves", label: "Victoire des Loups-Garous", reason: "Les Loups-Garous sont assez nombreux pour contrôler le village." };
  return null;
}

export function endGame(game, winner) {
  game.status = "ended"; game.phase = "ended"; game.winner = winner;
  logEvent(game, "game-end", `${winner.label}. ${winner.reason}`, "announcement");
}
