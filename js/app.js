import { ROLES, getRole } from "./roles.js";
import { clone, downloadJson, escapeHtml, focusFirst, shuffle } from "./utils.js";
import {
  DEFAULT_SETTINGS, deleteGame, exportPayload, hasSavedGame, loadGame, loadSettings, loadUndo,
  parseImport, saveGame, saveSettings, saveUndo,
} from "./storage.js";
import {
  addPlayer, applyRecommendation, assignRoles, checkVictory, compositionRoles, createGame, endGame, launchGame,
  nextPhase, previousPhase, processDeathQueue, revivePlayer, setPhase, syncComposition, eliminatePlayer, logEvent,
} from "./game.js";
import { applyNightResolution, createNight, currentNightStep, resolveNight, validateNightAction } from "./night.js";
import { resolveVote } from "./voting.js";
import { ICONS, menuModal, mjScript, playerModal, render } from "./ui.js";

const app = document.querySelector("#app");
const modalRoot = document.querySelector("#modal-root");
const importInput = document.querySelector("#import-input");

const state = {
  view: "home", panel: "game", game: null, settings: loadSettings(), hasSave: hasSavedGame(),
  undo: loadUndo(), previousView: "home", modalResolver: null, modalPersistent: false, lastFocused: null,
  manualRoleSelection: null,
};
let dragPreviewElement = null;

function renderApp() {
  if (state.game?.status === "active") state.game._victory = checkVictory(state.game);
  app.innerHTML = render(state);
  app.classList.toggle("compact", Boolean((state.game?.settings || state.settings).compact));
  document.body.classList.toggle("no-animations", !(state.game?.settings || state.settings).animations);
  tickTimer(false);
}

function toast(message, type = "info") {
  const item = document.createElement("div");
  item.className = `pointer-events-auto max-w-sm rounded-xl border px-4 py-3 text-sm font-medium shadow-2xl ${type === "error" ? "border-red-800 bg-[#3b1717] text-red-100" : "border-moss/30 bg-forest-800 text-parchment"}`;
  item.textContent = message;
  document.querySelector("#toast-region").append(item);
  setTimeout(() => item.remove(), 3600);
}

function showModal(title, content, options = {}) {
  state.lastFocused = document.activeElement;
  state.modalPersistent = Boolean(options.persistent);
  modalRoot.innerHTML = `<div class="modal-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" data-modal-backdrop><section role="dialog" aria-modal="true" aria-labelledby="modal-title" class="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-forest-900 p-5 shadow-2xl sm:rounded-2xl sm:p-6"><div class="mb-5 flex items-center justify-between gap-4"><h2 id="modal-title" class="font-display text-xl font-semibold text-white">${title}</h2><button data-action="close-modal" aria-label="Fermer" class="grid h-10 w-10 place-items-center rounded-xl text-stone-400 hover:bg-white/5">×</button></div>${content}</section></div>`;
  focusFirst(modalRoot);
  if (!options.persistent) modalRoot.querySelector("[data-modal-backdrop]")?.addEventListener("click", (event) => { if (event.target === event.currentTarget) closeModal(false); });
}

function closeModal(result = false) {
  modalRoot.innerHTML = "";
  state.modalResolver?.(result);
  state.modalResolver = null;
  state.modalPersistent = false;
  state.lastFocused?.focus?.();
}

function confirmAction(title, message, confirmLabel = "Confirmer") {
  if (!(state.game?.settings || state.settings).confirmations) return Promise.resolve(true);
  return new Promise((resolve) => {
    state.modalResolver = resolve;
    showModal(title, `<p class="leading-relaxed text-stone-300">${escapeHtml(message)}</p><div class="mt-6 flex justify-end gap-2"><button data-action="close-modal" class="min-h-11 rounded-xl px-4 text-sm font-semibold text-stone-300 hover:bg-white/5">Annuler</button><button data-action="confirm-modal" class="min-h-11 rounded-xl bg-wolf px-4 text-sm font-semibold text-white hover:bg-red-800">${escapeHtml(confirmLabel)}</button></div>`, { persistent: true });
  });
}

function remember() {
  if (!state.game) return;
  const snapshot = clone(state.game);
  delete snapshot._victory;
  state.undo.push(snapshot);
  state.undo = state.undo.slice(-12);
  saveUndo(state.undo);
}

function persist() {
  if (!state.game) return;
  state.game.updatedAt = new Date().toISOString();
  const clean = clone(state.game); delete clean._victory;
  saveGame(clean);
  state.hasSave = true;
}

function mutate(operation, options = {}) {
  try {
    if (options.undo !== false) remember();
    operation(state.game);
    persist(); renderApp();
    if (options.queue !== false) handleDeathQueue();
    return true;
  } catch (error) {
    if (options.undo !== false) state.undo.pop();
    toast(error.message || "Cette action n’a pas pu être effectuée.", "error");
    return false;
  }
}

function navigate(view) {
  state.view = view;
  modalRoot.innerHTML = "";
  window.scrollTo({ top: 0, behavior: "smooth" });
  renderApp();
}

function handleDeathQueue() {
  if (!state.game?.pendingDeaths?.length) return;
  const next = state.game.pendingDeaths[0];
  if (next.type === "death") {
    mutate((game) => processDeathQueue(game), { undo: false, queue: false });
    handleDeathQueue();
    return;
  }
  if (next.type === "hunter" && !modalRoot.innerHTML) {
    const hunter = state.game.players.find((player) => player.id === next.playerId);
    const targets = state.game.players.filter((player) => player.alive);
    showModal("Dernier tir du Chasseur", `${mjScript([{ variants: ["Chasseur, dans un dernier souffle, tu peux encore faire feu. Désigne le joueur que tu souhaites emporter avec toi.", "Avant de quitter ce monde, le Chasseur rassemble ses dernières forces et saisit son arme. Chasseur, choisis celui qui tombera sous ton ultime tir."] }, { action: `Attendez que ${escapeHtml(hunter.name)} désigne sa cible, puis sélectionnez-la ci-dessous.` }], state.game.day + state.game.night - 2)}<label for="hunter-target" class="mb-1.5 mt-5 block text-sm font-medium text-stone-300">Cible désignée</label><select id="hunter-target" class="min-h-11 w-full rounded-xl border border-white/15 bg-black/20 px-3.5 py-2.5"><option value="">Choisir un joueur</option>${targets.map((player) => `<option value="${player.id}">${escapeHtml(player.name)}</option>`).join("")}</select><button data-action="hunter-shot" class="mt-5 min-h-11 w-full rounded-xl bg-wolf px-4 font-semibold text-white">Appliquer le dernier tir</button>`, { persistent: true });
  }
}

function assignManualRole(playerId, roleId) {
  if (!roleId) { toast("Sélectionnez d’abord un rôle.", "error"); return; }
  mutate((game) => {
    const player = game.players.find((item) => item.id === playerId);
    if (!player) throw new Error("Joueur introuvable.");
    const allowed = compositionRoles(game).filter((id) => id === roleId).length;
    const usedByOthers = game.players.filter((item) => item.id !== playerId && item.roleId === roleId).length;
    if (!allowed || usedByOthers >= allowed) throw new Error("Tous les exemplaires de ce rôle sont déjà attribués.");
    player.roleId = roleId;
    player.team = getRole(roleId).team;
    const remaining = allowed - game.players.filter((item) => item.roleId === roleId).length;
    if (remaining === 0) state.manualRoleSelection = null;
  }, { undo: false });
}

function updateTimerState(game) {
  if (!game.timer.running || !game.timer.endsAt) return;
  game.timer.remaining = Math.max(0, Math.ceil((game.timer.endsAt - Date.now()) / 1000));
  if (game.timer.remaining === 0) { game.timer.running = false; game.timer.endsAt = null; }
}

function tickTimer(save = true) {
  if (!state.game) return;
  const wasRunning = state.game.timer.running;
  updateTimerState(state.game);
  document.querySelectorAll("#timer-display").forEach((element) => {
    const minutes = String(Math.floor(state.game.timer.remaining / 60)).padStart(2, "0");
    const seconds = String(state.game.timer.remaining % 60).padStart(2, "0");
    element.textContent = `${minutes}:${seconds}`;
  });
  if (save && (wasRunning || !state.game.timer.running)) persist();
}
setInterval(() => tickTimer(), 1000);

function resolveCompletedNight(game) {
  if (game?.phase !== "night" || !game.pendingNight || currentNightStep(game)) return false;
  resolveNight(game);
  setPhase(game, "night-resolution");
  return true;
}

function openSettings() {
  state.previousView = state.view;
  navigate("settings");
}

async function performAction(action, element) {
  const game = state.game;
  if (action === "new-game") {
    if (state.game && await confirmAction("Créer une nouvelle partie", "La partie chargée sera remplacée par une nouvelle configuration.", "Créer" ) === false) return;
    state.undo = []; saveUndo([]); state.game = createGame(state.settings); navigate("setup"); return;
  }
  if (action === "resume-game") {
    const saved = loadGame();
    if (!saved) { toast("La sauvegarde est absente ou corrompue.", "error"); state.hasSave = false; renderApp(); return; }
    state.game = saved; state.settings = { ...state.settings, ...saved.settings };
    if (resolveCompletedNight(state.game)) persist();
    navigate(saved.status === "setup" ? (saved.players.every((p) => p.roleId) ? "distribution" : "setup") : saved.status === "ended" ? "summary" : "game"); return;
  }
  if (action === "go-home") { navigate("home"); return; }
  if (action === "open-settings") { closeModal(); openSettings(); return; }
  if (action === "close-settings-game") { navigate(state.previousView === "settings" ? "game" : state.previousView); return; }
  if (action === "import-game") { importInput.click(); return; }
  if (action === "submit-player") { document.querySelector('[data-form="add-player"]')?.requestSubmit(); return; }
  if (action === "fill-players") {
    if (game.players.length) { toast("Supprimez d’abord les joueurs existants pour générer des noms.", "error"); return; }
    mutate((current) => { for (let i = 1; i <= 8; i += 1) addPlayer(current, `Joueur ${i}`); applyRecommendation(current); }); return;
  }
  if (action === "remove-player") { mutate((current) => { current.players = current.players.filter((p) => p.id !== element.dataset.id); current.players.forEach((player) => { player.roleId = null; player.team = null; }); syncComposition(current); }); return; }
  if (action === "move-player") { mutate((current) => { const index = current.players.findIndex((p) => p.id === element.dataset.id); const target = index + (element.dataset.direction === "up" ? -1 : 1); if (target >= 0 && target < current.players.length) [current.players[index], current.players[target]] = [current.players[target], current.players[index]]; }); return; }
  if (action === "shuffle-players") { mutate((current) => { current.players = shuffle(current.players); }); return; }
  if (action === "recommend-roles") { mutate(applyRecommendation); toast("Composition recommandée appliquée. Elle reste modifiable."); return; }
  if (action === "go-distribution") { state.manualRoleSelection = null; navigate("distribution"); return; }
  if (action === "back-setup") { state.manualRoleSelection = null; navigate("setup"); return; }
  if (action === "assign-roles") { state.manualRoleSelection = null; mutate(assignRoles); return; }
  if (action === "select-manual-role") { state.manualRoleSelection = state.manualRoleSelection === element.dataset.roleId ? null : element.dataset.roleId; renderApp(); return; }
  if (action === "assign-selected-role") { assignManualRole(element.dataset.playerId, state.manualRoleSelection); return; }
  if (action === "clear-manual-role") { const playerId = element.dataset.id; mutate((current) => { const player = current.players.find((item) => item.id === playerId); if (player) { player.roleId = null; player.team = null; } state.manualRoleSelection = null; }, { undo: false }); return; }
  if (action === "reset-role-assignments") { if (await confirmAction("Réinitialiser les rôles", "Toutes les attributions actuelles seront effacées.", "Réinitialiser") === false) return; mutate((current) => { current.players.forEach((player) => { player.roleId = null; player.team = null; }); state.manualRoleSelection = null; }, { undo: false }); return; }
  if (action === "reassign-roles") {
    state.manualRoleSelection = null; mutate(assignRoles); return;
  }
  if (action === "launch-game") { mutate(launchGame); if (state.game.status === "active") navigate("game"); return; }
  if (action.startsWith("panel-")) { state.panel = action.slice(6); renderApp(); return; }
  if (action === "game-home") { state.panel = "game"; renderApp(); return; }
  if (action === "toggle-menu") { showModal("Menu de la partie", menuModal(game)); return; }
  if (action === "player-menu") { showModal("Gérer un joueur", playerModal(game.players.find((p) => p.id === element.dataset.id))); return; }
  if (action === "undo") {
    closeModal();
    const snapshot = state.undo.pop();
    if (!snapshot) { toast("Aucune action à annuler.", "error"); return; }
    state.game = snapshot; saveUndo(state.undo); persist(); renderApp(); toast("Dernière action annulée."); return;
  }
  if (action === "start-night") { mutate((current) => { createNight(current); resolveCompletedNight(current); }); return; }
  if (action === "validate-night") { await handleNightValidation(); return; }
  if (action === "apply-night") { mutate((current) => { applyNightResolution(current); setPhase(current, "wake"); }); return; }
  if (action === "next-phase") { mutate(nextPhase); return; }
  if (action === "previous-phase") { mutate(previousPhase); return; }
  if (action === "vote-mode") { mutate((current) => { current.vote.mode = element.dataset.mode; current.vote.ballots = {}; }, { undo: false }); return; }
  if (action === "resolve-vote") { const id = document.querySelector(game.vote.mode === "simple" ? "#simple-vote-target" : "#count-vote-target")?.value; mutate((current) => resolveVote(current, id)); return; }
  if (action === "kill-player") { if (await confirmAction("Tuer ce joueur", "Cette mort sera ajoutée au journal et peut déclencher d’autres pouvoirs.", "Tuer") === false) return; const id = element.dataset.id; closeModal(); mutate((current) => eliminatePlayer(current, id, "décision manuelle du MJ")); return; }
  if (action === "revive-player") { if (await confirmAction("Ressusciter ce joueur", "Cette correction sera enregistrée dans le journal.", "Ressusciter") === false) return; const id = element.dataset.id; closeModal(); mutate((current) => revivePlayer(current, id)); return; }
  if (action === "apply-player-role") { const id = element.dataset.id; const roleId = document.querySelector("#modal-role").value; closeModal(); mutate((current) => { const player = current.players.find((p) => p.id === id); player.roleId = roleId; player.team = getRole(roleId).team; logEvent(current, "role-change", `Le rôle de ${player.name} est modifié en ${getRole(roleId).name}.`); }); return; }
  if (action === "hunter-shot") { const targetId = document.querySelector("#hunter-target")?.value; if (!targetId) { toast("Choisissez la cible du Chasseur.", "error"); return; } closeModal(); mutate((current) => { current.pendingDeaths.shift(); eliminatePlayer(current, targetId, "tir du Chasseur"); }); return; }
  if (action === "set-timer") { mutate((current) => { const seconds = Number(element.dataset.seconds); current.timer = { duration: seconds, remaining: seconds, running: false, endsAt: null }; }, { undo: false }); return; }
  if (action === "set-custom-timer") { const minutes = Number(document.querySelector("#custom-timer")?.value); if (!Number.isFinite(minutes) || minutes < 1 || minutes > 60) { toast("Choisissez une durée entre 1 et 60 minutes.", "error"); return; } mutate((current) => { const seconds = Math.round(minutes * 60); current.timer = { duration: seconds, remaining: seconds, running: false, endsAt: null }; }, { undo: false }); return; }
  if (action === "start-timer") { mutate((current) => { current.timer.running = true; current.timer.endsAt = Date.now() + current.timer.remaining * 1000; }, { undo: false }); return; }
  if (action === "pause-timer") { mutate((current) => { updateTimerState(current); current.timer.running = false; current.timer.endsAt = null; }, { undo: false }); return; }
  if (action === "reset-timer") { mutate((current) => { current.timer.running = false; current.timer.endsAt = null; current.timer.remaining = current.timer.duration; }, { undo: false }); return; }
  if (action === "dismiss-victory") { mutate((current) => { current.victoryDismissed = true; }, { undo: false }); return; }
  if (action === "end-game") { const victory = checkVictory(game); if (!victory) return; if (await confirmAction("Terminer la partie", `${victory.label}. Cette action ouvre le récapitulatif final.`, "Terminer") === false) return; mutate((current) => endGame(current, victory)); navigate("summary"); return; }
  if (action === "export-game") { closeModal(); const name = (game.name || "partie").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); downloadJson(exportPayload(game), `werewolf-${name || "partie"}.json`); toast("Partie exportée."); return; }
  if (action === "delete-save") { if (await confirmAction("Supprimer la sauvegarde", "La partie locale sera définitivement supprimée de cet appareil.", "Supprimer") === false) return; deleteGame(); state.game = null; state.undo = []; state.hasSave = false; closeModal(); navigate("home"); return; }
  if (action === "close-modal") { closeModal(false); return; }
  if (action === "confirm-modal") { closeModal(true); return; }
}

async function handleNightValidation() {
  const step = currentNightStep(state.game);
  if (!step) return;
  const action = {};
  if (["wolves", "seer"].includes(step.actionType)) action.targetId = document.querySelector("#night-target")?.value;
  if (step.actionType === "cupid") { action.firstId = document.querySelector("#cupid-first")?.value; action.secondId = document.querySelector("#cupid-second")?.value; }
  if (step.actionType === "witch") { action.save = document.querySelector("#witch-save")?.checked; action.killId = document.querySelector("#witch-kill")?.value; }
  if (step.actionType === "seer" && action.targetId) {
    const target = state.game.players.find((p) => p.id === action.targetId);
    const reveal = state.game.settings.seerReveal === "team" ? (target.team === "wolves" ? "Camp des Loups-Garous" : "Camp du Village") : getRole(target.roleId).name;
    const accepted = await new Promise((resolve) => {
      state.modalResolver = resolve;
      showModal("Vision de la Voyante", `<p class="text-sm text-stone-400">Information à montrer à la Voyante :</p><p class="mt-4 rounded-xl border border-amberwood/30 bg-amberwood/10 p-5 text-center font-display text-2xl text-amber-100">${escapeHtml(target.name)} : ${escapeHtml(reveal)}</p><div class="mt-4">${mjScript([{ action: "Montrez discrètement cette information à la Voyante et laissez-lui le temps de la mémoriser." }, { variants: ["Ta vision est désormais claire. Mémorise ce que tu viens de découvrir, puis referme les yeux et rendors-toi.", "Les esprits t’ont livré leur secret. Grave cette révélation dans ta mémoire, puis ferme les yeux et laisse la nuit reprendre ses droits."] }, { action: "Vérifiez que la Voyante a refermé les yeux avant de continuer." }], state.game.night - 1)}</div><button data-action="confirm-modal" class="mt-5 min-h-11 w-full rounded-xl bg-amberwood px-4 font-semibold text-forest-950">La Voyante s’est rendormie</button>`, { persistent: true });
    });
    if (!accepted) return;
  }
  mutate((game) => {
    validateNightAction(game, action);
    resolveCompletedNight(game);
  });
}

app.addEventListener("submit", (event) => {
  if (event.target.dataset.form !== "add-player") return;
  event.preventDefault();
  const input = event.target.elements.name;
  if (mutate((game) => addPlayer(game, input.value))) requestAnimationFrame(() => document.querySelector("#player-name")?.focus());
});

document.addEventListener("click", (event) => {
  const trigger = event.target.closest("[data-action]");
  if (!trigger) return;
  event.preventDefault();
  performAction(trigger.dataset.action, trigger);
});

document.addEventListener("dragstart", (event) => {
  const role = event.target.closest("[data-drag-role]");
  if (!role || role.disabled) { event.preventDefault(); return; }
  event.dataTransfer.effectAllowed = "copy";
  event.dataTransfer.setData("text/plain", role.dataset.dragRole);
  role.classList.add("ring-2", "ring-amberwood/60");
  dragPreviewElement?.remove();
  dragPreviewElement = document.createElement("div");
  dragPreviewElement.dataset.dragPreview = "true";
  dragPreviewElement.className = "pointer-events-none fixed z-[100] flex items-center gap-2 rounded-xl border border-amberwood/50 bg-forest-800 px-3 py-2 text-sm font-semibold text-parchment opacity-100 shadow-2xl";
  dragPreviewElement.style.left = `${event.clientX + 18}px`;
  dragPreviewElement.style.top = `${event.clientY + 18}px`;
  const roleIcon = role.querySelector("span.grid")?.cloneNode(true);
  if (roleIcon) dragPreviewElement.append(roleIcon);
  const roleName = document.createElement("span");
  roleName.textContent = getRole(role.dataset.dragRole).name;
  dragPreviewElement.append(roleName);
  document.body.append(dragPreviewElement);
  const transparentDragImage = document.createElement("canvas");
  transparentDragImage.width = 1;
  transparentDragImage.height = 1;
  event.dataTransfer.setDragImage(transparentDragImage, 0, 0);
});

document.addEventListener("drag", (event) => {
  if (!dragPreviewElement || (!event.clientX && !event.clientY)) return;
  dragPreviewElement.style.left = `${event.clientX + 18}px`;
  dragPreviewElement.style.top = `${event.clientY + 18}px`;
});

document.addEventListener("dragend", (event) => {
  event.target.closest("[data-drag-role]")?.classList.remove("ring-2", "ring-amberwood/60");
  dragPreviewElement?.remove();
  dragPreviewElement = null;
  document.querySelectorAll("[data-role-dropzone]").forEach((zone) => zone.classList.remove("border-amberwood", "bg-amberwood/10"));
});

document.addEventListener("dragover", (event) => {
  const zone = event.target.closest("[data-role-dropzone]");
  if (!zone) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
  if (dragPreviewElement) {
    dragPreviewElement.style.left = `${event.clientX + 18}px`;
    dragPreviewElement.style.top = `${event.clientY + 18}px`;
  }
  zone.classList.add("border-amberwood", "bg-amberwood/10");
});

document.addEventListener("dragleave", (event) => {
  const zone = event.target.closest("[data-role-dropzone]");
  if (zone && !zone.contains(event.relatedTarget)) zone.classList.remove("border-amberwood", "bg-amberwood/10");
});

document.addEventListener("drop", (event) => {
  const zone = event.target.closest("[data-role-dropzone]");
  if (!zone) return;
  event.preventDefault();
  zone.classList.remove("border-amberwood", "bg-amberwood/10");
  assignManualRole(zone.dataset.playerId, event.dataTransfer.getData("text/plain"));
});

document.addEventListener("keydown", (event) => {
  const zone = event.target.closest?.("[data-role-dropzone]");
  if (zone && ["Enter", " "].includes(event.key)) { event.preventDefault(); zone.click(); }
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (target.dataset.roleCount) mutate((game) => { game.composition.werewolf = Math.max(0, Number(target.value) || 0); game.players.forEach((player) => { player.roleId = null; player.team = null; }); syncComposition(game); }, { undo: false });
  if (target.dataset.specialRole) mutate((game) => { const id = target.dataset.specialRole; game.composition.specials = target.checked ? [...new Set([...game.composition.specials, id])] : game.composition.specials.filter((roleId) => roleId !== id); game.players.forEach((player) => { player.roleId = null; player.team = null; }); syncComposition(game); }, { undo: false });
  if (target.dataset.playerName) mutate((game) => { const player = game.players.find((p) => p.id === target.dataset.playerName); if (target.value.trim()) player.name = target.value.trim(); }, { undo: false });
  if (target.dataset.change === "game-name") mutate((game) => { game.name = target.value.trim() || "Nouvelle partie"; }, { undo: false });
  if (target.dataset.change === "general-notes") mutate((game) => { game.generalNotes = target.value; }, { undo: false });
  if (target.dataset.playerNotes) mutate((game) => { game.players.find((p) => p.id === target.dataset.playerNotes).notes = target.value; }, { undo: false });
  if (target.dataset.ballot) mutate((game) => { game.vote.ballots[target.dataset.ballot] = target.value || null; }, { undo: false });
  if (target.dataset.setting) {
    const settings = state.game?.settings || state.settings; settings[target.dataset.setting] = target.checked;
    state.settings = { ...state.settings, ...settings }; saveSettings(state.settings); persist(); renderApp();
  }
  if (target.dataset.settingValue) {
    const settings = state.game?.settings || state.settings; settings[target.dataset.settingValue] = target.dataset.settingValue === "timerDuration" ? Number(target.value) : target.value;
    state.settings = { ...state.settings, ...settings }; saveSettings(state.settings); if (state.game) { state.game.timer.duration = settings.timerDuration; state.game.timer.remaining = settings.timerDuration; persist(); } renderApp();
  }
});

importInput.addEventListener("change", async () => {
  const file = importInput.files?.[0]; importInput.value = ""; if (!file) return;
  try {
    const imported = parseImport(await file.text());
    if (state.game && await confirmAction("Importer cette partie", "La partie actuellement chargée sera remplacée.", "Importer") === false) return;
    state.game = imported; state.undo = []; persist();
    navigate(imported.status === "ended" ? "summary" : imported.status === "active" ? "game" : "setup");
    toast("Partie importée avec succès.");
  } catch (error) { toast(error.message, "error"); }
});

window.addEventListener("keydown", (event) => {
  if (!modalRoot.innerHTML) return;
  if (event.key === "Escape" && !state.modalResolver && !state.modalPersistent) closeModal();
  if (event.key !== "Tab") return;
  const focusable = [...modalRoot.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
  if (!focusable.length) return;
  const first = focusable[0], last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
window.addEventListener("error", () => toast("Une erreur inattendue est survenue. Rechargez la page si elle persiste.", "error"));

renderApp();
