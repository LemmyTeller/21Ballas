export interface VersionEntry {
  version: string
  date: string
  changements: string[]
}

// Journal des versions, de la plus récente à la plus ancienne.
// À chaque montée de version : ajouter une entrée en tête et reporter le numéro dans package.json.
export const CHANGELOG: VersionEntry[] = [
  {
    version: '0.11.0',
    date: '2026-10-03',
    changements: [
      'Commerce : une même commande peut mêler des ventes et des achats avec un groupe ou une petite main.',
      'Quand une commande est déjà en cours avec le partenaire, la fenêtre le signale et propose d’y ajouter la vente ou l’achat.',
      'Validation : ce qu’on reçoit et ce qu’on donne se saisissent séparément (propre, sale, items).',
    ],
  },
  {
    version: '0.10.0',
    date: '2026-10-03',
    changements: [
      'Tarifs : le bouton « ⋯ » d’une ligne crée une vente ou un achat avec une quantité, ou complète la commande déjà en cours avec le partenaire.',
      'Nouvel onglet Commerce : ventes et achats en attente, puis historique des commandes validées ou annulées.',
      'Validation par un gradé : montant final en propre et en sale, items repris ou donnés en échange, et mise à jour automatique du stock du lieu choisi.',
      'Tarifs : « On lui vend » affiche la quantité en stock et la valeur totale vendable ; les lignes suivent l’ordre d’ajout.',
    ],
  },
  {
    version: '0.9.0',
    date: '2026-10-03',
    changements: [
      'Nouvel onglet Tarifs : pour chaque groupe et petite main, ce qu’on lui achète et ce qu’on lui vend.',
      'Deux prix par ligne, en propre et en sale (billets de 1$), chacun facultatif.',
      'Les gradés gèrent les partenaires et les prix ; tout le monde peut les consulter.',
      'Stock : les prix d’achat et de vente sont retirés, ils se gèrent désormais dans Tarifs.',
    ],
  },
  {
    version: '0.8.0',
    date: '2026-10-03',
    changements: [
      'Accueil : nouveau module Tâches. Les gradés ajoutent des tâches et règlent leur priorité avec les flèches ; tout le monde peut les cocher une fois réalisées.',
      'Accueil : le titre de bienvenue disparaît et l’encart des présents est plus compact, à droite.',
      'Nouveau style : titres de page au marqueur et bande mauve à gauche des encarts.',
    ],
  },
  {
    version: '0.7.0',
    date: '2026-10-03',
    changements: [
      'Nouvel onglet Stock : les items stockés, rangés par catégorie, avec un onglet par lieu.',
      'Onglet Global : la somme de tous les lieux, avec la répartition sous chaque item.',
      'Les gradés créent les catégories, ajoutent des items ou des armes du catalogue et ajustent les quantités.',
      'Poids de chaque item et arme en stock, et jauge du poids total sur 4 200 kg dans Global.',
      'Prix d’achat et de vente par item, visibles des gradés uniquement.',
      'Inventaire : nouvel onglet Armes (image, nom, catégorie, poids) à côté des items.',
    ],
  },
  {
    version: '0.6.0',
    date: '2026-10-03',
    changements: [
      'Nouvel onglet Gestion : comptes bancaires, anniversaires et véhicules de chaque membre, avec le total du groupe.',
      'Vue Garages : véhicules rangés par lieu (QG, maisons) avec plaque, propriétaire et places occupées.',
      'La roue dentée ouvre désormais les Paramètres : profil RP, anniversaire, solde et tes véhicules.',
      'Un grade supérieur peut corriger le solde d’un membre ; l’admin peut ajouter un véhicule à n’importe qui.',
    ],
  },
  {
    version: '0.5.0',
    date: '2026-10-03',
    changements: [
      'Nouvel onglet Inventaire (Admin, N1, N2) : catalogue des items avec image, nom et poids, et recherche par nom.',
      'Le profil s’ouvre depuis la roue dentée à côté de ton nom ; l’onglet « Mon profil » disparaît du menu.',
    ],
  },
  {
    version: '0.4.0',
    date: '2026-10-02',
    changements: [
      'Retrait d’un joueur avec une raison : Cavale, Absence longue, Mort ou A quitté l’île.',
      'Cavale et Absence longue coupent l’accès ; le joueur peut être réintégré ou supprimé ensuite.',
      'Mort et A quitté l’île suppriment définitivement le joueur.',
      'Le journal indique la raison de chaque révocation et suppression.',
    ],
  },
  {
    version: '0.3.1',
    date: '2026-10-02',
    changements: [
      'Numéro de version affiché sous le bouton de déconnexion, avec ce journal des versions.',
      'Nouvel indicateur de chargement avec le logo Ballas.',
    ],
  },
  {
    version: '0.3.0',
    date: '2026-10-02',
    changements: [
      'Seules les informations RP sont affichées : plus de nom ni de photo de compte.',
      'Nouveaux grades : N1, N2, Masque violet et Masque noir.',
      'Accueil : liste des joueurs avec leur présence et bouton « Je suis présent » (expire après 4 h).',
      'Annonces : bouton « + » pour publier, le formulaire n’est plus affiché en permanence.',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-10-02',
    changements: ['Ajout du rôle Admin.', 'Logo Ballas sur l’écran de connexion, dans le menu et dans l’onglet.'],
  },
  {
    version: '0.1.0',
    date: '2026-10-02',
    changements: [
      'Connexion avec Google et validation des comptes par un gradé.',
      'Accueil avec les annonces du groupe.',
      'Page Membres : demandes d’accès, grades, révocation.',
      'Journal des validations et changements de grade.',
    ],
  },
]

export const VERSION = CHANGELOG[0].version
