import { addDoc, collection, deleteDoc, doc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { Partenaire, SensTarif, Tarif, TypePartenaire } from '../../types'

export const TYPE_LABELS: Record<TypePartenaire, string> = { groupe: 'Groupe', pm: 'Petite main' }

export type PartenaireSaisie = Pick<Partenaire, 'nom' | 'type' | 'telephone' | 'note'>
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

// Le partenaire et toute sa grille, ensemble
export async function supprimerPartenaire(id: string, tarifs: Tarif[]): Promise<void> {
  const batch = writeBatch(db)
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
