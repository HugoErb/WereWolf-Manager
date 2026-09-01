# Werewolf Manager

Werewolf Manager est une application web one-page privée destinée au Maître du Jeu d’une partie de Loup-Garou. Elle centralise la préparation, l’attribution des rôles, les nuits, les votes et les éliminations dans un tableau de bord complet.

L’application fonctionne entièrement dans le navigateur, sans compte, serveur, base de données ni étape de compilation.

## Fonctionnalités

- création du village et gestion réordonnable des joueurs ;
- composition recommandée ou personnalisée des rôles ;
- attribution aléatoire Fisher–Yates ou attribution manuelle ;
- récapitulatif privé de l’attribution pour le MJ ;
- assistant de nuit ordonné par les données des rôles ;
- Loups-Garous, Voyante, Sorcière, Cupidon, Chasseur et amoureux ;
- résolution différée des actions nocturnes ;
- vote simple ou comptage individuel avec détection des égalités ;
- morts en cascade et journal complet du MJ ;
- notes générales et notes par joueur ;
- chronomètre facultatif ;
- détection des victoires du Village et des Loups-Garous ;
- annulation des dernières actions importantes ;
- sauvegarde automatique, import et export JSON versionné.

## Lancement local

Les modules ES6 doivent être servis via HTTP. Depuis la racine du projet :

```powershell
python -m http.server 8000
```

Ouvrez ensuite `http://localhost:8000`. Un autre serveur statique convient également.

## Architecture

```text
index.html              coque HTML et configuration Tailwind
styles/custom.css       animations et décor minimal uniquement
js/app.js               contrôleur de vues, événements et état central
js/game.js              moteur de partie, phases, morts et victoire
js/night.js             actions et résolution nocturnes
js/voting.js            bulletins, classement et résolution du vote
js/roles.js             bibliothèque extensible des rôles
js/storage.js           localStorage, validation, import et export
js/ui.js                fonctions de rendu Tailwind
js/utils.js             utilitaires purs
tests/game.test.mjs     tests du moteur exécutables avec Node.js
tests/browser-smoke.mjs parcours automatisé dans Chrome via son protocole distant
```

Les mutations importantes passent par le contrôleur central : création d’un snapshot d’annulation, modification du moteur, sauvegarde, puis nouveau rendu. Les vues ne modifient jamais directement la partie.

## Tailwind CSS

Tailwind est chargé depuis son CDN officiel et configuré directement dans `index.html`. Ce choix garde le projet sans dépendances et immédiatement publiable sur GitHub Pages. `custom.css` ne contient que le fond discret, deux animations et la gestion de la réduction des mouvements.

Une connexion est donc nécessaire au premier chargement pour récupérer Tailwind. Pour un usage intégralement hors ligne, il faut remplacer le CDN par une feuille Tailwind compilée et conserver le même chemin relatif.

## Stockage, import et export

La couche `js/storage.js` est la seule à accéder directement à `localStorage`. Les sauvegardes utilisent le format :

```json
{
  "version": 1,
  "game": {}
}
```

L’import vérifie la version et la structure minimale avant de remplacer la partie courante. Les préférences et douze snapshots d’annulation maximum sont stockés séparément.

## Déploiement GitHub Pages

1. Publiez la branche souhaitée dans les réglages **Pages** du dépôt.
2. Sélectionnez la racine du dépôt comme dossier publié.
3. Aucun workflow Node.js ni commande de build n’est nécessaire.

Tous les fichiers utilisent des chemins relatifs (`./js/...`, `./styles/...`), ce qui permet un hébergement dans un sous-répertoire tel que `https://utilisateur.github.io/werewolf-manager/`. L’application n’utilise ni route côté serveur ni secret.

## Ajouter un rôle

1. Ajoutez sa définition dans `ROLES` dans `js/roles.js` avec un identifiant stable, un camp et ses métadonnées.
2. Pour un rôle nocturne, définissez `wakesAtNight`, `nightOrder` et `actionType`.
3. Ajoutez le rendu de cette action dans `nightPanel()` (`js/ui.js`).
4. Ajoutez sa validation et sa résolution dans `js/night.js`.
5. Pour un pouvoir déclenché à la mort, déclarez `onDeath` et traitez la conséquence dans la file des morts du moteur.
6. Ajoutez un test ciblé dans `tests/game.test.mjs`.

Les rôles sans action automatisée peuvent être ajoutés uniquement par leur définition de données.

## Logique de composition recommandée

La recommandation introduit les rôles progressivement pour éviter de surcharger ou de suréquiper les petites tables :

- 5–6 joueurs : 1 Loup-Garou et la Voyante ;
- 7–8 joueurs : 2 Loups-Garous, Voyante et Sorcière ; le format à 7 reste plus volatil ;
- 9 joueurs : ajout du Chasseur ;
- 10 joueurs : ajout de Cupidon ;
- 11 joueurs : passage à 3 Loups-Garous pour compenser les quatre pouvoirs présents ;
- 12–13 joueurs : maintien de 3 Loups-Garous ;
- 14–15 joueurs : ajout de la Petite Fille ;
- 16–19 joueurs : passage à 4 Loups-Garous ;
- au-delà : environ un Loup-Garou pour quatre participants.

Les formats de moins de 8 joueurs sont signalés comme des adaptations plus volatiles. La Petite Fille est proposée tardivement car sa puissance dépend fortement de l’expérience et du comportement du groupe. Chaque suggestion reste modifiable par le MJ.

## Tests

```powershell
node --test tests/game.test.mjs
```

Ces tests couvrent la composition et l’attribution, le cycle nocturne, la Sorcière, les amoureux, le Chasseur, les votes et le format de sauvegarde.

Le test navigateur est destiné à la vérification de développement. Il attend une application servie sur le port `8765` et un Chrome lancé avec le débogage distant sur le port `9222` ; il ne constitue pas une dépendance de production.
