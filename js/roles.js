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

const RECOMMENDATION_TIERS = [
  {
    min: 5, max: 6, werewolf: 1, specials: ["seer"], profile: "Format court adapté",
    rationale: "Un seul Loup évite une victoire trop rapide de la meute. La Voyante est le premier pouvoir conseillé pour donner au Village une information progressive.",
    caution: "À moins de 8 joueurs, la partie est plus courte et plus sensible au premier vote.",
  },
  {
    min: 7, max: 7, werewolf: 2, specials: ["seer", "witch"], profile: "Format court renforcé",
    rationale: "Le second Loup crée une vraie meute. La Sorcière compense ce palier grâce à ses deux ressources utilisables une seule fois.",
    caution: "Ce palier adapte le jeu classique : chaque élimination pèse lourd et l’équilibre dépend davantage du premier vote.",
  },
  {
    min: 8, max: 8, werewolf: 2, specials: ["seer", "witch"], profile: "Petite table classique",
    rationale: "Deux Loups forment une meute sans atteindre le contrôle trop vite. La Voyante apporte l’information et les potions limitées de la Sorcière compensent la pression nocturne.",
  },
  {
    min: 9, max: 9, werewolf: 2, specials: ["seer", "witch", "hunter"], profile: "Partie classique dynamique",
    rationale: "Le Chasseur ajoute un contre-pouvoir ponctuel sans apporter d’information supplémentaire au Village.",
  },
  {
    min: 10, max: 10, werewolf: 2, specials: ["seer", "witch", "hunter", "cupid"], profile: "Partie classique variée",
    rationale: "Cupidon arrive quand le groupe est assez grand pour absorber la volatilité des Amoureux sans déséquilibrer les premiers tours.",
  },
  {
    min: 11, max: 11, werewolf: 3, specials: ["seer", "witch", "hunter", "cupid"], profile: "Partie soutenue",
    rationale: "Le troisième Loup compense les quatre pouvoirs spéciaux déjà présents et évite que le Village ne dispose de trop de temps pour confirmer ses informations.",
    caution: "Pour un groupe débutant ou une meute très expérimentée, vous pouvez conserver 2 Loups et ajouter un Villageois.",
  },
  {
    min: 12, max: 13, werewolf: 3, specials: ["seer", "witch", "hunter", "cupid"], profile: "Grande table classique",
    rationale: "Le troisième Loup maintient la pression face à quatre rôles spéciaux, tout en restant proche de la limite d’un quart de la table.",
  },
  {
    min: 14, max: 15, werewolf: 3, specials: ["seer", "witch", "hunter", "cupid", "little-girl"], profile: "Grande table expérimentée",
    rationale: "La Petite Fille est ajoutée tardivement car son efficacité dépend beaucoup de l’expérience et de la discipline du groupe.",
    caution: "Pour une table débutante, désactivez la Petite Fille et ajoutez un Villageois.",
  },
  {
    min: 16, max: 19, werewolf: 4, specials: ["seer", "witch", "hunter", "cupid", "little-girl"], profile: "Très grande table",
    rationale: "Quatre Loups conservent une meute proche de 25 % tandis que les cinq rôles spéciaux maintiennent les possibilités de contre-jeu.",
    caution: "Pour une table débutante, désactivez la Petite Fille et ajoutez un Villageois.",
  },
];

export function recommendedComposition(playerCount) {
  const count = Math.max(0, Math.floor(Number(playerCount) || 0));
  if (count < 5) {
    return {
      werewolf: count ? 1 : 0, specials: [], profile: "Composition incomplète",
      rationale: "Ajoutez au moins 5 joueurs pour obtenir une recommandation jouable.",
      caution: "Le format classique est conçu pour 8 joueurs ou plus.",
    };
  }

  const tier = RECOMMENDATION_TIERS.find(({ min, max }) => count >= min && count <= max);
  if (tier) return { ...tier, specials: [...tier.specials] };

  const werewolf = Math.max(4, Math.floor(count / 4));
  return {
    werewolf,
    specials: ["seer", "witch", "hunter", "cupid", "little-girl"],
    profile: "Table étendue",
    rationale: `${werewolf} Loups maintiennent la meute à environ un quart des participants. Les joueurs restants conservent une majorité de Villageois classiques.`,
    caution: "Au-delà de 19 joueurs, prévoyez des tours de parole courts pour garder une partie fluide.",
  };
}
