export interface VersionEntry {
  version: string
  date: string
  changements: string[]
}

// Journal des versions, de la plus récente à la plus ancienne.
// À chaque montée de version : ajouter une entrée en tête et reporter le numéro dans package.json.
export const CHANGELOG: VersionEntry[] = [
  {
    version: '0.14.0',
    date: '2026-10-03',
    changements: [
      'Accueil : Saisie journalière. Chacun ajoute le butin du jour, item par item ; le stock du lieu choisi monte aussitôt.',
      'La saisie repart de zéro chaque jour à 3 h du matin ; les journées passées restent consultables dans l’historique.',
      'Accueil : Contrats en cours. Sommes à payer avec leur échéance : vert une fois payé, orange la veille de l’échéance, rouge quand le délai est dépassé.',
      'Un contrat peut être hebdomadaire (par exemple tous les vendredis à 21 h) : une fois payé, il redevient à payer pour la semaine suivante.',
      'Tarifs : la section Petites mains liste chaque personne de l’Annuaire rattachée à l’organisation des PM, pour passer directement une vente ou un achat avec elle au tarif commun.',
    ],
  },
  {
    version: '0.13.0',
    date: '2026-10-03',
    changements: [
      'Nouveau type d’organisation : Cartel (les boss), toujours en tête de liste.',
      'Chaque organisation a une couleur, affichée en tuile dans l’Annuaire et dans Tarifs.',
      'Annuaire : la colonne Organisation passe en premier et le tableau est trié par organisation ; un clic sur l’organisation permet de la modifier.',
      'Annuaire : une organisation peut être créée directement depuis la fenêtre d’ajout d’un contact.',
      'Tarifs : les contacts et téléphones d’un partenaire s’ouvrent par un bouton téléphone, au lieu d’être listés sur la page.',
      'Tarifs : une seule grille commune à toutes les petites mains ; on choisit la PM au moment de créer la vente ou l’achat.',
      'Tarifs : les entreprises n’y apparaissent plus pour le moment (elles restent dans l’Annuaire).',
    ],
  },
  {
    version: '0.12.0',
    date: '2026-10-03',
    changements: [
      'Nouvel onglet Annuaire : nom, téléphone, rôle et informations des contacts, rattachés à un groupe, une petite main ou une entreprise.',
      'Recherche par nom, téléphone, rôle ou organisation, et filtres par type.',
      'Nouveau type de partenaire : Entreprise, disponible aussi dans Tarifs.',
      'Tarifs : les contacts d’un partenaire s’affichent sous son nom.',
    ],
  },
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
