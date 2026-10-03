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
  role: Role
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

export interface Vehicule {
  id: string
  modele: string
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

// Interlocuteur commercial du groupe : un autre groupe, ou une petite main (PM)
export type TypePartenaire = 'groupe' | 'pm'

export interface Partenaire {
  id: string
  nom: string
  type: TypePartenaire
  telephone: string
  note: string
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

export type StatutCommande = 'en_attente' | 'validee' | 'annulee'

// Item commandé. Les prix unitaires sont ceux du tarif au moment de l'ajout.
export interface LigneCommande {
  reference: string
  quantite: number
  prixPropre: number | null
  prixSale: number | null
}

// Item qui change de main en plus de l'argent : repris par le groupe lors d'une vente, donné lors d'un achat
export interface Echange {
  reference: string
  quantite: number
}

// Vente (`sens: 'vente'`) ou achat (`sens: 'achat'`) en cours ou clos avec un partenaire.
// Les champs de clôture ne sont renseignés qu'à la validation ou à l'annulation, par un gradé.
export interface Commande {
  id: string
  partenaireId: string
  // Nom au moment de la création : la commande reste lisible si le partenaire est supprimé
  partenaireNom: string
  sens: SensTarif
  statut: StatutCommande
  lignes: LigneCommande[]
  creeParUid: string
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
  // Ce qui a réellement été payé, après négociation
  montantPropre?: number | null
  montantSale?: number | null
  echanges?: Echange[]
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
