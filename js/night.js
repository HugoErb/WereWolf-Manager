import { getRole } from "./roles.js";
import { eliminatePlayer, logEvent } from "./game.js";

export function createNight(game) {
  const roleIds = [...new Set(game.players.filter((player) => {
    if (!player.alive || !getRole(player.roleId).wakesAtNight) return false;
    if (player.roleId === "witch" && player.effects.includes("life-potion-used") && player.effects.includes("death-potion-used")) return false;
    return true;
  }).map((player) => player.roleId))];
  const steps = roleIds
    .map(getRole)
    .filter((role) => !role.firstNightOnly || game.night === 1)
    .sort((a, b) => a.nightOrder - b.nightOrder)
    .map((role) => ({ roleId: role.id, actionType: role.actionType, done: false }));
  game.pendingNight = { night: game.night, steps, index: 0, actions: {}, resolved: false, applied: false };
}

export const currentNightStep = (game) => game.pendingNight?.steps[game.pendingNight.index] || null;

export function validateNightAction(game, action) {
  const night = game.pendingNight;
  const step = currentNightStep(game);
  if (!step) throw new Error("Aucune action nocturne en attente.");
  const aliveIds = new Set(game.players.filter((player) => player.alive).map((player) => player.id));
  if (step.actionType === "wolves") {
    if (!aliveIds.has(action.targetId)) throw new Error("Choisissez une victime vivante.");
    const target = game.players.find((player) => player.id === action.targetId);
    if (!game.settings.wolvesCanTargetWolf && target.team === "wolves") throw new Error("Les Loups-Garous ne peuvent pas cibler un Loup.");
    night.actions.wolves = { targetId: action.targetId };
    logEvent(game, "night-wolves", `Les Loups-Garous ciblent ${target.name}.`);
  } else if (step.actionType === "seer") {
    if (!aliveIds.has(action.targetId)) throw new Error("Choisissez un joueur vivant.");
    const target = game.players.find((player) => player.id === action.targetId);
    night.actions.seer = { targetId: action.targetId, revealed: game.settings.seerReveal === "team" ? target.team : target.roleId };
    logEvent(game, "night-seer", `La Voyante observe ${target.name}.`);
  } else if (step.actionType === "cupid") {
    if (!aliveIds.has(action.firstId) || !aliveIds.has(action.secondId) || action.firstId === action.secondId) throw new Error("Choisissez deux joueurs différents.");
    game.relationships = game.relationships.filter((item) => item.type !== "lovers");
    game.relationships.push({ type: "lovers", playerIds: [action.firstId, action.secondId], createdNight: game.night });
    night.actions.cupid = { playerIds: [action.firstId, action.secondId] };
    const names = action.playerIds?.map((id) => game.players.find((player) => player.id === id)?.name) || [action.firstId, action.secondId].map((id) => game.players.find((player) => player.id === id).name);
    logEvent(game, "night-cupid", `Cupidon unit ${names.join(" et ")}.`);
  } else if (step.actionType === "witch") {
    const witch = game.players.find((player) => player.alive && player.roleId === "witch");
    const hasLife = !witch.effects.includes("life-potion-used");
    const hasDeath = !witch.effects.includes("death-potion-used");
    if (action.save && !hasLife) throw new Error("La potion de vie a déjà été utilisée.");
    if (action.save && !game.settings.witchCanSaveSelf && game.pendingNight.actions.wolves?.targetId === witch.id) throw new Error("Cette règle interdit à la Sorcière de se sauver elle-même.");
    if (action.killId && (!hasDeath || !aliveIds.has(action.killId))) throw new Error("La potion de mort ne peut pas être utilisée ainsi.");
    if (action.save && action.killId && !game.settings.witchCanUseBoth) throw new Error("Les deux potions ne peuvent pas être utilisées la même nuit.");
    if (action.save) witch.effects.push("life-potion-used");
    if (action.killId) witch.effects.push("death-potion-used");
    night.actions.witch = { save: Boolean(action.save), killId: action.killId || null };
    logEvent(game, "night-witch", action.save || action.killId ? "La Sorcière utilise une potion." : "La Sorcière n’utilise aucune potion.");
  }
  step.done = true;
  night.index += 1;
}

export function resolveNight(game) {
  const actions = game.pendingNight?.actions || {};
  const wolfTarget = actions.wolves?.targetId || null;
  const saved = Boolean(actions.witch?.save && wolfTarget);
  const poisoned = actions.witch?.killId || null;
  const deathIds = [...new Set([saved ? null : wolfTarget, poisoned].filter(Boolean))];
  const playerName = (id) => game.players.find((player) => player.id === id)?.name || "Personne";
  game.pendingNight.resolved = true;
  game.pendingNight.summary = { wolfTarget, saved, poisoned, deathIds };
  logEvent(game, "night-resolution", `Bilan de la nuit : ${deathIds.length ? deathIds.map(playerName).join(", ") : "aucune mort"}.`);
  return game.pendingNight.summary;
}

export function applyNightResolution(game) {
  const night = game.pendingNight;
  if (!night?.resolved || night.applied) throw new Error("La nuit n’est pas prête à être appliquée.");
  const deaths = [];
  night.summary.deathIds.forEach((id) => {
    const cause = id === night.summary.poisoned ? "potion de la Sorcière" : "attaque des Loups-Garous";
    eliminatePlayer(game, id, cause);
    deaths.push(id);
  });
  night.applied = true;
  game.wakeSummary = { deathIds: deaths, saved: night.summary.saved };
}
