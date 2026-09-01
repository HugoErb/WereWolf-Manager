import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS, exportPayload, loadGame, parseImport, saveGame } from "../js/storage.js";
import { recommendedComposition } from "../js/roles.js";
import { addPlayer, applyRecommendation, assignRoles, checkVictory, compositionRoles, createGame, eliminatePlayer, launchGame, processDeathQueue } from "../js/game.js";
import { applyNightResolution, createNight, currentNightStep, resolveNight, validateNightAction } from "../js/night.js";
import { resolveVote, tallyVotes } from "../js/voting.js";

class MemoryStorage {
  data = new Map();
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}
globalThis.localStorage = new MemoryStorage();

function gameWithPlayers(count = 8) {
  const game = createGame(DEFAULT_SETTINGS, "Test", "Village test");
  for (let index = 1; index <= count; index += 1) addPlayer(game, `Joueur ${index}`);
  return game;
}

test("la composition recommandée distribue exactement un rôle par joueur", () => {
  const game = gameWithPlayers();
  applyRecommendation(game);
  assert.equal(compositionRoles(game).length, game.players.length);
  assignRoles(game);
  assert.equal(game.players.filter((player) => player.roleId).length, game.players.length);
  assert.deepEqual(game.players.map((player) => player.roleId).sort(), compositionRoles(game).sort());
});

test("les paliers recommandés font progresser la meute et les pouvoirs", () => {
  const expectations = [
    [5, 1, ["seer"]],
    [6, 1, ["seer"]],
    [7, 2, ["seer", "witch"]],
    [8, 2, ["seer", "witch"]],
    [9, 2, ["seer", "witch", "hunter"]],
    [10, 2, ["seer", "witch", "hunter", "cupid"]],
    [11, 3, ["seer", "witch", "hunter", "cupid"]],
    [12, 3, ["seer", "witch", "hunter", "cupid"]],
    [14, 3, ["seer", "witch", "hunter", "cupid", "little-girl"]],
    [16, 4, ["seer", "witch", "hunter", "cupid", "little-girl"]],
    [20, 5, ["seer", "witch", "hunter", "cupid", "little-girl"]],
  ];
  expectations.forEach(([players, wolves, specials]) => {
    const recommendation = recommendedComposition(players);
    assert.equal(recommendation.werewolf, wolves, `${players} joueurs`);
    assert.deepEqual(recommendation.specials, specials, `${players} joueurs`);
    assert.ok(wolves + specials.length < players, `${players} joueurs doivent conserver des Villageois`);
  });
});

test("la nuit enregistre puis applique une attaque sauvée et un poison", () => {
  const game = gameWithPlayers(6);
  const roles = ["werewolf", "werewolf", "seer", "witch", "villager", "villager"];
  game.players.forEach((player, index) => { player.roleId = roles[index]; player.team = roles[index] === "werewolf" ? "wolves" : "village"; });
  launchGame(game); createNight(game);
  while (currentNightStep(game)) {
    const type = currentNightStep(game).actionType;
    if (type === "wolves") validateNightAction(game, { targetId: game.players[4].id });
    if (type === "seer") validateNightAction(game, { targetId: game.players[0].id });
    if (type === "witch") validateNightAction(game, { save: true, killId: game.players[5].id });
  }
  const summary = resolveNight(game);
  assert.equal(summary.saved, true);
  assert.deepEqual(summary.deathIds, [game.players[5].id]);
  applyNightResolution(game);
  assert.equal(game.players[4].alive, true);
  assert.equal(game.players[5].alive, false);
  assert.ok(game.players[3].effects.includes("life-potion-used"));
  assert.ok(game.players[3].effects.includes("death-potion-used"));
});

test("la mort d’un amoureux entraîne celle de l’autre", () => {
  const game = gameWithPlayers(5);
  game.players.forEach((player) => { player.roleId = "villager"; player.team = "village"; });
  game.relationships.push({ type: "lovers", playerIds: [game.players[0].id, game.players[1].id] });
  eliminatePlayer(game, game.players[0].id, "test");
  processDeathQueue(game);
  assert.equal(game.players[1].alive, false);
  assert.equal(game.players[1].deathCause, "chagrin amoureux");
});

test("la mort du Chasseur crée une action de dernier tir", () => {
  const game = gameWithPlayers(5);
  game.players.forEach((player) => { player.roleId = "villager"; player.team = "village"; });
  game.players[2].roleId = "hunter";
  eliminatePlayer(game, game.players[2].id, "vote du village");
  assert.deepEqual(game.pendingDeaths[0], { type: "hunter", playerId: game.players[2].id });
});

test("le comptage détecte une égalité et permet un leader", () => {
  const game = gameWithPlayers(5);
  game.players.forEach((player) => { player.roleId = "villager"; player.team = "village"; });
  game.status = "active"; game.phase = "vote"; game.vote.mode = "count";
  game.vote.ballots = { [game.players[0].id]: game.players[3].id, [game.players[1].id]: game.players[4].id };
  assert.equal(tallyVotes(game).leaders.length, 2);
  resolveVote(game, game.players[3].id);
  assert.equal(game.players[3].alive, false);
});

test("la sauvegarde versionnée se recharge et rejette un import invalide", () => {
  const game = gameWithPlayers(5);
  saveGame(game);
  assert.equal(loadGame().id, game.id);
  assert.equal(parseImport(JSON.stringify(exportPayload(game))).id, game.id);
  assert.throws(() => parseImport("pas du json"), /JSON valide/);
  assert.throws(() => parseImport(JSON.stringify({ version: 99, game })), /incompatible/);
});

test("un couple mixte seul survivant déclenche la victoire des Amoureux", () => {
  const game = gameWithPlayers(5);
  game.status = "active";
  game.players.forEach((player, index) => { player.roleId = index === 0 ? "werewolf" : "villager"; player.team = index === 0 ? "wolves" : "village"; player.alive = index < 2; });
  game.relationships.push({ type: "lovers", playerIds: [game.players[0].id, game.players[1].id] });
  assert.equal(checkVictory(game).team, "lovers");
});
