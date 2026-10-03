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
| `articles/{itemId}` | catégorie de l'item et quantité par lieu | membres validés | Admin, N1, N2 |
| `prixArticles/{itemId}` | prix d'achat et prix de vente, tous deux facultatifs | Admin, N1, N2 | Admin, N1, N2 |

Les prix n'apparaissent jamais dans les listes : uniquement dans la fenêtre de détail d'un article, pour les gradés.
Pas d'historique des mouvements pour l'instant. Un lieu qui contient du stock ne peut pas être supprimé.

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
