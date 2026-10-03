# Ballas — Intranet

Intranet du groupe RP Ballas (21 JumpClick). React + Vite + TypeScript + Tailwind, Firebase (Auth Google, Firestore, Hosting).

## Mise en route

1. Console Firebase : créer le projet, activer **Authentication > Google** et **Firestore** (région `europe-west`),
   puis ajouter une application Web.
2. Copier `.env.example` en `.env.local` et y coller la config de l'application Web.
3. Lier le dossier au projet : `firebase login` puis `firebase use --add`.
4. `npm install` puis `npm run dev`.
5. Se connecter une première fois, puis dans la console Firestore passer sa fiche `users/{uid}` à `role: "admin"`.
   Les admins et chefs suivants se nomment depuis la page Membres.

## Rôles

| Clé | Grade | Accès |
|---|---|---|
| `pending` | En attente | uniquement sa propre fiche (écran d'attente) |
| `membre` | Masque noir | lecture de l'intranet, profil RP, présence |
| `officier` | Masque violet | + publication d'annonces |
| `n2` | N2 | + validation, révocation, journal ; gère les Masques |
| `n1` | N1 | idem, gère aussi les N2 |
| `admin` | Admin | tout : gère tous les grades, seul à voir l'email des comptes |
| `revoque` | Révoqué | aucun accès |

La sécurité est portée par [firestore.rules](firestore.rules) ; l'interface ne fait que masquer les écrans.
N1 et N2 ne modifient qu'une fiche de rang strictement inférieur au leur et n'attribuent qu'un grade strictement inférieur.
Personne ne modifie son propre rôle, admin compris.
Le journal d'audit est en ajout seul pour tout le monde.

## Retrait d'un joueur

Un gradé retire un joueur de rang inférieur en choisissant une raison (page Membres, bouton « Retirer ») :

| Raison | Effet |
|---|---|
| Cavale | accès coupé, fiche conservée ; message dédié si le joueur se reconnecte ; réintégration ou suppression ensuite |
| Absence longue | accès coupé, fiche conservée ; réintégration ou suppression ensuite |
| Mort | fiche et zone privée supprimées |
| A quitté l'île | fiche et zone privée supprimées |

Après une suppression, seule la ligne du journal subsiste (nom RP et raison) ; les véhicules du joueur sont supprimés avec lui.
Si le même compte Google se reconnecte, il repart comme une nouvelle demande d'accès.

## Gestion (comptes, véhicules, garages)

Chaque joueur saisit ses données dans **Paramètres** (roue dentée) : anniversaire RP, solde du compte bancaire, ses véhicules.
L'onglet **Gestion** les relit pour tous les membres validés, en deux vues : Membres (solde, anniversaire, véhicules, total du groupe)
et Garages (véhicules rangés par lieu, places occupées / capacité).

| Donnée | Qui modifie |
|---|---|
| Solde (`users.compteBancaire`) | le joueur lui-même, ou un gradé de rang strictement supérieur (admin : tous) |
| Anniversaire (`users.anniversaireRP`) | le joueur lui-même |
| Véhicule (`vehicules`) | son propriétaire ; l'admin pour n'importe qui, y compris le changement de propriétaire |
| Lieu (`lieux`) | Admin, N1, N2 |

La capacité d'un garage est contrôlée par l'appli, pas par les règles Firestore (elles ne comptent pas les documents).

## Stock

Onglet **Stock**, visible par tous les membres validés : un onglet par lieu (les mêmes lieux que les garages) et un onglet **Global**
qui additionne tous les lieux. Les items viennent du catalogue (`src/data/items.json`) et sont rangés par catégorie.

| Collection | Contenu | Lecture | Écriture |
|---|---|---|---|
| `categoriesStock` | catégories, communes à tous les lieux | membres validés | Admin, N1, N2 |
| `articles/{itemId}` | catégorie de l'item et quantité par lieu | membres validés | quantités : membres validés ; catégorie, suppression : Admin, N1, N2 |

Le Stock ne porte aucun prix : ils se gèrent dans l'onglet Tarifs. La collection `prixArticles` date d'avant ce changement ;
elle n'accepte plus d'écriture et se vide au fil des suppressions d'articles.
Pas d'historique des mouvements pour l'instant. Un lieu qui contient du stock ne peut pas être supprimé.

## Tarifs

Onglet **Tarifs**, visible par tous les membres validés : la liste des partenaires (groupes et petites mains) et, pour chacun,
ce qu'on lui achète et ce qu'on lui vend. Chaque ligne porte un prix en argent propre et un prix en argent sale (billets de 1$),
tous deux facultatifs.

| Collection | Contenu | Lecture | Écriture |
|---|---|---|---|
| `partenaires` | nom, type (`cartel`, `groupe`, `pm` ou `entreprise`), couleur, téléphone, note | membres validés | Admin, N1, N2 |
| `tarifs` | partenaire, item ou arme, sens (`achat` / `vente`), prix propre, prix sale, note | membres validés | Admin, N1, N2 |

Seuls le Cartel et les groupes ont chacun leur grille. Toutes les petites mains partagent une grille commune, dont les lignes portent
`partenaireId: 'pm-commun'` (`ID_GRILLE_PM`) ; la PM est choisie à la création de la commande, et un prix négocié se corrige à la validation.
Les entreprises n'ont pas de grille pour le moment : elles n'apparaissent que dans l'Annuaire.

L'identifiant d'une ligne est `<partenaire>_<sens>_<item>` : un item ne figure qu'une fois par partenaire et par sens.
Supprimer un partenaire supprime sa grille.

## Accueil : saisie journalière et contrats

**Saisie journalière** (bas de l'accueil, à gauche) : tout membre validé ajoute le butin du jour, item par item, dans le lieu choisi
(le premier lieu par défaut). Chaque ajout s'additionne à la ligne du jour et monte le stock du lieu dans la même écriture.
La journée commence à 3 h du matin, heure de Paris (`src/lib/journee.ts`) : il y a un document `saisies/{AAAA-MM-JJ}` par journée,
donc la saisie repart de zéro à 3 h sans aucune tâche planifiée, et les documents des jours passés forment l'historique.
Pour cela, tout membre validé peut modifier les quantités d'un article du Stock et créer un article non classé ;
la catégorie et la suppression restent aux gradés.

**Contrats en cours** (bas de l'accueil, à droite) : sommes que le groupe doit payer (`contrats` : libellé, montant, échéance, payé).
Visibles par tous, gérés par Admin, N1 et N2. Vert : payé ; orange : échéance dans moins de 24 h ; rouge : délai dépassé.
Un contrat peut être hebdomadaire (`hebdo`) : `echeance` et `paye` portent alors sur l'échéance en cours, et une fois celle-ci payée
et passée, celle de la semaine suivante devient due (`echeanceCourante` dans `src/features/contrats/api.ts`), sans tâche planifiée.

## Annuaire

Onglet **Annuaire**, visible par tous les membres validés ; Admin, N1 et N2 ajoutent, modifient et suppriment.
Un contact (collection `contacts`) porte un nom, un téléphone, un rôle en texte libre, des informations, et peut être rattaché
à un partenaire. Les partenaires sont ceux des Tarifs : `cartel` (les boss, toujours listés en premier), `groupe`, `pm`, `entreprise`.
Chaque organisation a une couleur (`couleur`, `#rrggbb`) affichée en tuile ; elle se règle en cliquant sur l'organisation.
Le tableau est trié par organisation (Cartel d'abord, puis ordre alphabétique), les contacts sans rattachement à la fin.
Supprimer un partenaire conserve ses contacts, qui passent sans rattachement.

## Commerce (ventes et achats)

Une commande se crée depuis l'onglet Tarifs, par le bouton « ⋯ » d'une ligne : quantité, puis nouvelle commande ou ajout à celle
déjà en attente avec le partenaire. Une même commande peut mêler des ventes et des achats : chaque ligne porte son sens.
L'onglet **Commerce** liste les commandes en cours et l'historique.

| Étape | Qui | Effet |
|---|---|---|
| Création, ajout ou retrait de lignes | tout membre validé | commande `en_attente` ; les prix unitaires sont ceux du tarif au moment de l'ajout |
| Validation | Admin, N1, N2 | règlement réel : ce qu'on reçoit et ce qu'on donne (propre, sale, items), lieu ; le stock du lieu est mis à jour dans la même écriture |
| Annulation | Admin, N1, N2 | commande `annulee`, aucun effet sur le stock |

Mise à jour du stock à la validation, dans le lieu choisi (aucune si « Ne pas toucher au stock ») :

- **sortent** : les items vendus, les items donnés en échange, l'argent sale donné ;
- **entrent** : les items achetés, les items repris en échange, l'argent sale reçu.

L'argent sale est l'item « Billet de 1$ » du catalogue (`REFERENCE_ARGENT_SALE`). L'argent propre n'est pas suivi dans le stock.
Une quantité ne descend jamais sous zéro. Un item reçu qui n'était pas encore suivi entre au Stock dans « Sans catégorie ».
Une commande close n'est plus modifiable et aucune commande ne se supprime (collection `commandes`).

## Données personnelles

Seules des informations RP sont affichées et stockées dans la fiche publique `users/{uid}` (nom RP, téléphone en jeu, grade, présence).
Le nom et la photo Google ne sont jamais enregistrés. L'email du compte est dans `users/{uid}/prive/compte`,
lisible par le joueur lui-même et par l'admin uniquement.

## Présence

Chaque joueur se déclare présent depuis l'accueil. Sans nouveau clic, la présence retombe à « absent » après 4 h
(`DUREE_PRESENCE_H` dans `src/lib/presence.ts`).

## Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` | vérification TypeScript + build dans `dist/` |
| `npm run lint` | oxlint |
| `npm run emulators` | émulateurs Auth + Firestore (JDK 21 requis), avec `VITE_USE_EMULATORS=true` |
| `npm run test:rules` | tests des règles Firestore sur l'émulateur (JDK 21 requis) |
| `npm run deploy` | build + déploiement Hosting et règles Firestore |

## Structure

- `src/auth` — contexte d'authentification, garde de route par rôle
- `src/features` — accès Firestore par domaine (`members`, `annonces`)
- `src/pages`, `src/layout`, `src/components` — écrans et UI
- `tests/rules` — tests des règles de sécurité

## À venir

Véhicules, maisons, puis commerce (achats/ventes, stock, trésorerie).
