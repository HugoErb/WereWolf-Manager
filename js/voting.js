import { eliminatePlayer, logEvent, setPhase } from "./game.js";

export function tallyVotes(game) {
  const counts = {};
  Object.values(game.vote.ballots).filter(Boolean).forEach((targetId) => { counts[targetId] = (counts[targetId] || 0) + 1; });
  const ranking = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = ranking[0]?.[1] || 0;
  return { counts, ranking, leaders: ranking.filter(([, count]) => count === top).map(([id]) => id), top };
}

export function resolveVote(game, selectedId) {
  const player = game.players.find((item) => item.id === selectedId && item.alive);
  if (!player) throw new Error("Choisissez un joueur vivant à éliminer.");
  if (game.vote.mode === "count") {
    const result = tallyVotes(game);
    if (!result.leaders.includes(selectedId)) throw new Error("La personne choisie doit faire partie des joueurs en tête.");
    logEvent(game, "vote-tally", `${player.name} reçoit ${result.counts[selectedId]} voix.`, "announcement");
  }
  eliminatePlayer(game, selectedId, "vote du village");
  game.vote.selected = selectedId; game.vote.resolved = true;
  setPhase(game, "resolution");
}
