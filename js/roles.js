const icon = (body) => `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">${body}</svg>`;

export const ROLES = [
  {
    id: "villager", name: "Villageois", team: "village", description: "Aucun pouvoir particulier. Observe, débat et vote pour démasquer les Loups-Garous.",
    nightOrder: null, wakesAtNight: false, unique: false,
    icon: icon('<path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2"/><circle cx="12" cy="7" r="4"/>')
  },
  {
    id: "werewolf", name: "Loup-Garou", team: "wolves", description: "Chaque nuit, les Loups-Garous choisissent ensemble une victime.",
    nightOrder: 20, wakesAtNight: true, unique: false, actionType: "wolves",
    icon: icon('<path d="m5 3 4 3 3-3 3 3 4-3-1 8c0 5-2 9-6 10-4-1-6-5-6-10L5 3Z"/><path d="m9 13 1.5 1M15 13l-1.5 1M10 18h4"/>')
  },
  {
    id: "seer", name: "Voyante", team: "village", description: "Chaque nuit, découvre le rôle ou le camp d’un joueur.",
    nightOrder: 30, wakesAtNight: true, unique: true, actionType: "seer",
    icon: icon('<circle cx="12" cy="12" r="8"/><path d="M4 12c2-3 5-5 8-5s6 2 8 5c-2 3-5 5-8 5s-6-2-8-5Z"/><circle cx="12" cy="12" r="2"/>')
  },
  {
    id: "witch", name: "Sorcière", team: "village", description: "Possède une potion de vie et une potion de mort, utilisables une fois chacune.",
    nightOrder: 40, wakesAtNight: true, unique: true, actionType: "witch",
    icon: icon('<path d="M9 3h6M10 3v5l-4 8a3 3 0 0 0 3 4h6a3 3 0 0 0 3-4l-4-8V3"/><path d="M8 14h8"/>')
  },
  {
    id: "cupid", name: "Cupidon", team: "village", description: "La première nuit, lie deux joueurs. Si l’un meurt, l’autre meurt de chagrin.",
    nightOrder: 10, wakesAtNight: true, firstNightOnly: true, unique: true, actionType: "cupid",
    icon: icon('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/><path d="m4 20 16-16"/>')
  },
  {
    id: "hunter", name: "Chasseur", team: "village", description: "À sa mort, élimine immédiatement le joueur de son choix.",
    nightOrder: null, wakesAtNight: false, unique: true, onDeath: "hunterShot",
    icon: icon('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>')
  },
  {
    id: "little-girl", name: "Petite Fille", team: "village", description: "Peut tenter d’observer discrètement les Loups-Garous. Son pouvoir se joue oralement.",
    nightOrder: null, wakesAtNight: false, unique: true,
    icon: icon('<circle cx="12" cy="8" r="4"/><path d="M6 21v-3a6 6 0 0 1 12 0v3M9 8h.01M15 8h.01"/>')
  }
];

export const ROLE_MAP = Object.fromEntries(ROLES.map((role) => [role.id, role]));
export const TEAM_LABELS = { village: "Village", wolves: "Loups-Garous" };
export const getRole = (id) => ROLE_MAP[id] || ROLE_MAP.villager;
export const roleCounts = (game) => game.players.reduce((counts, player) => ({ ...counts, [player.roleId]: (counts[player.roleId] || 0) + 1 }), {});

export function recommendedComposition(playerCount) {
  const wolves = playerCount < 8 ? 2 : playerCount < 12 ? 3 : playerCount < 16 ? 4 : Math.max(4, Math.floor(playerCount / 4));
  const special = ["seer", "witch"];
  if (playerCount >= 7) special.push("hunter");
  if (playerCount >= 9) special.push("cupid");
  if (playerCount >= 11) special.push("little-girl");
  return {
    werewolf: Math.min(wolves, Math.max(1, playerCount - special.length - 1)),
    specials: special.filter((_, index) => index < Math.max(0, playerCount - wolves - 1)),
  };
}
