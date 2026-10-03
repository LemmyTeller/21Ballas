import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { Partenaire, SensTarif, Tarif, TypePartenaire } from '../../types'

// Dans l'ordre d'affichage : le Cartel (les boss) passe toujours en premier
export const TYPES_PARTENAIRE: TypePartenaire[] = ['cartel', 'groupe', 'pm', 'entreprise']

export const TYPE_LABELS: Record<TypePartenaire, string> = {
  cartel: 'Cartel',
  groupe: 'Groupe',
  pm: 'Petite main',
  entreprise: 'Entreprise',
}

export const TYPE_PLURIELS: Record<TypePartenaire, string> = {
  cartel: 'Cartel',
  groupe: 'Groupes',
  pm: 'Petites mains',
  entreprise: 'Entreprises',
}

// Seuls le Cartel et les groupes ont chacun leur grille de tarifs. Les entreprises n'en ont pas pour le moment,
// et toutes les petites mains partagent la même.
export const TYPES_AVEC_GRILLE: TypePartenaire[] = ['cartel', 'groupe']

// Grille commune à toutes les petites mains : ses lignes de tarif portent cet identifiant à la place de celui
// d'un partenaire. Un prix négocié avec une PM en particulier se corrige à la validation de la commande.
export const ID_GRILLE_PM = 'pm-commun'
export const GRILLE_PM: Partenaire = {
  id: ID_GRILLE_PM,
  nom: 'Petites mains',
  type: 'pm',
  telephone: '',
  note: '',
  createdAt: null,
}

// Couleur de la tuile d'une organisation qui n'en a pas encore choisi
export const COULEUR_DEFAUT = '#71717a'

// Couleurs proposées en un clic ; n'importe quelle autre reste possible
export const COULEURS_PROPOSEES = [
  '#9333ea',
  '#16a34a',
  '#eab308',
  '#dc2626',
  '#2563eb',
  '#ea580c',
  '#db2777',
  '#0891b2',
  '#f4f4f5',
  '#71717a',
]

// Le Cartel d'abord, puis par ordre alphabétique
export function comparerPartenaires(a: Partenaire, b: Partenaire): number {
  return Number(b.type === 'cartel') - Number(a.type === 'cartel') || a.nom.localeCompare(b.nom, 'fr')
}

export type PartenaireSaisie = Pick<Partenaire, 'nom' | 'type' | 'telephone' | 'note' | 'couleur'>
export type PrixSaisie = Pick<Tarif, 'prixPropre' | 'prixSale' | 'note'>

function nettoyer(saisie: PartenaireSaisie): PartenaireSaisie {
  return { ...saisie, nom: saisie.nom.trim(), telephone: saisie.telephone.trim(), note: saisie.note.trim() }
}

export async function creerPartenaire(saisie: PartenaireSaisie): Promise<string> {
  const ref = await addDoc(collection(db, 'partenaires'), { ...nettoyer(saisie), createdAt: serverTimestamp() })
  return ref.id
}

export async function majPartenaire(id: string, saisie: PartenaireSaisie): Promise<void> {
  await updateDoc(doc(db, 'partenaires', id), nettoyer(saisie))
}

// Le partenaire et toute sa grille, ensemble. Ses contacts de l'Annuaire sont conservés, sans rattachement.
export async function supprimerPartenaire(id: string, tarifs: Tarif[]): Promise<void> {
  const contacts = await getDocs(query(collection(db, 'contacts'), where('partenaireId', '==', id)))
  const batch = writeBatch(db)
  contacts.forEach((contact) => batch.update(contact.ref, { partenaireId: null, updatedAt: serverTimestamp() }))
  for (const tarif of tarifs.filter((t) => t.partenaireId === id)) batch.delete(doc(db, 'tarifs', tarif.id))
  batch.delete(doc(db, 'partenaires', id))
  await batch.commit()
}

// Identifiant déterministe : une seule ligne par partenaire, sens et item
export function idTarif(partenaireId: string, sens: SensTarif, reference: string): string {
  return `${partenaireId}_${sens}_${reference}`
}

export async function creerTarif(
  partenaireId: string,
  sens: SensTarif,
  reference: string,
  saisie: PrixSaisie,
): Promise<void> {
  await setDoc(doc(db, 'tarifs', idTarif(partenaireId, sens, reference)), {
    partenaireId,
    sens,
    reference,
    ...saisie,
    note: saisie.note.trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function majTarif(id: string, saisie: PrixSaisie): Promise<void> {
  await updateDoc(doc(db, 'tarifs', id), { ...saisie, note: saisie.note.trim(), updatedAt: serverTimestamp() })
}

export async function supprimerTarif(id: string): Promise<void> {
  await deleteDoc(doc(db, 'tarifs', id))
}
