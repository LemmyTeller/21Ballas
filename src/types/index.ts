import type { Timestamp } from 'firebase/firestore'

export type Role = 'pending' | 'membre' | 'officier' | 'n2' | 'n1' | 'admin' | 'revoque'

// Raisons qui coupent l'accès en gardant la fiche (réintégration possible)
export type RaisonRevocation = 'cavale' | 'absence' | 'refus'
// Raisons qui suppriment définitivement le joueur
export type RaisonSuppression = 'mort' | 'quitte_ile'
export type RaisonSortie = RaisonRevocation | RaisonSuppression

// Fiche publique : uniquement des informations RP. L'email du compte vit dans users/{uid}/prive/compte.
export interface Membre {
  uid: string
  nomRP: string
  telephoneRP: string
  // Anniversaire du personnage, au format JJ/MM
  anniversaireRP?: string
  compteBancaire?: number
  // Grade RP affiché. L'ancienne valeur 'admin' ne subsiste que sur une fiche pas encore migrée.
  role: Role
  // Droit d'administration, indépendant du grade. Il ne vient pas de la fiche publique mais de la zone privée
  // users/{uid}/prive/droits : il n'est donc renseigné que pour le membre connecté lui-même.
  admin?: boolean
  raisonRevocation?: RaisonRevocation
  createdAt: Timestamp | null
  validatedBy?: string
  validatedAt?: Timestamp | null
  present?: boolean
  presenceAt?: Timestamp | null
}

// Lieu disposant d'un garage : QG, maison…
export interface Lieu {
  id: string
  nom: string
  capacite: number
  createdAt: Timestamp | null
}

// Modèle du catalogue des véhicules de GTA V (src/data/vehicules.json, généré par `npm run vehicules`)
export interface ModeleVehicule {
  // Nom de spawn : c'est lui qui donne l'adresse de la photo
  spawn: string
  nom: string
  marque: string
  classe: string
}

// Voiture à aller voler. Elle avance d'étape en étape, puis finit dans l'historique une fois le rachat renseigné.
export interface Carjacking {
  id: string
  // Nom de spawn du modèle ; null pour un modèle saisi librement, hors catalogue
  spawn: string | null
  modele: string
  note: string
  // Groupe pour lequel la voiture est volée ; null ou absent : pour personne en particulier
  partenaireId?: string | null
  statut: 'a_voler' | 'vole' | 'depose' | 'clos'
  creeParUid: string
  createdAt: Timestamp | null
  voleParUid?: string
  voleAt?: Timestamp | null
  deposeParUid?: string
  deposeAt?: Timestamp | null
  // Renseignés à la clôture : rachetée ou non, montant en sale, lieu où sont entrés les billets de 1$
  rachete?: boolean
  montant?: number | null
  lieuId?: string | null
  closParUid?: string
  closAt?: Timestamp | null
}

// Amende prise par un joueur. Elle ouvre une récidive pour ce joueur et ce délit, dont la durée dépend de la
// gravité du délit (voir src/lib/delits.ts).
export interface Amende {
  id: string
  membreUid: string
  // Nom RP au moment de la saisie : l'historique reste lisible si le joueur quitte le groupe
  membreNom: string
  // Identifiant de la liste fixe des délits
  delit: string
  // Moment où l'amende a été prise : c'est de là que part le délai de récidive
  date: Timestamp
  note: string
  creeParUid: string
  createdAt: Timestamp | null
}

// Event « course au produit » en cours (document events/courant) : les items qui comptent et ce qu'ils rapportent.
// Les quantités ne sont pas stockées ici : elles sont lues dans le Stock.
export interface EventCourse {
  nom: string
  // Points par unité, par item (clé du catalogue, voir Reference)
  points: Record<string, number>
}

export interface Vehicule {
  id: string
  modele: string
  // Lien au catalogue des véhicules, pour la photo ; absent ou null pour un modèle saisi librement
  spawn?: string | null
  plaque: string
  proprietaireUid: string
  // null : véhicule sans garage
  lieuId: string | null
  note: string
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

export interface CategorieStock {
  id: string
  nom: string
  createdAt: Timestamp | null
}

// Item suivi en stock. `id` = id de l'item du catalogue ; catégorie commune à tous les lieux, quantité par lieu.
export interface Article {
  id: string
  categorieId: string
  quantites: Record<string, number>
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

// Organisation avec laquelle le groupe traite : le Cartel (les boss, joués par les MJ), un autre groupe,
// une petite main (PM) ou une entreprise
export type TypePartenaire = 'cartel' | 'groupe' | 'pm' | 'entreprise'

// Fiche de l'Annuaire : un personnage, comment le joindre, et sa place dans son organisation
export interface Contact {
  id: string
  nom: string
  telephone: string
  // Texte libre : Chef, Bras droit, Vendeur, Patron…
  role: string
  // null : contact sans rattachement
  partenaireId: string | null
  informations: string
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

export interface Partenaire {
  id: string
  nom: string
  type: TypePartenaire
  telephone: string
  note: string
  // Couleur de la tuile de l'organisation, au format #rrggbb ; absente sur les fiches anciennes
  couleur?: string
  createdAt: Timestamp | null
}

// `achat` : on lui achète ; `vente` : on lui vend
export type SensTarif = 'achat' | 'vente'

// Ligne de la grille d'un partenaire. `reference` = clé du catalogue (voir Reference).
// Prix en argent propre et en argent sale (billets de 1$), chacun facultatif.
export interface Tarif {
  id: string
  partenaireId: string
  reference: string
  sens: SensTarif
  prixPropre: number | null
  prixSale: number | null
  note: string
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

// Butin entré dans une journée de jeu. `id` = jour au format AAAA-MM-JJ ; la journée commence à 3 h du matin.
export interface Saisie {
  id: string
  // Quantité totale saisie dans la journée, par item (clé du catalogue)
  quantites: Record<string, number>
  updatedAt: Timestamp | null
}

// Somme que le groupe doit payer avant une échéance
export interface Contrat {
  id: string
  // Quoi, ou à qui : « Philippe », « Benny's »…
  libelle: string
  montant: number
  echeance: Timestamp
  // false : seule la date compte, l'échéance tombe en fin de journée
  heureFixee: boolean
  // true : à payer chaque semaine, le même jour à la même heure. `echeance` et `paye` portent alors sur
  // l'échéance en cours ; une fois celle-ci payée et passée, la suivante devient due (voir echeanceCourante).
  hebdo?: boolean
  paye: boolean
  note: string
  createdAt: Timestamp | null
}

export type GenreCommerce = 'standard' | 'securise' | 'express'

// Commerce de la ville capable de blanchir de l'argent sale, repéré par son code postal (zip)
export interface CommerceVille {
  id: string
  zip: string
  nom: string
  description: string
  // 'ballas' : à nous ; id d'un partenaire : à ce groupe ; null : propriétaire inconnu
  proprietaireId: string | null
  // Standard, sécurisé ou express. Absent sur les premières fiches, qui n'avaient que `securise`.
  genre?: GenreCommerce
  // Conservé pour les premières fiches ; vaut toujours `genre === 'securise'` sur les nouvelles
  securise: boolean
  // Part récupérée en propre, en % : 80 → 10 000 $ de sale rendent 8 000 $ de propre. null : inconnu
  taux: number | null
  // Temps de blanchiment ; null : inconnu
  dureeMinutes: number | null
  // Montant maximal d'argent sale que le commerce peut blanchir en une fois ; null ou absent : inconnu
  montantMax?: number | null
  note: string
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

// Dépôt d'argent sale dans un de nos commerces. Taux et durée sont ceux retenus au lancement.
export interface Blanchiment {
  id: string
  commerceId: string
  // Nom au moment du lancement : l'historique reste lisible si le commerce est supprimé
  commerceNom: string
  montant: number
  taux: number
  dureeMinutes: number
  debut: Timestamp
  fin: Timestamp
  // Lieu d'où sont sortis les billets de 1$ ; null si le stock n'a pas été touché
  lieuId: string | null
  statut: 'en_cours' | 'recupere'
  lanceParUid: string
  createdAt: Timestamp | null
  // Renseignés à la récupération
  montantRecupere?: number
  recupereParUid?: string
  recupereAt?: Timestamp | null
}

export type StatutCommande = 'en_attente' | 'validee' | 'annulee'

// Item commandé : vendu (`sens: 'vente'`) ou acheté (`sens: 'achat'`) au partenaire.
// Les prix unitaires sont ceux du tarif au moment de l'ajout.
export interface LigneCommande {
  reference: string
  sens: SensTarif
  quantite: number
  prixPropre: number | null
  prixSale: number | null
}

// Item qui change de main en plus de l'argent, lors du règlement
export interface Echange {
  reference: string
  quantite: number
}

// Commande en cours ou close avec un partenaire. Elle peut mêler des ventes et des achats.
// Les champs de clôture ne sont renseignés qu'à la validation ou à l'annulation, par un gradé.
export interface Commande {
  id: string
  partenaireId: string
  // Nom au moment de la création : la commande reste lisible si le partenaire est supprimé
  partenaireNom: string
  // Sens de la première ligne ; le sens réel est porté par chaque ligne
  sens: SensTarif
  statut: StatutCommande
  lignes: LigneCommande[]
  creeParUid: string
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
  // Règlement réel, après négociation : ce que le groupe a reçu du partenaire, et ce qu'il lui a donné
  recuPropre?: number | null
  recuSale?: number | null
  recuItems?: Echange[]
  payePropre?: number | null
  payeSale?: number | null
  payeItems?: Echange[]
  // Lieu dont le stock a été mis à jour ; null si aucun
  lieuId?: string | null
  note?: string
  clotureParUid?: string
  clotureAt?: Timestamp | null
}

// Item du catalogue du serveur (src/data/items.json, généré par `npm run items`)
export interface Item {
  id: number
  name: string
  image: string | null
  weight: number
}

// Arme du catalogue du serveur (src/data/armes.json, généré par `npm run items`)
export interface Arme extends Item {
  category: string
}

// Item ou arme du catalogue, tel que le Stock le référence. `cle` = identifiant de l'article :
// l'id pour un item, `arme-<id>` pour une arme (les deux catalogues ont des ids qui se chevauchent).
export interface Reference {
  cle: string
  name: string
  image: string | null
  // Poids unitaire, en kg
  weight: number
  dossier: 'items' | 'weapons'
}

// Tâche à réaliser par le groupe. `ordre` croissant = priorité décroissante.
export interface Tache {
  id: string
  titre: string
  ordre: number
  fait: boolean
  auteurUid: string
  createdAt: Timestamp | null
}

export interface Annonce {
  id: string
  titre: string
  contenu: string
  auteurUid: string
  auteurNom: string
  createdAt: Timestamp | null
}

export type LogAction = 'validation' | 'refus' | 'changement_role' | 'revocation' | 'reintegration' | 'suppression'

export interface LogEntry {
  id: string
  action: LogAction
  acteurUid: string
  acteurNom: string
  cibleUid: string
  cibleNom: string
  ancienRole: Role
  nouveauRole: Role
  raison?: RaisonSortie
  createdAt: Timestamp | null
}
