import { ROLES, TEAM_LABELS, getRole } from "./roles.js";
import { PHASE_LABELS } from "./game.js";
import { currentNightStep } from "./night.js";
import { tallyVotes } from "./voting.js";
import { escapeHtml, formatTime } from "./utils.js";

const icon = (path, classes = "h-5 w-5") => `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="${classes}">${path}</svg>`;
export const ICONS = {
  moon: icon('<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>'),
  users: icon('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'),
  menu: icon('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  arrow: icon('<path d="m9 18 6-6-6-6"/>'),
  plus: icon('<path d="M12 5v14M5 12h14"/>'),
  back: icon('<path d="m15 18-6-6 6-6"/>'),
  clock: icon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  skull: icon('<path d="M5 16v-1a7 7 0 1 1 14 0v1l-2 2v3H7v-3l-2-2Z"/><path d="M9 13h.01M15 13h.01M10 17v4M14 17v4"/>'),
  note: icon('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>'),
};

const btn = (label, action, variant = "primary", attrs = "") => {
  const styles = {
    primary: "bg-amberwood text-forest-950 hover:bg-[#d8aa59] shadow-lg shadow-black/15",
    secondary: "border border-white/15 bg-white/[.06] text-parchment hover:bg-white/[.10]",
    danger: "border border-red-800/60 bg-wolf/30 text-red-100 hover:bg-wolf/50",
    ghost: "text-stone-300 hover:bg-white/[.06] hover:text-white",
  };
  return `<button type="button" data-action="${action}" ${attrs} class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-amberwood/80 disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]}">${label}</button>`;
};
const field = "min-h-11 w-full rounded-xl border border-white/15 bg-black/20 px-3.5 py-2.5 text-parchment placeholder:text-stone-500 focus:border-amberwood/70 focus:outline-none focus:ring-2 focus:ring-amberwood/20";
const card = "rounded-2xl border border-white/10 bg-forest-900/85 shadow-glow";
const label = (text, forId = "") => `<label ${forId ? `for="${forId}"` : ""} class="mb-1.5 block text-sm font-medium text-stone-300">${text}</label>`;
const statusBadge = (alive) => `<span class="rounded-full border px-2.5 py-1 text-xs font-semibold ${alive ? "border-moss/30 bg-moss/10 text-[#bbd2b2]" : "border-red-800/50 bg-wolf/20 text-red-200"}">${alive ? "Vivant" : "Mort"}</span>`;

function logo(size = "normal") {
  return `<div class="flex items-center gap-3"><span class="grid ${size === "large" ? "h-14 w-14" : "h-10 w-10"} place-items-center rounded-2xl border border-amberwood/30 bg-amberwood/10 text-amberwood">${ICONS.moon}</span><div><p class="font-display ${size === "large" ? "text-2xl" : "text-lg"} font-semibold tracking-wide text-parchment">Werewolf Manager</p>${size === "large" ? '<p class="text-xs uppercase tracking-[.22em] text-moss">Maître du village</p>' : ""}</div></div>`;
}

function home(hasSave) {
  return `<main class="mist flex min-h-screen items-center justify-center px-5 py-12"><section class="w-full max-w-lg text-center">
    <div class="mb-10 flex justify-center">${logo("large")}</div>
    <h1 class="font-display text-4xl leading-tight text-white sm:text-5xl">Le village s’endort.<br><span class="text-amberwood">À vous de guider la nuit.</span></h1>
    <p class="mx-auto mt-5 max-w-md text-base leading-relaxed text-stone-300">Le tableau de bord privé du Maître du Jeu, de la préparation jusqu’à la victoire.</p>
    <div class="mx-auto mt-10 grid max-w-sm gap-3">${btn(`${ICONS.plus} Nouvelle partie`, "new-game")} ${hasSave ? btn(`${ICONS.arrow} Reprendre la partie`, "resume-game", "secondary") : ""} ${btn("Importer une partie", "import-game", "ghost")} ${btn("Paramètres", "open-settings", "ghost")}</div>
    <p class="mt-10 text-xs text-stone-500">Données conservées uniquement sur cet appareil</p>
  </section></main>`;
}

function setup(game) {
  const count = game.players.length;
  const rolesCount = game.composition.werewolf + game.composition.villager + game.composition.specials.length;
  const distinctRoleCount = Number(game.composition.werewolf > 0) + Number(game.composition.villager > 0) + game.composition.specials.length;
  const werewolfRole = getRole("werewolf");
  const villagerRole = getRole("villager");
  const specialVillageRoles = ROLES.filter((role) => role.team === "village" && role.id !== "villager");
  const campSeparator = (name, tone) => `<div role="separator" aria-label="${name}" class="flex items-center gap-3 py-2"><span class="h-px flex-1 ${tone === "wolf" ? "bg-wolf/60" : "bg-moss/40"}"></span><div class="flex items-center gap-2 rounded-full border px-3 py-1.5 ${tone === "wolf" ? "border-wolf/50 bg-wolf/10 text-red-200" : "border-moss/30 bg-moss/10 text-[#bbd2b2]"}"><span class="h-1.5 w-1.5 rounded-full ${tone === "wolf" ? "bg-red-400" : "bg-moss"}"></span><span class="text-xs font-semibold uppercase tracking-[.14em]">${name}</span></div><span class="h-px flex-1 ${tone === "wolf" ? "bg-wolf/60" : "bg-moss/40"}"></span></div>`;
  return `<div class="min-h-screen"><header class="border-b border-white/10 px-4 py-4 sm:px-6"><div class="mx-auto flex max-w-6xl items-center justify-between">${logo()}${btn("Quitter", "go-home", "ghost")}</div></header>
  <main class="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10">
    <div class="mb-8"><p class="text-sm font-semibold uppercase tracking-[.18em] text-amberwood">Nouvelle partie</p><h1 class="mt-2 font-display text-3xl text-white">Préparez votre village</h1><p class="mt-2 text-stone-400">Ajoutez les joueurs, puis composez les rôles. Tout reste modifiable avant le lancement.</p></div>
    <div class="grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
      <section class="${card} p-5 sm:p-6"><div class="mb-5 flex items-center justify-between"><div><h2 class="text-lg font-semibold text-white">1. Joueurs</h2><p class="text-sm text-stone-400">${count} participant${count > 1 ? "s" : ""}</p></div>${btn("Noms temporaires", "fill-players", "ghost")}</div>
        <div class="mb-5">${label("Nom de la partie", "game-name")}<input id="game-name" data-change="game-name" value="${escapeHtml(game.name)}" class="${field}"></div>
        <form data-form="add-player" class="mb-4 flex gap-2"><label class="sr-only" for="player-name">Nom du joueur</label><input id="player-name" name="name" autocomplete="off" placeholder="Nom du joueur" class="${field}">${btn(`${ICONS.plus}<span class="sr-only sm:not-sr-only">Ajouter</span>`, "submit-player")}</form>
        <div class="space-y-2">${game.players.length ? game.players.map((player, index) => `<div class="flex items-center gap-2 rounded-xl border border-white/10 bg-black/15 p-2"><span class="w-7 text-center text-xs text-stone-500">${index + 1}</span><input aria-label="Nom de ${escapeHtml(player.name)}" data-player-name="${player.id}" value="${escapeHtml(player.name)}" class="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-parchment outline-none focus:ring-2 focus:ring-amberwood/30 rounded-lg"><button data-action="move-player" data-id="${player.id}" data-direction="up" aria-label="Monter ${escapeHtml(player.name)}" class="h-10 w-10 rounded-lg text-stone-400 hover:bg-white/5 disabled:opacity-20" ${index === 0 ? "disabled" : ""}>↑</button><button data-action="move-player" data-id="${player.id}" data-direction="down" aria-label="Descendre ${escapeHtml(player.name)}" class="h-10 w-10 rounded-lg text-stone-400 hover:bg-white/5 disabled:opacity-20" ${index === count - 1 ? "disabled" : ""}>↓</button><button data-action="remove-player" data-id="${player.id}" aria-label="Supprimer ${escapeHtml(player.name)}" class="h-10 w-10 rounded-lg text-red-300 hover:bg-wolf/20">×</button></div>`).join("") : '<div class="rounded-xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-stone-500">Ajoutez au moins 5 joueurs pour commencer.</div>'}</div>
        ${count > 1 ? `<div class="mt-4">${btn("Mélanger l’ordre", "shuffle-players", "ghost")}</div>` : ""}
      </section>
      <section class="${card} p-5 sm:p-6"><div class="mb-5 flex items-start justify-between gap-3"><div><h2 class="text-lg font-semibold text-white">2. Composition</h2><p class="text-sm text-stone-400">Suggestion modifiable librement</p></div>${btn("Appliquer la recommandation", "recommend-roles", "secondary")}</div>
        <div class="mb-5 grid grid-cols-2 gap-3"><div class="rounded-xl bg-black/20 p-4"><p class="text-xs uppercase tracking-wider text-stone-500">Joueurs</p><p class="mt-1 text-2xl font-semibold">${count}</p></div><div class="rounded-xl bg-black/20 p-4"><p class="text-xs uppercase tracking-wider text-stone-500">Rôles différents</p><p class="mt-1 text-2xl font-semibold text-[#bbd2b2]">${distinctRoleCount}</p></div></div>
        <div class="space-y-2">
          ${campSeparator("Camp des Loups", "wolf")}
          <div class="flex items-center gap-3 rounded-xl border border-wolf/40 bg-wolf/10 p-3"><span class="text-red-300">${werewolfRole.icon}</span><div class="min-w-0 flex-1"><p class="font-medium">${werewolfRole.name}</p><p class="text-xs text-stone-500">Se réveillent ensemble pendant la nuit</p></div><input type="number" min="0" max="${count}" data-role-count="werewolf" value="${game.composition.werewolf}" aria-label="Nombre de Loups-Garous" class="${field} !w-20 text-center"></div>
          ${campSeparator("Camp du Village", "village")}
          <div class="flex items-center gap-3 rounded-xl border border-white/10 p-3"><span class="text-moss">${villagerRole.icon}</span><div class="min-w-0 flex-1"><p class="font-medium">${villagerRole.name}</p><p class="text-xs text-stone-500">Complète automatiquement la composition</p></div><span class="rounded-lg bg-white/5 px-3 py-2 font-semibold">${game.composition.villager}</span></div>
          ${specialVillageRoles.map((role) => `<label class="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 p-3 transition hover:bg-white/[.03]"><span class="text-amberwood">${role.icon}</span><span class="min-w-0 flex-1"><span class="block font-medium">${role.name}</span><span class="block truncate text-xs text-stone-500">${role.description}</span></span><input type="checkbox" data-special-role="${role.id}" class="h-5 w-5 rounded border-white/20 bg-black/20 text-amberwood focus:ring-amberwood" ${game.composition.specials.includes(role.id) ? "checked" : ""}></label>`).join("")}
        </div>
        ${rolesCount !== count ? `<div class="mt-5 rounded-xl border border-amberwood/30 bg-amberwood/10 p-3 text-sm text-amber-200">Écart : ${Math.abs(count - rolesCount)} rôle${Math.abs(count - rolesCount) > 1 ? "s" : ""}. Ajustez la composition.</div>` : ""}
        <div class="mt-5">${btn(`Continuer vers l’attribution ${ICONS.arrow}`, "go-distribution", "primary", rolesCount !== count || count < 5 ? "disabled" : "")}</div>
      </section>
    </div>
  </main></div>`;
}

function distribution(game) {
  const assigned = game.players.every((player) => player.roleId);
  return `<div class="min-h-screen"><header class="border-b border-white/10 px-4 py-4"><div class="mx-auto flex max-w-5xl items-center justify-between">${logo()}${btn(`${ICONS.back} Configuration`, "back-setup", "ghost")}</div></header><main class="mx-auto max-w-5xl px-4 py-8 sm:px-6">
    <div class="mb-7"><p class="text-sm font-semibold uppercase tracking-[.18em] text-amberwood">Attribution MJ</p><h1 class="mt-2 font-display text-3xl text-white">Attribuez les rôles</h1><p class="mt-2 text-stone-400">Cet écran contient les informations secrètes de la partie et reste réservé au Maître du Jeu.</p></div>
    ${!assigned ? `<section class="${card} p-6 text-center sm:p-10"><div class="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-amberwood/10 text-amberwood">${ICONS.users}</div><h2 class="text-xl font-semibold text-white">${game.players.length} joueurs, ${game.players.length} rôles</h2><p class="mx-auto mt-2 max-w-md text-stone-400">L’attribution utilise un mélange Fisher–Yates. Le résultat sera immédiatement affiché dans votre espace MJ.</p><div class="mt-7">${btn("Attribuer aléatoirement", "assign-roles")}</div></section>` : `<section class="${card} overflow-hidden"><div class="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6"><div><h2 class="font-semibold text-white">Attribution prête</h2><p class="mt-0.5 text-sm text-stone-400">Vérifiez les rôles avant de lancer la partie.</p></div><span class="rounded-full border border-amberwood/30 bg-amberwood/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[.12em] text-amber-200">Visible par le MJ</span></div><div class="grid gap-2 p-4 sm:grid-cols-2 sm:p-6">${game.players.map((player) => { const role = getRole(player.roleId); return `<div class="flex items-center gap-3 rounded-xl border ${role.team === "wolves" ? "border-wolf/40 bg-wolf/10" : "border-white/10 bg-black/10"} p-3"><span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl ${role.team === "wolves" ? "bg-wolf/20 text-red-300" : "bg-moss/10 text-moss"}">${role.icon}</span><div class="min-w-0"><p class="truncate font-semibold text-white">${escapeHtml(player.name)}</p><p class="text-sm ${role.team === "wolves" ? "text-red-200" : "text-stone-400"}">${role.name}</p></div></div>`; }).join("")}</div><div class="flex flex-wrap justify-end gap-3 border-t border-white/10 px-5 py-4 sm:px-6">${btn("Relancer l’attribution", "reassign-roles", "secondary")} ${btn("Lancer la première nuit", "launch-game")}</div></section>`}
    ${!assigned ? `<section class="mt-5 ${card} p-5 sm:p-6"><details><summary class="cursor-pointer font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amberwood/50">Ou attribuer les rôles manuellement</summary><p class="mt-2 text-sm text-stone-400">Utilisez exactement les rôles de la composition configurée.</p><div class="mt-5 space-y-2">${game.players.map((player) => `<div class="grid grid-cols-[1fr_1fr] items-center gap-3"><span class="truncate text-sm font-medium">${escapeHtml(player.name)}</span><select data-manual-role="${player.id}" aria-label="Rôle de ${escapeHtml(player.name)}" class="${field} !min-h-10 !py-2"><option value="">Choisir</option>${ROLES.map((role) => `<option value="${role.id}">${role.name}</option>`).join("")}</select></div>`).join("")}</div><div class="mt-5">${btn("Valider l’attribution manuelle", "assign-manual", "secondary")}</div></details></section>` : ""}
  </main></div>`;
}

function gameHeader(game) {
  return `<header class="sticky top-0 z-30 border-b border-white/10 bg-forest-950/95 px-4 py-3 backdrop-blur"><div class="mx-auto flex max-w-7xl items-center gap-3"><div class="hidden sm:block">${logo()}</div><button data-action="game-home" class="font-display text-lg font-semibold sm:hidden">Werewolf</button><div class="h-8 w-px bg-white/10"></div><div class="min-w-0 flex-1"><div class="flex items-center gap-2"><p class="truncate text-sm font-semibold text-white">${escapeHtml(game.name)}</p><span class="hidden rounded-full border border-amberwood/20 bg-amberwood/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-200 sm:inline">Espace MJ</span></div><p class="truncate text-xs text-amberwood">${PHASE_LABELS[game.phase]}</p></div><div class="hidden items-center gap-2 md:flex">${btn("Annuler", "undo", "ghost")}</div>${btn(ICONS.menu, "toggle-menu", "ghost", 'aria-label="Ouvrir le menu"')}</div></header>`;
}

function stats(game) {
  const alive = game.players.filter((player) => player.alive);
  const wolves = alive.filter((player) => player.team === "wolves");
  return `<div class="grid grid-cols-2 gap-3 sm:grid-cols-4"><div class="rounded-xl border border-white/10 bg-black/15 p-3"><p class="text-xs text-stone-500">Temps</p><p class="mt-1 font-semibold">${game.phase === "night" || game.phase === "night-resolution" ? `Nuit ${game.night}` : `Jour ${game.day}`}</p></div><div class="rounded-xl border border-white/10 bg-black/15 p-3"><p class="text-xs text-stone-500">Vivants</p><p class="mt-1 font-semibold">${alive.length}</p></div><div class="rounded-xl border border-white/10 bg-black/15 p-3"><p class="text-xs text-stone-500">Morts</p><p class="mt-1 font-semibold">${game.players.length - alive.length}</p></div><div class="rounded-xl border border-white/10 bg-black/15 p-3"><p class="text-xs text-stone-500">Loups vivants</p><p class="mt-1 font-semibold text-red-200">${wolves.length}</p></div></div>`;
}

function playerCards(game) {
  return `<div class="space-y-2">${game.players.map((player) => { const role = getRole(player.roleId); const lover = game.relationships.find((link) => link.type === "lovers" && link.playerIds.includes(player.id)); return `<article class="rounded-xl border ${player.alive ? "border-white/10 bg-black/10" : "border-red-950/50 bg-black/25 opacity-70"} p-3"><div class="flex items-center gap-3"><span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl ${role.team === "wolves" ? "bg-wolf/20 text-red-300" : "bg-moss/10 text-moss"}">${role.icon}</span><div class="min-w-0 flex-1"><div class="flex flex-wrap items-center gap-2"><h3 class="truncate font-semibold text-white">${escapeHtml(player.name)}</h3>${statusBadge(player.alive)}${lover ? '<span class="rounded-full border border-amberwood/30 bg-amberwood/10 px-2 py-1 text-[11px] text-amber-200">Amoureux</span>' : ""}</div><p class="mt-1 text-sm text-stone-400">${role.name} · ${TEAM_LABELS[role.team]}</p>${!player.alive ? `<p class="mt-1 text-xs text-red-200">${escapeHtml(player.deathCause || "Cause inconnue")}</p>` : ""}</div><button data-action="player-menu" data-id="${player.id}" aria-label="Actions pour ${escapeHtml(player.name)}" class="grid h-11 w-11 place-items-center rounded-xl text-stone-400 hover:bg-white/5">${ICONS.menu}</button></div></article>`; }).join("")}</div>`;
}

function nightPanel(game) {
  if (!game.pendingNight) return `<section class="${card} p-6 text-center"><div class="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amberwood/10 text-amberwood">${ICONS.moon}</div><h2 class="mt-4 text-xl font-semibold text-white">Nuit ${game.night}</h2><p class="mt-2 text-stone-400">L’assistant appellera uniquement les rôles présents et actifs, dans le bon ordre.</p><div class="mt-6">${btn("Commencer les actions nocturnes", "start-night")}</div></section>`;
  const step = currentNightStep(game);
  if (!step) return `<section class="${card} p-6 text-center"><h2 class="text-xl font-semibold text-white">Toutes les actions sont enregistrées</h2><p class="mt-2 text-stone-400">Les conséquences ne seront appliquées qu’après votre validation.</p><div class="mt-6">${btn("Préparer la résolution", "resolve-night")}</div></section>`;
  const role = getRole(step.roleId);
  const alive = game.players.filter((player) => player.alive);
  const options = (filter = () => true) => `<option value="">Choisir un joueur</option>${alive.filter(filter).map((player) => `<option value="${player.id}">${escapeHtml(player.name)}</option>`).join("")}`;
  let action = "";
  if (step.actionType === "wolves") action = `<p class="mb-4 text-stone-300">Choisissez la victime des Loups-Garous.</p>${label("Victime", "night-target")}<select id="night-target" class="${field}">${options((player) => game.settings.wolvesCanTargetWolf || player.team !== "wolves")}</select>`;
  if (step.actionType === "seer") action = `<p class="mb-4 text-stone-300">Choisissez la personne que la Voyante souhaite observer.</p>${label("Joueur observé", "night-target")}<select id="night-target" class="${field}">${options()}</select><div id="seer-result" class="mt-3 hidden rounded-xl border border-amberwood/30 bg-amberwood/10 p-4"></div>`;
  if (step.actionType === "cupid") action = `<p class="mb-4 text-stone-300">Sélectionnez deux amoureux différents.</p><div class="grid gap-3 sm:grid-cols-2"><div>${label("Premier amoureux", "cupid-first")}<select id="cupid-first" class="${field}">${options()}</select></div><div>${label("Second amoureux", "cupid-second")}<select id="cupid-second" class="${field}">${options()}</select></div></div>`;
  if (step.actionType === "witch") {
    const witch = game.players.find((player) => player.alive && player.roleId === "witch");
    const victim = game.players.find((player) => player.id === game.pendingNight.actions.wolves?.targetId);
    const life = !witch.effects.includes("life-potion-used"), death = !witch.effects.includes("death-potion-used");
    const selfForbidden = victim?.id === witch.id && !game.settings.witchCanSaveSelf;
    action = `<p class="mb-4 text-stone-300">Victime des Loups : <strong class="text-white">${victim ? escapeHtml(victim.name) : "aucune"}</strong></p><label class="flex items-center gap-3 rounded-xl border border-white/10 p-3 ${!life || !victim || selfForbidden ? "opacity-50" : ""}"><input id="witch-save" type="checkbox" class="h-5 w-5" ${!life || !victim || selfForbidden ? "disabled" : ""}><span>Sauver la victime <small class="block text-stone-500">${selfForbidden ? "Règle d’auto-sauvetage désactivée" : `Potion ${life ? "disponible" : "utilisée"}`}</small></span></label><div class="mt-3">${label(`Empoisonner un joueur — potion ${death ? "disponible" : "utilisée"}`, "witch-kill")}<select id="witch-kill" class="${field}" ${!death ? "disabled" : ""}><option value="">Ne personne empoisonner</option>${alive.filter((player) => player.roleId !== "witch").map((player) => `<option value="${player.id}">${escapeHtml(player.name)}</option>`).join("")}</select></div>`;
  }
  return `<section class="${card} overflow-hidden"><div class="border-b border-white/10 px-5 py-3 text-sm text-stone-400">Étape ${game.pendingNight.index + 1} sur ${game.pendingNight.steps.length}</div><div class="p-5 sm:p-6"><div class="mb-5 flex items-center gap-3"><span class="grid h-12 w-12 place-items-center rounded-xl bg-amberwood/10 text-amberwood">${role.icon}</span><div><p class="text-xs uppercase tracking-[.16em] text-stone-500">Se réveille</p><h2 class="text-xl font-semibold text-white">${role.name}</h2></div></div>${action}<div class="mt-6">${btn("Valider et continuer", "validate-night")}</div></div></section>`;
}

function nightResolution(game) {
  const summary = game.pendingNight?.summary;
  if (!summary) return `<section class="${card} p-6"><p>Le bilan de la nuit n’est pas disponible.</p></section>`;
  const name = (id) => game.players.find((player) => player.id === id)?.name || "Personne";
  return `<section class="${card} p-5 sm:p-6"><p class="text-sm font-semibold uppercase tracking-[.18em] text-amberwood">Résolution de la nuit</p><h2 class="mt-2 font-display text-2xl text-white">Avant le réveil</h2><dl class="mt-6 space-y-3 text-sm"><div class="flex justify-between gap-4 border-b border-white/10 pb-3"><dt class="text-stone-400">Victime des Loups</dt><dd class="font-semibold">${summary.wolfTarget ? escapeHtml(name(summary.wolfTarget)) : "Aucune"}</dd></div><div class="flex justify-between gap-4 border-b border-white/10 pb-3"><dt class="text-stone-400">Sauvée par la Sorcière</dt><dd class="font-semibold">${summary.saved ? "Oui" : "Non"}</dd></div><div class="flex justify-between gap-4 border-b border-white/10 pb-3"><dt class="text-stone-400">Empoisonné</dt><dd class="font-semibold">${summary.poisoned ? escapeHtml(name(summary.poisoned)) : "Personne"}</dd></div><div class="pt-2"><dt class="text-stone-400">Morts finales</dt><dd class="mt-2 text-lg font-semibold text-red-200">${summary.deathIds.length ? summary.deathIds.map((id) => escapeHtml(name(id))).join(", ") : "Aucune mort"}</dd></div></dl><div class="mt-7">${btn("Valider le réveil", "apply-night")}</div></section>`;
}

function phasePanel(game) {
  if (game.phase === "night") return nightPanel(game);
  if (game.phase === "night-resolution") return nightResolution(game);
  if (game.phase === "wake") {
    const deaths = game.wakeSummary?.deathIds.map((id) => game.players.find((player) => player.id === id)?.name).filter(Boolean) || [];
    return `<section class="${card} p-6"><p class="text-sm font-semibold uppercase tracking-[.18em] text-amberwood">Le village se réveille</p><h2 class="mt-2 font-display text-2xl text-white">${deaths.length ? `${deaths.length} mort${deaths.length > 1 ? "s" : ""} cette nuit` : "Le village est intact"}</h2><p class="mt-4 text-stone-300">${deaths.length ? deaths.map(escapeHtml).join(", ") : "Personne n’est mort durant la nuit."}</p><div class="mt-6">${btn("Annoncer le résultat et discuter", "next-phase")}</div></section>`;
  }
  if (game.phase === "discussion") return `<section class="${card} p-6"><p class="text-sm font-semibold uppercase tracking-[.18em] text-amberwood">Jour ${game.day}</p><h2 class="mt-2 font-display text-2xl text-white">Le village débat</h2><p class="mt-2 text-stone-400">Écoutez les accusations, prenez des notes et lancez le vote quand le village est prêt.</p><div class="mt-5 flex flex-wrap gap-2">${[60,120,180,300].map((time) => btn(`${time / 60} min`, "set-timer", "secondary", `data-seconds="${time}"`)).join("")}</div><div class="mt-3 flex max-w-xs gap-2"><label class="sr-only" for="custom-timer">Durée personnalisée en minutes</label><input id="custom-timer" type="number" min="1" max="60" placeholder="Minutes" class="${field}">${btn("Appliquer", "set-custom-timer", "secondary")}</div><div class="mt-6">${btn("Passer au vote", "next-phase")}</div></section>`;
  if (game.phase === "vote") return votePanel(game);
  if (game.phase === "resolution") return `<section class="${card} p-6"><p class="text-sm font-semibold uppercase tracking-[.18em] text-amberwood">Résolution</p><h2 class="mt-2 font-display text-2xl text-white">Le vote est appliqué</h2><p class="mt-2 text-stone-400">Traitez les éventuels pouvoirs déclenchés, puis passez à la nuit suivante.</p><div class="mt-6">${btn("Passer à la nuit suivante", "next-phase")}</div></section>`;
  return "";
}

function votePanel(game) {
  const alive = game.players.filter((player) => player.alive);
  const result = tallyVotes(game);
  const opts = `<option value="">Choisir</option>${alive.map((player) => `<option value="${player.id}">${escapeHtml(player.name)}</option>`).join("")}`;
  return `<section class="${card} p-5 sm:p-6"><div class="flex flex-wrap items-center justify-between gap-3"><div><p class="text-sm font-semibold uppercase tracking-[.18em] text-amberwood">Vote du village</p><h2 class="mt-1 font-display text-2xl text-white">Qui sera éliminé ?</h2></div><div class="flex rounded-xl border border-white/10 p-1"><button data-action="vote-mode" data-mode="simple" class="rounded-lg px-3 py-2 text-sm ${game.vote.mode === "simple" ? "bg-amberwood text-forest-950" : "text-stone-400"}">Simple</button><button data-action="vote-mode" data-mode="count" class="rounded-lg px-3 py-2 text-sm ${game.vote.mode === "count" ? "bg-amberwood text-forest-950" : "text-stone-400"}">Comptage</button></div></div>
    ${game.vote.mode === "simple" ? `<div class="mt-6">${label("Joueur éliminé", "simple-vote-target")}<select id="simple-vote-target" class="${field}">${opts}</select></div>` : `<div class="mt-6 space-y-2">${alive.map((voter) => `<div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2"><span class="truncate text-sm">${escapeHtml(voter.name)}</span><span class="text-stone-600">→</span><select data-ballot="${voter.id}" aria-label="Vote de ${escapeHtml(voter.name)}" class="${field} !min-h-10 !py-2">${opts.replace(`value="${game.vote.ballots[voter.id] || ""}"`, `value="${game.vote.ballots[voter.id] || ""}" selected`)}</select></div>`).join("")}</div><div class="mt-5 rounded-xl bg-black/20 p-4"><p class="text-sm font-semibold text-white">Classement</p>${result.ranking.length ? `<ol class="mt-2 space-y-1 text-sm text-stone-300">${result.ranking.map(([id, count]) => `<li class="flex justify-between"><span>${escapeHtml(game.players.find((p) => p.id === id)?.name)}</span><strong>${count} voix</strong></li>`).join("")}</ol>` : '<p class="mt-2 text-sm text-stone-500">Aucun vote saisi.</p>'}${result.leaders.length > 1 ? '<p class="mt-3 text-sm text-amber-200">Égalité : choisissez manuellement l’un des joueurs en tête.</p>' : ""}</div><div class="mt-4">${label("Éliminer parmi les joueurs en tête", "count-vote-target")}<select id="count-vote-target" class="${field}"><option value="">Choisir</option>${result.leaders.map((id) => `<option value="${id}">${escapeHtml(game.players.find((p) => p.id === id)?.name)}</option>`).join("")}</select></div>`}
    <div class="mt-6">${btn("Valider l’élimination", "resolve-vote", "danger")}</div></section>`;
}

function timer(game) {
  return `<section class="${card} p-4"><div class="flex items-center gap-3"><span class="text-amberwood">${ICONS.clock}</span><div class="flex-1"><p class="text-xs uppercase tracking-wider text-stone-500">Chronomètre</p><p id="timer-display" class="font-mono text-2xl font-semibold text-white">${formatTime(game.timer.remaining)}</p></div>${btn(game.timer.running ? "Pause" : "Démarrer", game.timer.running ? "pause-timer" : "start-timer", "secondary")} ${btn("↺", "reset-timer", "ghost", 'aria-label="Réinitialiser le chronomètre"')}</div></section>`;
}

function dashboard(game, panel = "game") {
  const victory = game.victoryDismissed ? null : game._victory;
  const content = panel === "players" ? `<section class="${card} p-4 sm:p-5"><div class="mb-4 flex items-center justify-between"><h2 class="text-lg font-semibold text-white">Tous les joueurs</h2><span class="text-sm text-stone-500">${game.players.length}</span></div>${playerCards(game)}</section>` : panel === "history" ? historyPanel(game) : panel === "notes" ? notesPanel(game) : `<div class="space-y-5">${phasePanel(game)}${timer(game)}</div>`;
  return `<div class="min-h-screen pb-24">${gameHeader(game)}<main class="mx-auto max-w-7xl px-4 py-5 sm:px-6"><div class="mb-5">${stats(game)}</div>${victory ? `<div class="mb-5 rounded-2xl border border-amberwood/40 bg-amberwood/10 p-4"><p class="font-semibold text-amber-100">Condition de victoire potentielle détectée</p><p class="mt-1 text-sm text-stone-300">${victory.label} — ${victory.reason}</p><div class="mt-3 flex gap-2">${btn("Terminer la partie", "end-game")} ${btn("Continuer", "dismiss-victory", "ghost")}</div></div>` : ""}<div class="grid gap-5 lg:grid-cols-[1.08fr_.92fr]"><div>${content}${panel === "game" && !["night-resolution", "wake", "resolution"].includes(game.phase) ? `<div class="mt-3">${btn(`${ICONS.back} Étape précédente`, "previous-phase", "ghost", game.phase === "night" && game.night === 1 ? "disabled" : "")}</div>` : ""}</div><aside class="hidden lg:block"><section class="${card} p-4"><div class="mb-4 flex items-center justify-between"><h2 class="font-semibold text-white">Joueurs</h2>${btn("Tout voir", "panel-players", "ghost")}</div>${playerCards(game)}</section></aside></div></main>${bottomNav(panel)}</div>`;
}

function bottomNav(active) {
  const items = [["game", "Partie", ICONS.moon], ["players", "Joueurs", ICONS.users], ["history", "Historique", ICONS.clock], ["notes", "Notes", ICONS.note]];
  return `<nav aria-label="Navigation de partie" class="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-forest-950/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur"><div class="mx-auto grid max-w-xl grid-cols-4">${items.map(([id, text, svg]) => `<button data-action="panel-${id}" class="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] ${active === id ? "bg-amberwood/10 text-amberwood" : "text-stone-400 hover:text-white"}">${svg}${text}</button>`).join("")}</div></nav>`;
}

function historyPanel(game) {
  return `<section class="${card} p-5"><div class="mb-4 flex items-center justify-between"><h2 class="text-lg font-semibold text-white">Journal du MJ</h2><span class="text-sm text-stone-500">${game.history.length} événements</span></div><div class="space-y-2">${game.history.length ? game.history.map((event) => `<article class="rounded-xl border border-white/10 bg-black/10 p-3"><div class="flex justify-between gap-3"><p class="text-sm text-parchment">${escapeHtml(event.message)}</p><span class="shrink-0 text-[11px] text-stone-600">${["announcement", "public"].includes(event.visibility) ? "À annoncer" : "Secret MJ"}</span></div><p class="mt-1 text-xs text-stone-500">${event.night ? `Nuit ${event.night}` : `Jour ${event.day}`} · ${PHASE_LABELS[event.phase] || event.phase}</p></article>`).join("") : '<p class="text-sm text-stone-500">Le journal est vide.</p>'}</div></section>`;
}

function notesPanel(game) {
  return `<section class="${card} p-5"><h2 class="text-lg font-semibold text-white">Notes du MJ</h2><p class="mt-1 text-sm text-stone-400">Sauvegarde automatique dans votre espace de gestion privé.</p><div class="mt-5">${label("Notes générales", "general-notes")}<textarea id="general-notes" data-change="general-notes" rows="7" class="${field}">${escapeHtml(game.generalNotes)}</textarea></div><div class="mt-6 space-y-4">${game.players.map((player) => `<div>${label(escapeHtml(player.name), `notes-${player.id}`)}<textarea id="notes-${player.id}" data-player-notes="${player.id}" rows="2" class="${field}">${escapeHtml(player.notes)}</textarea></div>`).join("")}</div></section>`;
}

function settings(settings, inGame) {
  const toggle = (key, title, description) => `<label class="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 p-3"><span class="min-w-0 flex-1"><span class="block font-medium text-white">${title}</span><span class="mt-0.5 block text-sm text-stone-400">${description}</span></span><input type="checkbox" data-setting="${key}" class="mt-1 h-5 w-5" ${settings[key] ? "checked" : ""}></label>`;
  return `<div class="min-h-screen"><header class="border-b border-white/10 px-4 py-4"><div class="mx-auto flex max-w-3xl items-center justify-between">${logo()}${btn("Fermer", inGame ? "close-settings-game" : "go-home", "ghost")}</div></header><main class="mx-auto max-w-3xl px-4 py-8 sm:px-6"><p class="text-sm font-semibold uppercase tracking-[.18em] text-amberwood">Préférences</p><h1 class="mt-2 font-display text-3xl text-white">Paramètres</h1><div class="mt-7 space-y-3">${toggle("animations", "Animations", "Transitions discrètes entre les écrans.")}${toggle("confirmations", "Confirmations", "Demander avant les actions destructrices.")}${toggle("compact", "Affichage compact", "Réduire les espacements des listes.")}${toggle("wolvesCanTargetWolf", "Les Loups peuvent cibler un Loup", "Autorise les cibles du même camp.")}${toggle("witchCanUseBoth", "Deux potions la même nuit", "Autorise la Sorcière à sauver et empoisonner simultanément.")}${toggle("witchCanSaveSelf", "La Sorcière peut se sauver", "Règle optionnelle conservée avec la partie.")}<div class="grid gap-3 sm:grid-cols-2"><div>${label("Révélation de la Voyante", "setting-seer")}<select id="setting-seer" data-setting-value="seerReveal" class="${field}"><option value="role" ${settings.seerReveal === "role" ? "selected" : ""}>Rôle exact</option><option value="team" ${settings.seerReveal === "team" ? "selected" : ""}>Camp uniquement</option></select></div><div>${label("Timer par défaut", "setting-timer")}<select id="setting-timer" data-setting-value="timerDuration" class="${field}">${[60,120,180,300].map((seconds) => `<option value="${seconds}" ${settings.timerDuration === seconds ? "selected" : ""}>${seconds / 60} minute${seconds > 60 ? "s" : ""}</option>`).join("")}</select></div></div></div></main></div>`;
}

function summary(game) {
  const elimination = [...game.players].filter((p) => !p.alive).sort((a,b) => (a.deathRound || 99) - (b.deathRound || 99));
  return `<div class="min-h-screen"><header class="border-b border-white/10 px-4 py-4"><div class="mx-auto max-w-5xl">${logo()}</div></header><main class="mx-auto max-w-5xl px-4 py-10 sm:px-6"><div class="text-center"><p class="text-sm font-semibold uppercase tracking-[.22em] text-amberwood">Partie terminée</p><h1 class="mt-3 font-display text-4xl text-white">${escapeHtml(game.winner?.label || "Fin de partie")}</h1><p class="mt-2 text-stone-400">${escapeHtml(game.winner?.reason || "")}</p></div><section class="mt-9 ${card} overflow-hidden"><div class="grid grid-cols-[1fr_1fr_auto] gap-3 border-b border-white/10 px-4 py-3 text-xs uppercase tracking-wider text-stone-500"><span>Joueur</span><span>Rôle</span><span>Statut</span></div>${game.players.map((player) => `<div class="grid grid-cols-[1fr_1fr_auto] items-center gap-3 border-b border-white/5 px-4 py-3 text-sm"><span class="font-semibold">${escapeHtml(player.name)}</span><span class="text-stone-300">${getRole(player.roleId).name}</span>${statusBadge(player.alive)}</div>`).join("")}</section><div class="mt-6 grid gap-6 md:grid-cols-2"><section class="${card} p-5"><h2 class="font-semibold text-white">Ordre des éliminations</h2><ol class="mt-3 space-y-2 text-sm">${elimination.length ? elimination.map((p) => `<li>${escapeHtml(p.name)} <span class="text-stone-500">— ${escapeHtml(p.deathCause)}</span></li>`).join("") : '<li class="text-stone-500">Aucune élimination</li>'}</ol></section><section class="${card} p-5"><h2 class="font-semibold text-white">Durée</h2><p class="mt-3 text-stone-300">${game.day} jour${game.day > 1 ? "s" : ""} · ${game.night} nuit${game.night > 1 ? "s" : ""}</p></section></div><section class="mt-6 ${card} p-5"><h2 class="font-semibold text-white">Historique complet</h2><div class="mt-3 max-h-80 space-y-2 overflow-y-auto">${game.history.map((event) => `<p class="border-b border-white/5 pb-2 text-sm text-stone-300">${escapeHtml(event.message)}</p>`).join("")}</div></section><div class="mt-8 flex flex-wrap justify-center gap-3">${btn("Exporter la partie", "export-game", "secondary")} ${btn("Nouvelle partie", "new-game")}</div></main></div>`;
}

export function render(state) {
  const { view, game, settings, panel, hasSave } = state;
  if (view === "home") return home(hasSave);
  if (view === "setup") return setup(game);
  if (view === "distribution") return distribution(game);
  if (view === "settings") return settings(game?.settings || settings, Boolean(game?.status === "active"));
  if (view === "summary") return summary(game);
  return dashboard(game, panel);
}

export function menuModal(game) {
  return `<div class="space-y-2">${btn("Annuler la dernière action", "undo", "secondary", 'class="w-full"')} ${btn("Exporter la partie", "export-game", "secondary", 'class="w-full"')} ${btn("Paramètres", "open-settings", "secondary", 'class="w-full"')} ${btn("Retour à l’accueil", "go-home", "ghost", 'class="w-full"')} ${btn("Supprimer la sauvegarde", "delete-save", "danger", 'class="w-full"')}</div>`;
}

export function playerModal(player) {
  return `<div class="space-y-3"><div class="rounded-xl bg-black/20 p-4"><p class="font-semibold text-white">${escapeHtml(player.name)}</p><p class="text-sm text-stone-400">${getRole(player.roleId).name} · ${TEAM_LABELS[player.team]}</p></div><div>${label("Modifier le rôle", "modal-role")}<select id="modal-role" class="${field}">${ROLES.map((role) => `<option value="${role.id}" ${role.id === player.roleId ? "selected" : ""}>${role.name}</option>`).join("")}</select>${btn("Appliquer le rôle", "apply-player-role", "secondary", `data-id="${player.id}" class="mt-2 w-full"`)}</div>${player.alive ? btn("Tuer manuellement", "kill-player", "danger", `data-id="${player.id}" class="w-full"`) : btn("Ressusciter", "revive-player", "secondary", `data-id="${player.id}" class="w-full"`)}</div>`;
}

export { btn, field, card };
