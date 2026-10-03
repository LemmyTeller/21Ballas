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

// Lisible par les gradés uniquement (collection prixArticles)
// Les deux prix sont facultatifs.
export interface PrixArticle {
  prixAchat: number | null
  prixVente: number | null
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
