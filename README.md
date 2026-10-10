# Ballas — Intranet

Intranet du groupe RP Ballas (21 JumpClick). React + Vite + TypeScript + Tailwind, Firebase (Auth Google, Firestore, Hosting).

## Mise en route

1. Console Firebase : créer le projet, activer **Authentication > Google** et **Firestore** (région `europe-west`),
   puis ajouter une application Web.
2. Copier `.env.example` en `.env.local` et y coller la config de l'application Web.
3. Lier le dossier au projet : `firebase login` puis `firebase use --add`.
4. `npm install` puis `npm run dev`.
5. Se connecter une première fois, puis dans la console Firestore passer sa fiche `users/{uid}` à `role: "membre"`
   (ou un autre grade) et créer le document `users/{uid}/prive/droits` avec `admin: true`.
   Les admins et chefs suivants se nomment depuis la page Membres.

## Rôles

| Clé | Grade | Accès |
|---|---|---|
| `pending` | En attente | uniquement sa propre fiche (écran d'attente) |
| `membre` | Masque noir | lecture de l'intranet, profil RP, présence |
| `officier` | Masque violet | + publication d'annonces |
| `n2` | N2 | + validation, révocation, journal ; gère les Masques |
| `n1` | N1 | idem, gère aussi les N2 |
| `revoque` | Révoqué | aucun accès |

La sécurité est portée par [firestore.rules](firestore.rules) ; l'interface ne fait que masquer les écrans.
N1 et N2 ne modifient qu'une fiche de rang strictement inférieur au leur et n'attribuent qu'un grade strictement inférieur.
Personne ne modifie son propre rôle, sauf un admin (voir ci-dessous).

### Droit d'administration

« Admin » n'est pas un grade : c'est un droit à part, rangé dans `users/{uid}/prive/droits` (`{ admin: true }`).
Un admin a tous les droits quel que soit son grade affiché, et il est seul à voir l'email des comptes.

- Le droit est **invisible** : la zone privée n'est lisible que par le joueur et par les admins. Les autres voient le grade RP, rien de plus.
- Seul un admin le donne ou le retire (page Membres, colonne « Admin »), jamais à lui-même. Rien n'est écrit au journal.
- N1 et N2 ne peuvent ni changer le grade d'un admin, ni corriger son solde, ni le retirer du groupe.
- Un admin choisit son propre grade affiché. Révoquer ou supprimer un joueur lui retire le droit.
- Une fiche encore à l'ancien grade `role: "admin"` reste reconnue comme admin ; à sa connexion, un écran lui fait choisir son grade RP
  et crée son droit privé dans la même écriture.
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

## Photos des véhicules et Carjacking

Il n'y a pas d'API officielle des véhicules de GTA V. L'appli embarque un catalogue (`src/data/vehicules.json` : nom de spawn, nom français,
marque, catégorie), généré par `npm run vehicules` à partir de l'export communautaire `DurtyFree/gta-v-data-dumps`. Les photos viennent de
la documentation de FiveM : `https://docs.fivem.net/vehicles/<spawn>.webp`. Une image absente affiche un cadre vide.

- **Véhicules du groupe** : le modèle se choisit dans le catalogue (champ `spawn` du document `vehicules`), la saisie libre restant possible.
  Sans `spawn`, l'appli rapproche le texte saisi d'un modèle pour l'affichage seulement (`trouverModele`, `src/features/gestion/modeles.ts`) ;
  un texte ambigu (« Hellfire » : Gauntlet ou Hotring) ne donne pas de photo tant qu'on n'a pas choisi le modèle.
- **Carjacking** (`carjackings`) : voitures à aller voler. Un gradé ajoute la fiche ; tout membre validé la marque volée puis déposée, en son nom ;
  un gradé la clôt en indiquant si elle est rachetée et pour quel montant en sale, ajouté au stock de billets de 1$ du lieu choisi.
  Une fiche close ne change plus et forme l'historique.

## Blanchiment

Onglet **Blanchiment**, visible par tous les membres validés ; Admin, N1 et N2 recensent les commerces et gèrent les dépôts.

- `commerces` : commerces de la ville qui blanchissent l'argent sale, repérés par leur zip. `proprietaireId` vaut `'ballas'`
  (à nous, `PROPRIETAIRE_NOUS`), l'id d'un partenaire, ou `null` si le propriétaire est inconnu. Un commerce est de genre
  `standard`, `securise` ou `express` (`genre`). Taux, durée et montant maximal blanchissable (`montantMax`) sont facultatifs.
- `blanchiments` : dépôts d'argent sale dans nos commerces, un seul en cours par commerce. Le **taux est la part récupérée** :
  80 % → 10 000 $ de sale rendent 8 000 $ de propre.

Un dépôt est lancé (les billets de 1$ sortent du stock du lieu choisi, dans la même écriture), puis récupéré une fois le temps écoulé :
il passe alors dans l'historique et ne change plus. « Prêt à récupérer » se déduit de l'heure de fin, sans tâche planifiée.
Un dépôt en cours peut être annulé : il est supprimé et les billets retournent dans le stock.

## Amendes

Onglet **Amendes**, ouvert à tous les membres validés. Il remplace le tableau joueurs × délits du groupe.

- Collection `amendes` : joueur (`membreUid`, `membreNom`), `delit`, `date`, `note`, `creeParUid`. Aucun montant : seul le suivi des récidives compte.
- Les 16 délits et leurs 3 catégories sont fixes, dans `src/lib/delits.ts` (liste reprise dans `firestore.rules`).
- **Récidive** : une amende met le joueur en récidive sur ce délit, pour une durée qui dépend de sa gravité : aucune pour un délit
  mineur, 24 h pour un délit moyen, 7 jours pour un délit majeur (`DUREE_RECIDIVE_MS`). Rien n'est stocké : la fin se déduit de
  `date`, et une nouvelle amende dans le délai est affichée « Récidive » et relance le délai.
- Tout membre validé note une amende, pour lui ou pour un autre. La note se corrige, et l'amende se supprime,
  par l'auteur de la saisie, le joueur concerné ou Admin, N1, N2. Une amende ne peut pas être datée dans le futur.
- L'accueil liste les récidives en cours, avec le temps restant.

## Map

Onglet **Map**, ouvert à tous les membres validés : la carte du serveur (avec les zips) et les points du groupe.

- **Carte** : `map_gta5_21jc.png`, à la racine, n'est pas versionnée (ressource du serveur). `npm run carte` la découpe en tuiles
  WebP dans `public/carte/` (non versionné non plus) et écrit ses dimensions dans `src/data/carte.json`.
  **À lancer avant un build sur une machine neuve**, et à chaque changement de carte. Affichage avec Leaflet, en repère image.
- **Points** (`pointsCarte`) : commerce (avec appartenance), plan de récolte, point d'intérêt, danger. Position en fraction de la
  carte (0 à 1). Tout membre validé pose un point ; l'auteur et Admin, N1, N2 le modifient, le déplacent et le suppriment.
- **Plan de récolte** : posé avec une quantité, il passe par Germination, Croissance et Floraison, 30 minutes chacune
  (`DUREE_ETAPE_MS`). Après Germination et Croissance il faut l'arroser pour lancer l'étape suivante, dont le chrono part à
  l'arrosage ; après Floraison il est prêt, et « Récolté » le supprime. Arroser et récolter sont ouverts à tous.
  Rien n'est planifié : le statut se déduit de `etapeDebut`, et les règles refusent un arrosage avant 30 minutes.
- **Plan et Stock** : poser un plan sort ses graines du lieu choisi (une « Graine de Weed » par plant) ; le récolter fait entrer
  dix « Têtes de cannabis » par plant dans le lieu choisi et dans la saisie journalière, dans la même écriture que la
  disparition du plan (`REFERENCE_GRAINE`, `REFERENCE_TETE`, `TETES_PAR_PLANT` dans `src/lib/carte.ts`).
  Supprimer un plan, ou changer sa quantité après coup, ne touche pas au stock.
- `http://localhost:5173/?apercu=carte` affiche la carte seule, sans connexion (développement uniquement).

## Annuaire

Onglet **Annuaire**, visible par tous les membres validés ; Admin, N1 et N2 ajoutent, modifient et suppriment.
Un contact (collection `contacts`) porte un nom, un téléphone, un rôle en texte libre, des informations, et peut être rattaché
à un partenaire. Les partenaires sont ceux des Tarifs : `cartel` (les boss, toujours listés en premier), `groupe`, `pm`, `entreprise`.
Chaque organisation a une couleur (`couleur`, `#rrggbb`) affichée en tuile ; elle se règle en cliquant sur l'organisation.
Le tableau est trié par organisation (Cartel d'abord, puis ordre alphabétique), les contacts sans rattachement à la fin.
Supprimer un partenaire conserve ses contacts, qui passent sans rattachement.

## Transactions (ventes et achats)

Une commande se crée depuis l'onglet Tarifs, par le bouton « ⋯ » d'une ligne : quantité, puis nouvelle commande ou ajout à celle
déjà en attente avec le partenaire. Une même commande peut mêler des ventes et des achats : chaque ligne porte son sens.
L'onglet **Transactions** (anciennement Commerce) liste les commandes en cours et l'historique.
À la validation, ce que la transaction fait entrer (argent sale reçu, items achetés ou repris en échange) s'ajoute à la saisie
journalière du jour, qui sert de journal des entrées (`entreesSaisie` dans `src/features/commerce/api.ts`).

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
lisible par le joueur lui-même et par les admins uniquement.

## Réglages par joueur (navigateur)

Deux réglages de confort sont gardés dans le `localStorage` du navigateur, pas en base (`src/lib/preferences.ts`) :

- **Taille d'affichage** (Paramètres → Affichage) : 100, 90 ou 80 %, 90 % par défaut. Elle règle la taille de base de la page,
  et comme tout est dimensionné en `rem`, tout l'intranet suit.
- **Disposition de l'accueil** (bouton « Disposition ») : les 7 emplacements sont fixes, les encarts échangent leurs places
  par glisser-déposer ou en deux touches. Chaque encart a une largeur (Auto, Étroit, Moyen, Large) qui le suit quand il
  change de place. « Réinitialiser » rend la disposition et les largeurs d'origine.

## Présence

Chaque joueur se déclare présent depuis l'accueil. Tant qu'il se sert de l'appli, sa présence est prolongée (au plus une écriture
toutes les 10 minutes, `usePresenceActive`) ; elle retombe à « absent » après 4 h sans activité
(`DUREE_PRESENCE_H` dans `src/lib/presence.ts`).

## Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` | vérification TypeScript + build dans `dist/` |
| `npm run lint` | oxlint |
| `npm run items` | régénère les catalogues d'items et d'armes à partir des exports du serveur (non versionnés) |
| `npm run vehicules` | régénère le catalogue des véhicules depuis l'export communautaire (accès Internet requis) |
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
